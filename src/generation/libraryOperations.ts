import {
  staircaseSchema,
  balconySchema,
  type Staircase,
  type BuildingTemplate,
  type Balcony,
} from "../../shared/planSchema.mjs";
import type { StructureOperation } from "../../shared/editSchema.mjs";
import type { SceneObject } from "../scene/objectTypes";
import { balconyIntent } from "./balconyIntent";
export function insertStaircase(
  recipe: BuildingTemplate,
  values: Omit<Staircase, "id" | "rise">,
): StructureOperation {
  if (!["house", "tower", "office"].includes(recipe.kind) || recipe.floors < 2)
    throw Error(
      "Stairs require an existing multi-floor house, tower or office. Freestanding stairs are not supported.",
    );
  if (recipe.stairs?.some((v) => v.to === values.to))
    throw Error(
      "That floor already has a staircase opening. Choose a different destination floor or edit the existing stairs.",
    );
  let n = 1;
  while (recipe.stairs?.some((v) => v.id === "stairs-" + n)) n++;
  const stair = staircaseSchema.parse({
    ...values,
    id: "stairs-" + n,
    rise: (recipe.height + 0.2) / values.steps,
  });
  return { type: "design", stairs: [...(recipe.stairs ?? []), stair] };
}
export function insertBalcony(
  recipe: BuildingTemplate,
  values: Pick<
    Balcony,
    | "level"
    | "facade"
    | "offset"
    | "width"
    | "depth"
    | "railHeight"
    | "material"
    | "color"
  >,
): StructureOperation {
  balconySchema.parse({
    ...values,
    id: "library-check",
    access: "library-entry",
    ownsAccess: true,
  });
  const result = balconyIntent(
    "Add balcony on " +
      (values.level + 1) +
      " floor " +
      values.facade +
      " facade width " +
      values.width +
      " depth " +
      values.depth +
      " rail height " +
      values.railHeight +
      " offset " +
      values.offset,
    recipe,
  );
  if (!result?.operation || result.operation.type !== "design")
    throw Error(result?.message ?? "Choose a compatible building facade.");
  const old = new Set(recipe.balconies?.map((b) => b.id));
  return {
    ...result.operation,
    balconies: result.operation.balconies!.map((b) =>
      old.has(b.id)
        ? b
        : { ...b, material: values.material, color: values.color },
    ),
  };
}
export function duplicateAssembly(
  objects: SceneObject[],
  id: string,
): StructureOperation | null {
  const o = objects.find((v) => v.id === id),
    c = o?.construction,
    recipe = c?.structure?.template ?? c?.structure?.architectureTemplate;
  if (!recipe || !c?.assembly) return null;
  if (c.role === "stair") {
    const stair = recipe.stairs?.find((v) => v.id === c.assembly);
    if (!stair) throw Error("Staircase parameters unavailable.");
    const to = Array.from({ length: recipe.floors - 1 }, (_, i) => i + 1).find(
      (level) => !recipe.stairs?.some((v) => v.to === level),
    );
    if (to === undefined)
      throw Error(
        "Duplicating stairs requires an unused adjacent-floor connection. Add a floor or duplicate the whole building instead.",
      );
    return insertStaircase(recipe, {
      ...stair,
      from: to - 1,
      to,
      x: Math.abs(stair.x) > 0.1 ? -stair.x : stair.width + 0.6,
    });
  }
  if (c.role === "balcony") {
    const b = recipe.balconies?.find((v) => v.id === c.assembly);
    if (!b) throw Error("Balcony parameters unavailable.");
    const opposite = {
      front: "back",
      back: "front",
      left: "right",
      right: "left",
    } as const;
    return insertBalcony(recipe, { ...b, facade: opposite[b.facade] });
  }
  return null;
}
