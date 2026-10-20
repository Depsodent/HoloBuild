import { isPassableDoor } from "../../exploration/navigation";
import { useViewStore } from "../../exploration/viewStore";
import { updateMouseGuide, clearMouseGuide } from "../../scene/precisionGuide";
import { usePrecisionSettings } from "../../scene/precisionSettings";
import { isArchitecturalPart } from "../../scene/architecturalTransform";
import { useLeftStore } from "../../workspace/leftStore";
import { ObjectGeometry } from "./ObjectGeometry";
import { SurfaceMaterial } from "./SurfaceMaterial";
import { ImportedModel } from "./ImportedModel";
import { useRef, useState, useEffect, memo } from "react";
import { useThree } from "@react-three/fiber";
import { Edges, TransformControls } from "@react-three/drei";
import { Mesh } from "three";
import type { SceneObject, Vec3 } from "../../scene/objectTypes";
import { useSceneStore } from "../../scene/sceneStore";
import { execute } from "../../scene/commandManager";
import { useInteractionStore } from "../../interaction/interactionStore";
export const BuildingObject = memo(function BuildingObject({
  object,
}: {
  object: SceneObject;
}) {
  const walking = useViewStore((s) => s.walking);
  const readOnly = useViewStore((s) => s.walking);
  const gridStep = usePrecisionSettings((s) => s.gridStep);
  const gl = useThree((s) => s.gl);
  const ref = useRef<Mesh>(null);
  const dragBase = useRef<SceneObject[] | null>(null);
  const cancelled = useRef(false);
  const [hover, setHover] = useState(false);
  const selected =
    useSceneStore((s) => s.selectedId === object.id) && !readOnly;
  useEffect(() => {
    if (!selected && dragBase.current) {
      cancelled.current = true;
      dragBase.current = null;
      const mesh = ref.current;
      if (mesh) {
        mesh.position.fromArray(object.position);
        mesh.rotation.set(...object.rotation);
        mesh.scale.fromArray(object.scale);
      }
    }
  }, [selected, object]);
  const group = useSceneStore(
    (s) => s.selectedId === object.id && !!s.selectedStructureId,
  );
  const groupSelected =
    useSceneStore(
      (s) =>
        !!s.selectedStructureId &&
        object.construction?.structureId === s.selectedStructureId,
    ) && !readOnly;
  const tool = useSceneStore((s) =>
    s.selectedId === object.id ? s.tool : "select",
  );
  const snap = useSceneStore((s) => s.selectedId === object.id && s.snap);
  const gestureHover = useInteractionStore((s) => s.hoveredId === object.id);
  const grabbed = useSceneStore((s) => s.preview?.id === object.id);
  useEffect(() => {
    if (
      !selected ||
      group ||
      grabbed ||
      isArchitecturalPart(object) ||
      tool === "select"
    )
      return;
    const cancel = (e: Event) => {
      if (
        !dragBase.current ||
        (e instanceof KeyboardEvent && e.key !== "Escape")
      )
        return;
      clearMouseGuide(object.id);
      cancelled.current = true;
      dragBase.current = null;
      const accepted = useSceneStore
        .getState()
        .objects.find((v) => v.id === object.id);
      if (ref.current && accepted) {
        ref.current.position.fromArray(accepted.position);
        ref.current.rotation.set(...accepted.rotation);
        ref.current.scale.fromArray(accepted.scale);
      }
      useSceneStore.getState().setTool("select");
    };
    window.addEventListener("keydown", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("keydown", cancel);
      window.removeEventListener("blur", cancel);
      clearMouseGuide(object.id);
    };
  }, [object, selected, group, grabbed, tool]);
  function commit() {
    clearMouseGuide(object.id);
    const mesh = ref.current;
    if (mesh) {
      const stale =
        cancelled.current ||
        (dragBase.current &&
          dragBase.current !== useSceneStore.getState().objects);
      dragBase.current = null;
      if (!stale)
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
        castShadow={object.type !== "model"}
        receiveShadow
        visible={!(walking && isPassableDoor(object))}
        userData={{ objectId: object.id }}
        onClick={(e) => {
          e.stopPropagation();
          if (readOnly) return;
          useSceneStore.getState().select(object.id);
          if (useSceneStore.getState().selectedStructureId)
            useLeftStore.getState().setTab("inspector");
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (!readOnly) setHover(true);
        }}
        onPointerOut={() => setHover(false)}
      >
        <ObjectGeometry type={object.type} size={object.model?.size} />
        {object.type === "model" ? (
          <>
            <meshBasicMaterial
              transparent
              opacity={0}
              depthWrite={false}
              colorWrite={false}
            />
            <ImportedModel
              object={object}
              grabbed={grabbed}
              highlight={!readOnly && (hover || gestureHover)}
            />
          </>
        ) : (
          <SurfaceMaterial
            object={object}
            grabbed={grabbed}
            highlight={hover || gestureHover}
          />
        )}
        <Edges
          color={
            groupSelected
              ? "#ffd782"
              : selected
                ? "#b8fff5"
                : hover || gestureHover
                  ? "#64f7e6"
                  : object.material === "holographic"
                    ? "#00dfff"
                    : "#267f85"
          }
          lineWidth={
            selected || groupSelected
              ? 2
              : object.material === "holographic"
                ? 1.5
                : 1
          }
        />
      </mesh>
      {selected &&
        !group &&
        !grabbed &&
        !isArchitecturalPart(object) &&
        tool !== "select" && (
          <TransformControls
            object={ref as React.RefObject<Mesh>}
            mode={tool}
            translationSnap={snap ? gridStep : null}
            rotationSnap={snap ? Math.PI / 12 : null}
            scaleSnap={snap ? 0.1 : null}
            onObjectChange={() => {
              gl.shadowMap.needsUpdate = true;
              if (dragBase.current && ref.current)
                updateMouseGuide(
                  {
                    ...object,
                    position: ref.current.position.toArray() as Vec3,
                    rotation: [
                      ref.current.rotation.x,
                      ref.current.rotation.y,
                      ref.current.rotation.z,
                    ],
                    scale: ref.current.scale.toArray() as Vec3,
                  },
                  useSceneStore.getState().objects,
                  snap,
                );
            }}
            onMouseDown={() => {
              dragBase.current = useSceneStore.getState().objects;
              cancelled.current = false;
            }}
            onMouseUp={commit}
          />
        )}
    </>
  );
});
