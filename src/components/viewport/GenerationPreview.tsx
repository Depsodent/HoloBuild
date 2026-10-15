import { useMemo, useEffect } from "react";
import {
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  ConeGeometry,
  MeshBasicMaterial,
} from "three";
import { Box3, Vector3, PerspectiveCamera } from "three";
import { useThree } from "@react-three/fiber";
import { bounds } from "../../interaction/placement";
import { useSceneStore } from "../../scene/sceneStore";
import { SHAPES } from "../../scene/objectFactory";
import { useGenerationStore } from "../../generation/generationStore";
export function GenerationPreview() {
  const { camera, controls } = useThree();
  useEffect(() => {
    const fit = () => {
      const state = useGenerationStore.getState(),
        scene = useSceneStore.getState();
      if (scene.preview || !(camera instanceof PerspectiveCamera) || !controls)
        return;
      const parts =
        state.prepared?.objects ??
        scene.objects.filter(
          (o) => o.construction?.structureId === state.lastStructureId,
        );
      if (!parts.length) return;
      const box = new Box3();
      parts.forEach((o) => box.union(bounds(o)));
      const center = box.getCenter(new Vector3()),
        radius = box.getSize(new Vector3()).length() / 2;
      const orbit = controls as unknown as {
        target: Vector3;
        maxDistance: number;
        update: () => void;
      };
      const angle = Math.min(
        (camera.fov * Math.PI) / 360,
        Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect),
      );
      const distance = Math.max(4, (radius / Math.sin(angle)) * 1.15),
        direction = camera.position.clone().sub(orbit.target).normalize();
      camera.position.copy(center).addScaledVector(direction, distance);
      orbit.target.copy(center);
      orbit.maxDistance = Math.max(45, distance * 1.1);
      orbit.update();
    };
    window.addEventListener("holobuild:fit-structure", fit);
    return () => window.removeEventListener("holobuild:fit-structure", fit);
  }, [camera, controls]);
  const prepared = useGenerationStore((s) => s.prepared),
    visible = useGenerationStore((s) => s.ghost);
  const pool = useMemo(
    () => ({
      cube: new BoxGeometry(),
      sphere: new SphereGeometry(0.5, 16, 12),
      cylinder: new CylinderGeometry(0.5, 0.5, 1, 16),
      cone: new ConeGeometry(0.5, 1, 16),
      wall: new BoxGeometry(...SHAPES.wall.size),
      floor: new BoxGeometry(...SHAPES.floor.size),
    }),
    [],
  );
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#59ead6",
        wireframe: true,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(pool).forEach((g) => g.dispose());
      material.dispose();
    },
    [pool, material],
  );
  if (!prepared || !visible) return null;
  return (
    <group>
      {prepared.objects.map((o) => (
        <mesh
          key={o.id}
          position={o.position}
          rotation={o.rotation}
          scale={o.scale}
          geometry={pool[o.type as keyof typeof pool]}
          material={material}
          raycast={() => {}}
          dispose={null}
        />
      ))}
    </group>
  );
}
