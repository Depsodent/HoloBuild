import { useSceneStore, type Preview } from "../scene/sceneStore";
import { applyStructure } from "../scene/structures";
import { execute } from "../scene/commandManager";
import type { Vec3 } from "../scene/objectTypes";
import type { StructureOperation } from "../../shared/editSchema.mjs";
export function groupPreview(
  id: string,
  operation: StructureOperation,
): Preview | null {
  const s = useSceneStore.getState(),
    object = s.objects.find((o) => o.id === id);
  const group = s.selectedStructureId;
  if (!group || object?.construction?.structureId !== group) return null;
  try {
    const result = applyStructure(s.objects, group, operation, s.snap),
      anchor = result.parts.find((o) => o.id === id)!;
    return {
      id,
      position: anchor.position,
      rotation: anchor.rotation,
      scale: anchor.scale,
      valid: true,
      structure: { id: group, objects: result.parts, operation },
    };
  } catch {
    return {
      id,
      position: object.position,
      valid: false,
      structure: { id: group, objects: [], operation },
    };
  }
}
export function moveGroupPreview(id: string, position: Vec3) {
  const object = useSceneStore.getState().objects.find((o) => o.id === id);
  return object
    ? groupPreview(id, {
        type: "move",
        delta: position.map((v, i) => v - object.position[i]) as Vec3,
      })
    : null;
}
export function commitPlacement(preview: Preview) {
  if (!preview.valid) return false;
  if (preview.structure)
    return execute({
      type: "structure",
      structureId: preview.structure.id,
      operation: preview.structure.operation,
    });
  return execute({
    type: "update",
    id: preview.id,
    patch: {
      position: preview.position,
      ...(preview.scale ? { scale: preview.scale } : {}),
      ...(preview.rotation ? { rotation: preview.rotation } : {}),
    },
  });
}
