import { ObjectGeometry } from "./ObjectGeometry";
import { useRef, useState } from "react";
import { Edges, TransformControls } from "@react-three/drei";
import { Mesh } from "three";
import type { SceneObject, Vec3 } from "../../scene/objectTypes";
import { useSceneStore } from "../../scene/sceneStore";
import { execute } from "../../scene/commandManager";
import { useInteractionStore } from "../../interaction/interactionStore";
export function BuildingObject({ object }: { object: SceneObject }) {
  const ref = useRef<Mesh>(null);
  const [hover, setHover] = useState(false);
  const selected = useSceneStore((s) => s.selectedId === object.id);
  const tool = useSceneStore((s) => s.tool);
  const snap = useSceneStore((s) => s.snap);
  const gestureHover = useInteractionStore((s) => s.hoveredId === object.id);
  const grabbed = useSceneStore((s) => s.preview?.id === object.id);
  function commit() {
    const mesh = ref.current;
    if (mesh) {
      execute({
        type: "update",
        id: object.id,
        patch: {
          position: mesh.position.toArray() as Vec3,
          rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
          scale: mesh.scale.toArray() as Vec3,
        },
      });
      // Reflect validation/snapping even when rejected props did not change.
      const accepted = useSceneStore
        .getState()
        .objects.find((o) => o.id === object.id);
      if (accepted) {
        mesh.position.fromArray(accepted.position);
        mesh.rotation.set(...accepted.rotation);
        mesh.scale.fromArray(accepted.scale);
      }
    }
  }
  return (
    <>
      <mesh
        ref={ref}
        position={object.position}
        rotation={object.rotation}
        scale={object.scale}
        castShadow
        receiveShadow
        userData={{ objectId: object.id }}
        onClick={(e) => {
          e.stopPropagation();
          useSceneStore.getState().select(object.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
      >
        <ObjectGeometry type={object.type} />
        <meshStandardMaterial
          color={object.color}
          roughness={0.28}
          metalness={0.25}
          transparent={grabbed || object.material === "glass"}
          opacity={grabbed ? 0.2 : object.material === "glass" ? 0.45 : 1}
          emissive={object.color}
          emissiveIntensity={hover || gestureHover ? 0.3 : 0.04}
        />
        <Edges
          color={
            selected ? "#b8fff5" : hover || gestureHover ? "#64f7e6" : "#267f85"
          }
          lineWidth={selected ? 2 : 1}
        />
      </mesh>
      {selected && tool !== "select" && (
        <TransformControls
          object={ref as React.RefObject<Mesh>}
          mode={tool}
          translationSnap={snap ? 0.5 : null}
          rotationSnap={snap ? Math.PI / 12 : null}
          scaleSnap={snap ? 0.1 : null}
          onMouseUp={commit}
        />
      )}
    </>
  );
}
