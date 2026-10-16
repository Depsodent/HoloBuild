import { useRef } from "react";
import { TransformControls } from "@react-three/drei";
import { Group } from "three";
import { useSceneStore } from "../../scene/sceneStore";
import { members, structureInfo } from "../../scene/structures";
import { execute } from "../../scene/commandManager";
import { groupPreview } from "../../interaction/structureInteraction";
import type { Vec3 } from "../../scene/objectTypes";
export function StructureControls() {
  const id = useSceneStore((s) => s.selectedStructureId),
    objects = useSceneStore((s) => s.objects),
    tool = useSceneStore((s) => s.tool),
    snap = useSceneStore((s) => s.snap);
  const ref = useRef<Group>(null),
    dragging = useRef(false);
  const parts = id ? members(objects, id) : [];
  if (!id || !parts.length || tool === "select") return null;
  const info = structureInfo(parts);
  const operation = () => ({
    type: "setTransform" as const,
    position: ref.current!.position.toArray() as Vec3,
    yaw: Math.atan2(
      Math.sin(ref.current!.rotation.y),
      Math.cos(ref.current!.rotation.y),
    ),
    scale: ref.current!.scale.toArray() as Vec3,
  });
  function restore() {
    const mesh = ref.current;
    if (mesh) {
      mesh.position.fromArray(info.position);
      mesh.rotation.set(0, info.yaw, 0);
      mesh.scale.fromArray(info.scale);
    }
  }
  return (
    <>
      <group
        ref={ref}
        position={info.position}
        rotation={[0, info.yaw, 0]}
        scale={info.scale}
      />
      <TransformControls
        object={ref as React.RefObject<Group>}
        mode={tool}
        space={tool === "scale" ? "local" : "world"}
        showX={tool !== "rotate"}
        showZ={tool !== "rotate"}
        translationSnap={snap ? 0.5 : null}
        rotationSnap={snap ? Math.PI / 12 : null}
        scaleSnap={snap ? 0.1 : null}
        onMouseDown={() => {
          dragging.current = true;
        }}
        onObjectChange={() => {
          if (dragging.current && ref.current) {
            const preview = groupPreview(parts[0].id, operation());
            useSceneStore.setState({ preview });
          }
        }}
        onMouseUp={() => {
          dragging.current = false;
          if (ref.current)
            execute({
              type: "structure",
              structureId: id,
              operation: operation(),
            });
          useSceneStore.setState({ preview: null });
          restore();
        }}
      />
    </>
  );
}
