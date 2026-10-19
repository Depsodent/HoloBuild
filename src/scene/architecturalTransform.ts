import type { SceneObject } from "./objectTypes";
import type { StructureOperation } from "../../shared/editSchema.mjs";
import { staircaseOperation } from "./staircaseTransform";
import { openingOperation } from "./openingTransform";
export function isOpeningPart(object: SceneObject | undefined) {
  return (
    !!object?.construction &&
    ["door", "window"].includes(object.construction.role) &&
    !!(
      object.construction.structure?.template ??
      object.construction.structure?.architectureTemplate
    )
  );
}
export function isArchitecturalPart(object: SceneObject | undefined) {
  return !!object?.construction?.assembly || isOpeningPart(object);
}
export function architecturalOperation(
  objects: SceneObject[],
  id: string,
  operation: StructureOperation,
) {
  return isOpeningPart(objects.find((o) => o.id === id))
    ? openingOperation(objects, id, operation)
    : staircaseOperation(objects, id, operation);
}
