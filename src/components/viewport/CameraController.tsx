import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Euler, PerspectiveCamera, Quaternion, Vector3 } from "three";
import type { OrbitControls as OrbitImpl } from "three-stdlib";
import { useInteractionStore } from "../../interaction/interactionStore";
import { useSceneStore } from "../../scene/sceneStore";
import type { Vec3 } from "../../scene/objectTypes";
import { bounds } from "../../interaction/placement";
import {
  navigationWorld,
  moveBody,
  safeSpawn,
  bodyClear,
  type Body,
} from "../../exploration/navigation";
import {
  useViewStore,
  viewPreferences,
  cameraViewSchema,
} from "../../exploration/viewStore";
interface Pose {
  position: Vector3;
  quaternion: Quaternion;
  target: Vector3;
  fov: number;
  near: number;
}
export function CameraController() {
  const { camera, gl } = useThree(),
    orbit = useRef<OrbitImpl>(null),
    body = useRef<Body | null>(null),
    yaw = useRef(0),
    pitch = useRef(0),
    keys = useRef(new Set<string>()),
    lastPublish = useRef(0);
  const objects = useSceneStore((s) => s.objects),
    walking = useViewStore((s) => s.walking),
    presentation = useViewStore((s) => s.presentation),
    dragging = useInteractionStore(
      (s) => s.phase === "dragging" || s.phase === "invalid",
    ),
    world = useMemo(() => navigationWorld(objects), [objects]),
    worldRef = useRef(world);
  worldRef.current = world;
  const previousEye = useRef(useViewStore.getState().eyeHeight);
  const state = useRef({
    editor: null as Pose | null,
    overview: null as Pose | null,
    walking: false,
    active: false,
    lastRequest: 0,
  });
  function capture(): Pose {
    return {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      target: orbit.current?.target.clone() ?? new Vector3(),
      fov: camera instanceof PerspectiveCamera ? camera.fov : 45,
      near: camera.near,
    };
  }
  function restore(p: Pose) {
    if (orbit.current) {
      orbit.current.enableDamping = false;
      orbit.current.update();
      orbit.current.enableDamping = true;
      orbit.current.target.copy(p.target);
    }
    camera.position.copy(p.position);
    camera.quaternion.copy(p.quaternion);
    camera.near = p.near;
    if (camera instanceof PerspectiveCamera) {
      camera.fov = p.fov;
      camera.updateProjectionMatrix();
    }
    orbit.current?.update();
  }
  function spawn() {
    const s = useSceneStore.getState(),
      part = s.objects.find((o) => o.id === s.selectedId),
      group = s.selectedStructureId ?? part?.construction?.structureId,
      parts = group
        ? s.objects.filter((o) => o.construction?.structureId === group)
        : s.objects;
    const info = parts.find((o) => o.construction?.structure)?.construction
        ?.structure,
      door = parts.find(
        (o) =>
          o.construction?.role === "door" &&
          o.construction.level === 0 &&
          worldRef.current.passableDoors > 0,
      );
    let anchor: Vec3 = info ? [...info.position] : [0, 0, 0],
      look: Vector3 | null = null;
    if (door) {
      const face = door.construction?.facade ?? "front",
        normal = new Vector3(
          face === "left" ? -1 : face === "right" ? 1 : 0,
          0,
          face === "back" ? -1 : face === "front" ? 1 : 0,
        ).applyAxisAngle(new Vector3(0, 1, 0), info?.yaw ?? 0);
      anchor = [
        door.position[0] + normal.x * 0.9,
        Math.max(0, bounds(door).min.y),
        door.position[2] + normal.z * 0.9,
      ];
      look = new Vector3(door.position[0], 0, door.position[2]);
    }
    const found = safeSpawn(
      worldRef.current,
      anchor,
      useViewStore.getState().eyeHeight + 0.15,
    );
    if (!found) {
      useViewStore.setState({
        walking: false,
        paused: true,
        message:
          "No clear human-sized entry position was found. Use Overview or adjust the scene.",
      });
      return false;
    }
    body.current = found;
    const d = look?.sub(new Vector3(found.position[0], 0, found.position[2]));
    yaw.current = d ? Math.atan2(-d.x, -d.z) : 0;
    pitch.current = 0;
    keys.current.clear();
    useViewStore.setState({
      feet: found.position,
      paused: true,
      message: s.objects.length
        ? "Choose mouse look or keyboard/touch to begin. Escape pauses."
        : "Empty scene: walk on the workspace ground; Exit restores the editor view.",
    });
    return true;
  }
  useEffect(() => {
    const changed = () => {
      const current = useViewStore.getState();
      if (
        current.walking &&
        body.current &&
        current.eyeHeight !== previousEye.current &&
        !bodyClear(
          worldRef.current,
          body.current.position,
          current.eyeHeight + 0.15,
        )
      ) {
        viewPreferences({ eyeHeight: previousEye.current });
        useViewStore.setState({
          message:
            "That eye height cannot fit the current ceiling. Move to a clear space before changing it.",
        });
        return;
      }
      previousEye.current = current.eyeHeight;
      const s = useViewStore.getState(),
        r = state.current,
        active = s.walking || s.presentation,
        wasActive = r.active,
        wasWalking = r.walking;
      r.active = active;
      r.walking = s.walking;
      if (active && !wasActive) r.editor = capture();
      if (s.walking && !wasWalking) {
        r.overview = capture();
        if (camera instanceof PerspectiveCamera) {
          camera.fov = 65;
          camera.near = 0.05;
          camera.updateProjectionMatrix();
        }
        spawn();
      }
      if (!s.walking && wasWalking) {
        document.exitPointerLock?.();
        keys.current.clear();
        body.current = null;
        if (r.overview) restore(r.overview);
      }
      if (!active && wasActive) {
        document.exitPointerLock?.();
        keys.current.clear();
        body.current = null;
        if (r.editor) restore(r.editor);
        r.editor = r.overview = null;
      }
      if (s.request.seq !== r.lastRequest) {
        r.lastRequest = s.request.seq;
        const q = s.request;
        if (q.type === "reset" && s.walking) spawn();
        if (q.type === "fit" && !s.walking) {
          const b = worldRef.current.bounds;
          const center = b.isEmpty()
              ? new Vector3(0, 0.5, 0)
              : b.getCenter(new Vector3()),
            size = b.isEmpty() ? 3 : b.getSize(new Vector3()).length(),
            distance = Math.max(4, Math.min(180, size * 1.3));
          camera.position
            .copy(center)
            .add(new Vector3(distance * 0.65, distance * 0.5, distance * 0.75));
          orbit.current?.target.copy(center);
          camera.lookAt(center);
          orbit.current?.update();
        }
        if (q.type === "save") {
          const name = q.name.trim();
          if (name && s.views.length < 12) {
            const direction = camera.getWorldDirection(new Vector3()),
              view = cameraViewSchema.parse({
                id: crypto.randomUUID(),
                name,
                position: camera.position.toArray(),
                target: s.walking
                  ? camera.position
                      .clone()
                      .add(direction.multiplyScalar(5))
                      .toArray()
                  : (orbit.current?.target.toArray() ?? [0, 0, 0]),
                quaternion: camera.quaternion.toArray(),
                walking: s.walking,
                eyeHeight: s.eyeHeight,
              });
            viewPreferences({ views: [...s.views, view] });
            useViewStore.setState({
              message:
                "Viewpoint saved in this browser; scene geometry and history are unchanged.",
            });
          }
        }
        if (q.type === "recall") {
          const v = s.views.find((v) => v.id === q.id);
          if (v) {
            if (v.walking) {
              const p: Vec3 = [
                v.position[0],
                v.position[1] - v.eyeHeight,
                v.position[2],
              ];
              if (bodyClear(worldRef.current, p, v.eyeHeight + 0.15)) {
                body.current = { position: p, velocity: 0, grounded: false };
                const e = new Euler().setFromQuaternion(
                  new Quaternion(...v.quaternion),
                  "YXZ",
                );
                yaw.current = e.y;
                pitch.current = e.x;
                useViewStore.setState({
                  feet: p,
                  paused: true,
                  message: "Viewpoint restored. Choose controls to resume.",
                });
              } else
                useViewStore.setState({
                  message:
                    "That viewpoint is obstructed by the current scene. Reset position or choose another view.",
                });
            } else
              restore({
                position: new Vector3(...v.position),
                quaternion: new Quaternion(...v.quaternion),
                target: new Vector3(...v.target),
                fov: r.editor?.fov ?? 45,
                near: r.editor?.near ?? 0.1,
              });
          }
        }
      }
    };
    const off = useViewStore.subscribe(changed);
    changed();
    const down = (e: KeyboardEvent) => {
      if (!useViewStore.getState().walking) return;
      if (e.key === "Escape") {
        document.exitPointerLock?.();
        keys.current.clear();
        useViewStore.setState({
          paused: true,
          message: "Paused. Choose mouse look or keyboard/touch to resume.",
          virtual: { forward: 0, right: 0, turn: 0 },
        });
        return;
      }
      if (
        (e.target as HTMLElement)?.closest?.("input,select,textarea") ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      const key = e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(key)
      ) {
        e.preventDefault();
        if (!useViewStore.getState().paused) keys.current.add(key);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const pause = () => {
      keys.current.clear();
      if (useViewStore.getState().walking)
        useViewStore.setState({
          paused: true,
          virtual: { forward: 0, right: 0, turn: 0 },
        });
    };
    const hidden = () => {
      if (document.hidden) pause();
    };
    const locked = () => {
      if (useViewStore.getState().walking) {
        keys.current.clear();
        useViewStore.setState({
          paused: document.pointerLockElement !== gl.domElement,
          message:
            document.pointerLockElement === gl.domElement
              ? "Mouse look active · WASD move · Escape pauses."
              : "Paused. Choose controls to resume.",
        });
      }
    };
    const lockError = () => {
      if (useViewStore.getState().walking)
        useViewStore.setState({
          paused: true,
          message:
            "Mouse lock unavailable or declined. Keyboard/touch movement is available.",
        });
    };
    const mouse = (e: MouseEvent) => {
      const s = useViewStore.getState();
      if (
        !s.walking ||
        s.paused ||
        document.pointerLockElement !== gl.domElement
      )
        return;
      yaw.current -= e.movementX * 0.002;
      pitch.current = Math.max(
        -1.45,
        Math.min(1.45, pitch.current - e.movementY * 0.002),
      );
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("pointerlockchange", locked);
    document.addEventListener("pointerlockerror", lockError);
    document.addEventListener("mousemove", mouse);
    return () => {
      off();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("pointerlockchange", locked);
      document.removeEventListener("pointerlockerror", lockError);
      document.removeEventListener("mousemove", mouse);
      if (state.current.editor) restore(state.current.editor);
      state.current = {
        editor: null,
        overview: null,
        active: false,
        walking: false,
        lastRequest: 0,
      };
    };
    // The subscription reads current stores/refs; it must not recreate the camera session on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl]);
  useEffect(() => {
    useViewStore.setState({
      approximate: world.approximate,
      doors: world.passableDoors,
    });
    if (
      useViewStore.getState().walking &&
      body.current &&
      !bodyClear(
        world,
        body.current.position,
        useViewStore.getState().eyeHeight + 0.15,
      )
    ) {
      spawn();
      useViewStore.setState({
        message:
          "Scene changed around the camera; moved to a safe entry position.",
      });
    }
  }, [world]);
  useFrame((_, delta) => {
    const s = useViewStore.getState();
    if (s.walking && body.current) {
      const dt = Math.min(delta, 0.1);
      if (!s.paused) {
        const k = keys.current;
        let f =
            (k.has("w") || k.has("arrowup") ? 1 : 0) -
            (k.has("s") || k.has("arrowdown") ? 1 : 0) +
            s.virtual.forward,
          r = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0) + s.virtual.right;
        const n = Math.max(1, Math.hypot(f, r));
        f /= n;
        r /= n;
        yaw.current +=
          ((k.has("arrowleft") ? 1 : 0) -
            (k.has("arrowright") ? 1 : 0) +
            s.virtual.turn) *
          dt *
          1.5;
        body.current = moveBody(
          worldRef.current,
          body.current,
          (-Math.sin(yaw.current) * f + Math.cos(yaw.current) * r) *
            s.speed *
            dt,
          (-Math.cos(yaw.current) * f - Math.sin(yaw.current) * r) *
            s.speed *
            dt,
          dt,
          s.eyeHeight + 0.15,
        );
      }
      camera.position.set(
        body.current.position[0],
        body.current.position[1] + s.eyeHeight,
        body.current.position[2],
      );
      camera.quaternion.setFromEuler(
        new Euler(pitch.current, yaw.current, 0, "YXZ"),
      );
      if (performance.now() - lastPublish.current > 250) {
        lastPublish.current = performance.now();
        useViewStore.setState({ feet: [...body.current.position] as Vec3 });
      }
    }
    if (
      import.meta.env.DEV &&
      window.__HOLO_TEST__ &&
      !window.__HOLO_TEST__.view
    )
      window.__HOLO_TEST__.view = () => ({
        position: camera.position.toArray(),
        quaternion: camera.quaternion.toArray(),
        target: orbit.current?.target.toArray() ?? [0, 0, 0],
        walking: useViewStore.getState().walking,
        feet: body.current?.position ?? null,
      });
  });
  return (
    <OrbitControls
      ref={orbit}
      makeDefault
      enabled={!walking && !dragging}
      minDistance={3}
      maxDistance={presentation ? 250 : 45}
      maxPolarAngle={Math.PI / 2 - 0.03}
      target={[0, 0.5, 0]}
    />
  );
}
