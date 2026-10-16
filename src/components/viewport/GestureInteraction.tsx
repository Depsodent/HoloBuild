import { ObjectGeometry } from "./ObjectGeometry";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import { Vector3, PerspectiveCamera, Mesh, MeshStandardMaterial } from "three";
import { NavigationController } from "../../interaction/navigationController";
import { gestureStream } from "../../vision/gesturePipeline";
import { handsStream } from "../../vision/handsStream";
import { TwoHandController } from "../../interaction/twoHandController";
import { GestureMenuController } from "../../interaction/gestureMenuController";
import {
  useAdvancedStore,
  MODE_INSTRUCTIONS,
} from "../../interaction/advancedStore";
import { useInteractionStore } from "../../interaction/interactionStore";
import { GestureController } from "../../interaction/gestureController";
import { createRaycasting } from "../../interaction/raycasting";
import { useSceneStore } from "../../scene/sceneStore";
import type { MenuAction } from "../../interaction/interactionStore";
export function GestureInteraction() {
  const { camera, scene, gl } = useThree();
  const controller = useRef<GestureController | null>(null);
  const advanced = useRef<TwoHandController | null>(null);
  const last = useRef(0);
  const cancelNavigation = useRef<(() => void) | null>(null);
  const get = useThree((s) => s.get);
  useEffect(() => {
    const raycasting = createRaycasting(camera, scene);
    const instance = new GestureController({
      ...raycasting,
      blocked(cursor) {
        if (document.querySelector('[aria-label="Workspace help"]'))
          return true;
        const rect = gl.domElement.getBoundingClientRect();
        return !!document
          .elementFromPoint(
            rect.left + cursor.x * rect.width,
            rect.top + cursor.y * rect.height,
          )
          ?.closest(
            ".webcam-panel, .gesture-diagnostics, .workspace-left, .workspace-right",
          );
      },
      menuHit(cursor) {
        const rect = gl.domElement.getBoundingClientRect();
        const x = rect.left + cursor.x * rect.width,
          y = rect.top + cursor.y * rect.height;
        for (const element of document.querySelectorAll<HTMLElement>(
          "[data-gesture-action]",
        )) {
          const r = element.getBoundingClientRect();
          if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
            return element.dataset.gestureAction as MenuAction;
        }
        return null;
      },
    });
    controller.current = instance;
    const two = new TwoHandController();
    const menu = new GestureMenuController();
    const orbit = () =>
      get().controls as unknown as {
        target: Vector3;
        enabled: boolean;
        update: () => void;
      } | null;
    const nav = new NavigationController({
      capture() {
        const controls = orbit();
        if (!controls) return null;
        camera.updateMatrixWorld();
        return {
          position: camera.position.clone(),
          target: controls.target.clone(),
          right: new Vector3().setFromMatrixColumn(camera.matrixWorld, 0),
          up: new Vector3().setFromMatrixColumn(camera.matrixWorld, 1),
          span:
            camera.position.distanceTo(controls.target) *
            (camera instanceof PerspectiveCamera
              ? 2 * Math.tan((camera.fov * Math.PI) / 360)
              : 0.8),
          aspect: camera instanceof PerspectiveCamera ? camera.aspect : 1,
        };
      },
      pan(start, dx, dy, sensitivity) {
        const controls = orbit();
        if (!controls) return false;
        const delta = start.right
          .clone()
          .multiplyScalar(-dx * start.span * start.aspect * sensitivity)
          .addScaledVector(start.up, dy * start.span * sensitivity);
        const position = start.position.clone().add(delta),
          target = start.target.clone().add(delta);
        if (
          position.y < 0.2 ||
          position.toArray().some((v) => Math.abs(v) > 100) ||
          target.toArray().some((v) => Math.abs(v) > 50)
        )
          return false;
        camera.position.copy(position);
        controls.target.copy(target);
        controls.update();
        return true;
      },
      restore(start) {
        const controls = orbit();
        camera.position.copy(start.position);
        controls?.target.copy(start.target);
        controls?.update();
      },
    });
    cancelNavigation.current = () => {
      if (nav.active) nav.cancel("Tracking stalled. Camera pan restored.");
    };
    advanced.current = two;
    let mouseActive = false;
    const off = gestureStream.subscribe((frame) => {
      last.current = performance.now();
      if (
        !mouseActive &&
        (useAdvancedStore.getState().mode === "move" ||
          useInteractionStore.getState().menuOpen)
      )
        instance.update(frame);
    });
    const offHands = handsStream.subscribe((frame) => {
      const mode = useAdvancedStore.getState().mode;
      if (
        !mouseActive &&
        (mode === "scale" || mode === "rotate") &&
        !useSceneStore.getState().selectedId &&
        frame.hands.length === 1
      )
        instance.update(frame.hands[0].gesture, true);
      if (!mouseActive) two.update(frame);
      if (!mouseActive) nav.update(frame);
      if (!mouseActive) menu.update(frame);
      else menu.suppress(frame.timestamp);
    });
    const offMode = useAdvancedStore.subscribe((state, previous) => {
      if (state.mode !== previous.mode) {
        instance.cancel("Gesture mode changed.");
        two.cancel("Mode changed. Open pinches before beginning.");
        nav.cancel("Mode changed. Open pinch before navigating.");
        useAdvancedStore.setState({
          active: false,
          readyHands: 0,
          factor: 1,
          angle: 0,
          message: MODE_INSTRUCTIONS[state.mode],
        });
      }
    });
    const offScene = useSceneStore.subscribe((state, previous) => {
      if (
        (instance.dragging || two.active || nav.active) &&
        (state.objects !== previous.objects ||
          state.selectedId !== previous.selectedId ||
          state.selectedStructureId !== previous.selectedStructureId ||
          state.selectionMode !== previous.selectionMode ||
          state.tool !== previous.tool)
      ) {
        instance.cancel(
          "Scene changed during grab. Uncommitted movement cancelled.",
        );
        two.cancel("Scene changed during advanced transform.");
        nav.cancel("Scene changed. Camera pan cancelled.");
      }
    });
    const cancelOnMouse = () => {
      mouseActive = true;
      menu.suppress(performance.now());
      instance.cancel("Mouse control resumed. Open pinch and aim again.");
      two.cancel("Mouse control resumed. Advanced preview cancelled.");
      nav.cancel("Mouse control resumed. Camera pan cancelled.");
      const controls = orbit();
      if (controls) controls.enabled = true;
    };
    const mouseUp = () => {
      mouseActive = false;
    };
    const panelPointerDown = (event: PointerEvent) => {
      if (
        event.button === 0 &&
        event.target instanceof Element &&
        event.target.closest(
          "[data-layout-handle], .sidebar-heading, .panel-section-heading, summary",
        )
      )
        cancelOnMouse();
      else if (
        event.target instanceof Element &&
        event.target.closest(
          ".workspace-left, .workspace-right, .webcam-panel, .gesture-diagnostics",
        ) &&
        (instance.dragging || two.active || nav.active)
      )
        cancelOnMouse();
    };
    const panelKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("summary") &&
        ["Enter", " "].includes(event.key)
      ) {
        cancelOnMouse();
        mouseUp();
      }
      if (
        event.target instanceof Element &&
        event.target.closest("[data-layout-handle]") &&
        [
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
        ].includes(event.key)
      ) {
        cancelOnMouse();
        mouseUp();
      }
    };
    const layoutReset = () => {
      cancelOnMouse();
      mouseUp();
    };
    gl.domElement.addEventListener("pointerdown", cancelOnMouse, true);
    document.addEventListener("pointerdown", panelPointerDown, true);
    document.addEventListener("keydown", panelKeyDown, true);
    window.addEventListener("holobuild:reset-layout", layoutReset);
    window.addEventListener("pointerup", mouseUp);
    window.addEventListener("pointercancel", mouseUp);
    return () => {
      off();
      offHands();
      offMode();
      two.cancel();
      nav.cancel();
      cancelNavigation.current = null;
      advanced.current = null;
      offScene();
      gl.domElement.removeEventListener("pointerdown", cancelOnMouse, true);
      document.removeEventListener("pointerdown", panelPointerDown, true);
      document.removeEventListener("keydown", panelKeyDown, true);
      window.removeEventListener("holobuild:reset-layout", layoutReset);
      window.removeEventListener("pointerup", mouseUp);
      window.removeEventListener("pointercancel", mouseUp);
      instance.cancel("Viewport restarted. Uncommitted movement cancelled.");
      controller.current = null;
    };
  }, [camera, scene, gl, get]);
  useFrame(() => {
    if (performance.now() - last.current > 250) cancelNavigation.current?.();
    if (performance.now() - last.current > 250 && advanced.current?.active)
      advanced.current.cancel(
        "Tracking stalled. Advanced transform cancelled.",
      );
    if (performance.now() - last.current > 250 && controller.current?.dragging)
      controller.current.cancel(
        "Tracking paused for 250 ms. Uncommitted movement cancelled.",
      );
    // Development-only projection seam allows fixture landmarks to target a real mesh.
    if (
      import.meta.env.DEV &&
      window.__HOLO_TEST__ &&
      !window.__HOLO_TEST__.project
    ) {
      window.__HOLO_TEST__.project = (id) => {
        const o = useSceneStore.getState().objects.find((o) => o.id === id);
        if (!o) return null;
        const p = new Vector3(...o.position).project(camera);
        return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
      };
      window.__HOLO_TEST__.rendered = () => {
        const result: {
          id: string;
          roughness: number;
          metalness: number;
          opacity: number;
        }[] = [];
        scene.traverse((node) => {
          if (node instanceof Mesh && node.userData.objectId) {
            let material =
              node.material instanceof MeshStandardMaterial
                ? node.material
                : null;
            if (!material)
              node.traverse((child) => {
                if (
                  !material &&
                  child instanceof Mesh &&
                  child.material instanceof MeshStandardMaterial
                )
                  material = child.material;
              });
            if (material)
              result.push({
                id: node.userData.objectId,
                roughness: material.roughness,
                metalness: material.metalness,
                opacity: material.opacity,
              });
          }
        });
        return result;
      };
    }
  });
  return null;
}
export function PlacementPreview() {
  const preview = useSceneStore((s) => s.preview);
  const objects = useSceneStore((s) => s.objects);
  const object = objects.find((o) => o.id === preview?.id);
  if (!preview || !object) return null;
  if (preview.structure)
    return (
      <group>
        {preview.structure.objects.map((o) => (
          <mesh
            key={o.id}
            position={o.position}
            rotation={o.rotation}
            scale={o.scale}
            raycast={() => {}}
          >
            <ObjectGeometry type={o.type} size={o.model?.size} />
            <meshBasicMaterial
              wireframe
              color={preview.valid ? "#79ffe0" : "#ff6c83"}
              transparent
              opacity={0.4}
            />
          </mesh>
        ))}
      </group>
    );
  return (
    <mesh
      raycast={() => {}}
      position={preview.position}
      rotation={preview.rotation ?? object.rotation}
      scale={preview.scale ?? object.scale}
    >
      <ObjectGeometry type={object.type} size={object.model?.size} />
      <meshBasicMaterial
        color={preview.valid ? "#79ffe0" : "#ff6c83"}
        transparent
        opacity={0.25}
        depthWrite={false}
      />
      <Edges color={preview.valid ? "#9cffe6" : "#ff7891"} lineWidth={2} />
    </mesh>
  );
}
