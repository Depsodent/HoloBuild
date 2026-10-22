import {
  releaseLook,
  syncLook,
  lookUnavailable,
} from "../../exploration/pointerLock";
import { exitExploration } from "../../exploration/actions";
import {
  cancelDirect,
  rotateDirect,
} from "../../exploration/directManipulation";
import {
  useFurnishStore,
  openFurnish,
  closeFurnish,
  rotateFurniture,
  cancelFurniture,
} from "../../furniture/furnishStore";
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
  NavigationCache,
  moveBody,
  jumpBody,
  safeSpawn,
  bodyClear,
  type Body,
} from "../../exploration/navigation";
import {
  useViewStore,
  publishCameraFeet,
  WALK_SPEED,
  SPRINT_SPEED,
  EYE_HEIGHT,
} from "../../exploration/viewStore";
interface Pose {
  position: Vector3;
  quaternion: Quaternion;
  target: Vector3;
  fov: number;
  near: number;
  maxDistance: number;
}
export function CameraController() {
  const { camera, gl } = useThree(),
    orbit = useRef<OrbitImpl>(null),
    body = useRef<Body | null>(null),
    yaw = useRef(0),
    pitch = useRef(0),
    keys = useRef(new Set<string>()),
    jumpQueued = useRef(false),
    lastPublish = useRef(0);
  const objects = useSceneStore((s) => s.objects),
    walking = useViewStore((s) => s.walking),
    dragging = useInteractionStore(
      (s) => s.phase === "dragging" || s.phase === "invalid",
    );
  const cache = useMemo(() => new NavigationCache(), []),
    lookEuler = useMemo(() => new Euler(0, 0, 0, "YXZ"), []);
  const start = useRef<{ position: Vec3; yaw: number } | null>(null);
  const session = useRef({
    editor: null as Pose | null,
    walking: false,
    lastReset: 0,
  });
  function world() {
    return cache.read(useSceneStore.getState().objects);
  }
  function capture(): Pose {
    return {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      target: orbit.current?.target.clone() ?? new Vector3(),
      fov: camera instanceof PerspectiveCamera ? camera.fov : 45,
      near: camera.near,
      maxDistance: orbit.current?.maxDistance ?? 45,
    };
  }
  function restore(p: Pose) {
    if (orbit.current) {
      orbit.current.enableDamping = false;
      orbit.current.update();
      orbit.current.enableDamping = true;
      orbit.current.target.copy(p.target);
      orbit.current.maxDistance = p.maxDistance;
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
  function spawn(reuse = false) {
    const w = world();
    let found: Body | null = null,
      heading = 0;
    if (
      reuse &&
      start.current &&
      bodyClear(w, start.current.position, EYE_HEIGHT + 0.15)
    ) {
      found = {
        position: [...start.current.position],
        velocity: 0,
        grounded: false,
      };
      heading = start.current.yaw;
    } else {
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
            w.passableDoors > 0,
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
      found = safeSpawn(w, anchor, EYE_HEIGHT + 0.15);
      if (found) {
        const d = look?.sub(
          new Vector3(found.position[0], 0, found.position[2]),
        );
        heading = d ? Math.atan2(-d.x, -d.z) : 0;
      }
    }
    if (!found) {
      useViewStore.setState({
        walking: false,
        paused: true,
        looking: false,
        message:
          "No clear human-sized entry was found. Adjust the scene in the editor and try again.",
      });
      return false;
    }
    body.current = found;
    yaw.current = heading;
    camera.position.set(
      found.position[0],
      found.position[1] + EYE_HEIGHT,
      found.position[2],
    );
    camera.quaternion.setFromEuler(lookEuler.set(0, heading, 0));
    camera.updateMatrixWorld();
    publishCameraFeet(found.position);
    pitch.current = 0;
    keys.current.clear();
    jumpQueued.current = false;
    start.current = { position: [...found.position], yaw: heading };
    useViewStore.setState({
      feet: [...found.position],
      paused: true,
      looking: false,
      virtual: { forward: 0, right: 0, turn: 0 },
      approximate: w.approximate,
      doors: w.passableDoors,
      message: useSceneStore.getState().objects.length
        ? "Paused · Look Around to begin; keyboard/touch in Controls."
        : "Empty scene: walk on the workspace ground. Exit Walkthrough restores the editor.",
    });
    return true;
  }
  useEffect(() => {
    const held = keys.current;
    const changed = () => {
      const s = useViewStore.getState(),
        r = session.current,
        was = r.walking;
      r.walking = s.walking;
      if (s.paused || s.manipulating || s.furnishing) {
        keys.current.clear();
        jumpQueued.current = false;
      }
      if (s.walking && !was) {
        r.editor = capture();
        if (camera instanceof PerspectiveCamera) {
          camera.fov = 65;
          camera.near = 0.05;
          camera.updateProjectionMatrix();
        }
        spawn();
      }
      if (!s.walking && was) {
        if (document.pointerLockElement === gl.domElement) releaseLook();
        keys.current.clear();
        body.current = null;
        publishCameraFeet(null);
        start.current = null;
        cache.clear();
        if (r.editor) restore(r.editor);
        r.editor = null;
      }
      if (s.resetSeq !== r.lastReset) {
        r.lastReset = s.resetSeq;
        cancelDirect();
        cancelFurniture();
        if (s.walking) spawn(true);
      }
    };
    const off = useViewStore.subscribe(changed);
    changed();
    return () => {
      off();
      held.clear();
      body.current = null;
      cache.clear();
      if (session.current.editor) restore(session.current.editor);
      session.current = { editor: null, walking: false, lastReset: 0 };
    };
    // Read immutable scene snapshots/current refs without recreating sessions on telemetry updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl]);
  useEffect(() => {
    if (!walking) return;
    const w = world();
    useViewStore.setState({
      approximate: w.approximate,
      doors: w.passableDoors,
    });
    if (
      body.current &&
      !bodyClear(w, body.current.position, EYE_HEIGHT + 0.15)
    ) {
      spawn();
      useViewStore.setState({
        message:
          "Scene changed around the camera; moved to a safe entry position.",
      });
    }
    // Scene identity, not render frames or cursor samples, invalidates collision data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, walking]);
  useEffect(() => {
    if (!walking) return;
    const held = keys.current;
    const pause = () => {
      keys.current.clear();
      jumpQueued.current = false;
      releaseLook();
      cancelDirect();
      if (useViewStore.getState().walking)
        useViewStore.setState({
          paused: true,
          looking: false,
          message: "Paused · Look Around or Controls to resume.",
          virtual: { forward: 0, right: 0, turn: 0 },
        });
    };
    const down = (e: KeyboardEvent) => {
      if (!useViewStore.getState().walking) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        exitExploration();
        return;
      }
      if (
        (e.target as HTMLElement)?.closest?.(
          "input,select,textarea,[contenteditable=true]",
        ) ||
        (e.ctrlKey &&
          !(
            useViewStore.getState().manipulating &&
            ["ArrowLeft", "ArrowRight"].includes(e.key)
          )) ||
        e.metaKey ||
        e.altKey
      )
        return;
      const v = useViewStore.getState();
      if (e.key.toLowerCase() === "e") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) {
          if (v.furnishing) closeFurnish();
          else openFurnish();
        }
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) {
          const dir = e.key === "ArrowLeft" ? -1 : 1;
          if (useFurnishStore.getState().draft)
            rotateFurniture((dir * Math.PI) / 12);
          else if (!v.furnishing) rotateDirect(dir);
        }
        return;
      }
      if ((e.target as HTMLElement)?.closest?.("button")) return;
      const k = e.key.toLowerCase();
      if (k === " ") {
        e.preventDefault();
        if (!e.repeat && !v.paused && !v.manipulating && !v.furnishing)
          jumpQueued.current = true;
        return;
      }
      if (
        [
          "shift",
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(k)
      ) {
        e.preventDefault();
        if (!v.paused && !v.manipulating && !v.furnishing) keys.current.add(k);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase()),
      hidden = () => {
        if (document.hidden) pause();
      };
    const locked = () => {
      keys.current.clear();
      jumpQueued.current = false;
      if (syncLook()) exitExploration();
    };
    const typing = (e: FocusEvent) => {
      if (
        (e.target as HTMLElement)?.closest?.(
          "input,select,textarea,[contenteditable=true]",
        )
      )
        pause();
    };
    const lockError = lookUnavailable;
    const mouse = (e: MouseEvent) => {
      const s = useViewStore.getState();
      if (
        !s.walking ||
        s.paused ||
        s.manipulating ||
        s.furnishing ||
        document.pointerLockElement !== gl.domElement
      )
        return;
      yaw.current -= e.movementX * 0.002;
      pitch.current = Math.max(
        -1.45,
        Math.min(1.45, pitch.current - e.movementY * 0.002),
      );
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("pointerlockchange", locked);
    document.addEventListener("pointerlockerror", lockError);
    document.addEventListener("mousemove", mouse);
    document.addEventListener("focusin", typing);
    return () => {
      held.clear();
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("pointerlockchange", locked);
      document.removeEventListener("pointerlockerror", lockError);
      document.removeEventListener("mousemove", mouse);
      document.removeEventListener("focusin", typing);
      releaseLook();
      cancelDirect();
    };
  }, [walking, gl]);
  useFrame((_, delta) => {
    const s = useViewStore.getState();
    if (s.walking && body.current) {
      const dt = Math.min(delta, 0.1);
      if (!s.paused && !s.manipulating && !s.furnishing) {
        const k = keys.current;
        let f =
            (k.has("w") || k.has("arrowup") ? 1 : 0) -
            (k.has("s") || k.has("arrowdown") ? 1 : 0) +
            s.virtual.forward,
          r = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0) + s.virtual.right;
        const n = Math.max(1, Math.hypot(f, r));
        f /= n;
        r /= n;
        yaw.current += s.virtual.turn * dt * 1.5;
        if (jumpQueued.current) {
          body.current = jumpBody(world(), body.current, EYE_HEIGHT + 0.15);
          jumpQueued.current = false;
        }
        const speed = k.has("shift") ? SPRINT_SPEED : WALK_SPEED;
        body.current = moveBody(
          world(),
          body.current,
          (-Math.sin(yaw.current) * f + Math.cos(yaw.current) * r) * speed * dt,
          (-Math.cos(yaw.current) * f - Math.sin(yaw.current) * r) * speed * dt,
          dt,
          EYE_HEIGHT + 0.15,
        );
      }
      publishCameraFeet(body.current.position);
      camera.position.set(
        body.current.position[0],
        body.current.position[1] + EYE_HEIGHT,
        body.current.position[2],
      );
      camera.quaternion.setFromEuler(
        lookEuler.set(pitch.current, yaw.current, 0),
      );
      if (
        performance.now() - lastPublish.current > 250 &&
        body.current.position.some((v, i) => Math.abs(v - s.feet[i]) > 1e-5)
      ) {
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
        navigationBuilds: cache.builds,
      });
  });
  return (
    <OrbitControls
      ref={orbit}
      makeDefault
      enabled={!walking && !dragging}
      minDistance={3}
      maxDistance={45}
      maxPolarAngle={Math.PI / 2 - 0.03}
      target={[0, 0.5, 0]}
    />
  );
}
