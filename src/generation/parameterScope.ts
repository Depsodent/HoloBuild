import type { StructureOperation } from "../../shared/editSchema.mjs";
import type { SceneObject } from "../scene/objectTypes";
import { openingTarget } from "../scene/openingTransform";
/** Model design arrays may contain unchanged context, never unrelated Part edits. */
export function selectedParameterScope(
  objects: SceneObject[],
  id: string,
  operation: StructureOperation,
): boolean {
  const object = objects.find((o) => o.id === id),
    recipe =
      object?.construction?.structure?.template ??
      object?.construction?.structure?.architectureTemplate;
  if (!object || !recipe) return false;
  const opening = openingTarget(objects, id);
  if (operation.type === "batch")
    return operation.operations.every((op) =>
      selectedParameterScope(objects, id, op),
    );
  if ((operation.type === "color" || operation.type === "material") && opening)
    return (
      operation.opening === opening.current.id &&
      (!operation.role || operation.role === opening.current.kind) &&
      (operation.level === undefined ||
        operation.level === opening.current.level)
    );
  if (operation.type !== "design") return false;
  const unchanged = (
    before: { id: string }[],
    after: { id: string }[],
    allowed: string[],
  ) => {
    const other = (list: { id: string }[]) =>
      list
        .filter((v) => !allowed.includes(v.id))
        .map((v) => JSON.stringify(v))
        .sort();
    return JSON.stringify(other(before)) === JSON.stringify(other(after));
  };
  const keys = Object.keys(operation).filter((k) => k !== "type");
  if (opening)
    return (
      keys.length === 1 &&
      keys[0] === "openings" &&
      !!operation.openings &&
      unchanged(opening.definitions, operation.openings, [opening.current.id])
    );
  const assembly = object.construction?.assembly;
  if (!assembly) return false;
  if (recipe.stairs?.some((s) => s.id === assembly))
    return (
      keys.length === 1 &&
      keys[0] === "stairs" &&
      !!operation.stairs &&
      unchanged(recipe.stairs, operation.stairs, [assembly])
    );
  const balcony = recipe.balconies?.find((b) => b.id === assembly);
  if (balcony) {
    if (
      keys.some((k) => !["balconies", "openings"].includes(k)) ||
      !operation.balconies
    )
      return false;
    const retained = operation.balconies.some((b) => b.id === assembly);
    return (
      unchanged(recipe.balconies!, operation.balconies, [assembly]) &&
      unchanged(
        recipe.openings ?? [],
        operation.openings ?? recipe.openings ?? [],
        retained || balcony.ownsAccess ? [balcony.access] : [],
      )
    );
  }
  return false;
}
