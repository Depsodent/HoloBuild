import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Raycaster, Vector2, Vector3, Plane, type Object3D } from "three";
import {
  useFurnishStore,
  updateFurniture,
  rotateFurniture,
  confirmFurniture,
  cancelFurniture,
} from "../../furniture/furnishStore";
import { attachmentCandidate } from "../../furniture/placement";
import { useSceneStore } from "../../scene/sceneStore";
import { snapCoordinate } from "../../interaction/coordinateMapping";
import type { Vec3, SceneObject } from "../../scene/objectTypes";
import { FurnitureVisual } from "./FurnitureVisual";
export function FurnishInteraction() {
  const { camera, scene, gl, pointer } = useThree(),
    draft = useFurnishStore((s) => s.draft),
    valid = useFurnishStore((s) => s.valid);
  const tools = useMemo(
    () => ({
      ray: new Raycaster(),
      ndc: new Vector2(),
      point: new Vector3(),
      normal: new Vector3(),
      ground: new Plane(new Vector3(0, 1, 0), 0),
    }),
    [],
  );
  const hasDraft = !!draft;
  const last = useRef(0),
    cache = useRef<{ objects: SceneObject[] | null; roots: Object3D[] }>({
      objects: null,
      roots: [],
    });
  useEffect(() => {
    if (!hasDraft) return;
    const click = () => {
      if (useFurnishStore.getState().draft) confirmFurniture();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelFurniture();
        return;
      }
      if (
        (e.target as HTMLElement)?.closest?.(
          "input,select,textarea,button,[contenteditable=true]",
        ) ||
        e.ctrlKey ||
        e.altKey ||
        e.metaKey ||
        e.repeat
      )
        return;
      if (e.key === "Enter") {
        e.preventDefault();
        confirmFurniture();
      }
      if (/^[qe]$/i.test(e.key)) {
        e.preventDefault();
        rotateFurniture(
          e.key.toLowerCase() === "q" ? -Math.PI / 12 : Math.PI / 12,
        );
      }
    };
    gl.domElement.addEventListener("click", click);
    window.addEventListener("keydown", key);
    return () => {
      gl.domElement.removeEventListener("click", click);
      window.removeEventListener("keydown", key);
    };
  }, [hasDraft, gl]);
  useFrame(() => {
    const current = useFurnishStore.getState().draft;
    if (!current) return;
    const now = performance.now();
    if (now - last.current < 40) return;
    last.current = now;
    const objects = useSceneStore.getState().objects;
    if (cache.current.objects !== objects) {
      const roots: Object3D[] = [];
      scene.traverse((o) => {
        if (o.userData.objectId) roots.push(o);
      });
      cache.current = { objects, roots };
    }
    if (document.pointerLockElement === gl.domElement) tools.ndc.set(0, 0);
    else tools.ndc.copy(pointer);
    tools.ray.setFromCamera(tools.ndc, camera);
    const hits = tools.ray.intersectObjects(
      cache.current.roots.filter((o) => o.visible && o.userData.objectId !== current.id),
      false,
    );
    const ground = tools.ray.ray.intersectPlane(tools.ground, tools.point);
    const hit = hits[0];
    let p: Vec3 | null = null,
      normal: Vec3 = [0, 1, 0];
    if (
      hit &&
      hit.distance < 12 &&
      (!ground || hit.distance <= tools.ray.ray.origin.distanceTo(ground))
    ) {
      p = hit.point.toArray() as Vec3;
      normal = tools.normal
        .copy(hit.face?.normal ?? new Vector3(0, 1, 0))
        .transformDirection(hit.object.matrixWorld)
        .toArray() as Vec3;
    } else if (ground && tools.ray.ray.origin.distanceTo(ground) < 12)
      p = ground.toArray() as Vec3;
    if (p) {
      if (useSceneStore.getState().snap && normal[1] > 0.99) {
        p[0] = snapCoordinate(p[0]);
        p[2] = snapCoordinate(p[2]);
      }
      updateFurniture(attachmentCandidate(current, p, normal));
    } else updateFurniture(null);
  });
  if (!draft) return null;
  return (
    <group
      position={draft.position}
      rotation={draft.rotation}
      scale={draft.scale}
      userData={{ furniturePreview: true }}
    >
      <FurnitureVisual
        object={{ ...draft, color: valid ? "#72ffce" : "#ff6c83" }}
        ghost
      />
    </group>
  );
}
