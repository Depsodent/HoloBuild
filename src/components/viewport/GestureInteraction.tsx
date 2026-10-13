import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import { Vector3 } from "three";
import { gestureStream } from "../../vision/gesturePipeline";
import { GestureController } from "../../interaction/gestureController";
import { createRaycasting } from "../../interaction/raycasting";
import { useSceneStore } from "../../scene/sceneStore";
import type { MenuAction } from "../../interaction/interactionStore";
export function GestureInteraction() {
  const { camera, scene, gl } = useThree();
  const controller = useRef<GestureController | null>(null);
  const last = useRef(0);
  useEffect(() => {
    const raycasting = createRaycasting(camera, scene);
    const instance = new GestureController({
      ...raycasting,
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
    const off = gestureStream.subscribe((frame) => {
      last.current = performance.now();
      instance.update(frame);
    });
    const offScene = useSceneStore.subscribe((state, previous) => {
      if (
        instance.dragging &&
        (state.objects !== previous.objects ||
          state.selectedId !== previous.selectedId ||
          state.tool !== previous.tool)
      ) {
        instance.cancel(
          "Scene changed during grab. Uncommitted movement cancelled.",
        );
      }
    });
    const cancelOnMouse = () => {
      if (instance.dragging)
        instance.cancel("Mouse control resumed. Gesture preview cancelled.");
    };
    gl.domElement.addEventListener("pointerdown", cancelOnMouse);
    return () => {
      off();
      offScene();
      gl.domElement.removeEventListener("pointerdown", cancelOnMouse);
      instance.cancel("Viewport restarted. Uncommitted movement cancelled.");
      controller.current = null;
    };
  }, [camera, scene, gl]);
  useFrame(() => {
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
    }
  });
  return null;
}
export function PlacementPreview() {
  const preview = useSceneStore((s) => s.preview);
  const objects = useSceneStore((s) => s.objects);
  const object = objects.find((o) => o.id === preview?.id);
  if (!preview || !object) return null;
  return (
    <mesh
      position={preview.position}
      rotation={object.rotation}
      scale={object.scale}
    >
      <boxGeometry />
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
