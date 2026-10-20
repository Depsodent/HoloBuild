import { nativePartOperation } from "./nativeAssemblies";
import type { SceneObject } from "./objectTypes";
import type { StructureOperation } from "../../shared/editSchema.mjs";
import { balconyOperation } from "./balconyTransform";
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
  const info = objects.find((o) => o.id === id)?.construction?.structure;
  if (info?.standaloneStairs || info?.nativeWall)
    return nativePartOperation(objects, id, operation);
  return isOpeningPart(objects.find((o) => o.id === id))
    ? openingOperation(objects, id, operation)
    : objects.find((o) => o.id === id)?.construction?.role === "balcony"
      ? balconyOperation(objects, id, operation)
      : staircaseOperation(objects, id, operation);
}
