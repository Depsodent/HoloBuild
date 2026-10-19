import { Vector3 } from "three";
import type { SceneObject } from "./objectTypes";
import type { StructureOperation } from "../../shared/editSchema.mjs";
import { frameMatrix } from "./structures";
import { balconyOpeningChange } from "../generation/balconies";
export function balconyOperation(
  objects: SceneObject[],
  id: string,
  operation: StructureOperation,
): StructureOperation {
  const object = objects.find((o) => o.id === id),
    info = object?.construction?.structure,
    recipe = info?.template ?? info?.architectureTemplate;
  const current = recipe?.balconies?.find(
    (b) => b.id === object?.construction?.assembly,
  );
  if (!object || !info || !recipe || !current)
    throw Error("Select a certified balcony assembly.");
  if (
    (operation.type === "color" || operation.type === "material") &&
    ((operation.role && operation.role !== "balcony") ||
      (operation.level !== undefined && operation.level !== current.level))
  )
    throw Error("That role/floor differs from the selected balcony.");
  const next = { ...current };
  const side = current.facade === "left" || current.facade === "right";
  if (operation.type === "color") next.color = operation.color ?? "#ffffff";
  else if (operation.type === "material") next.material = operation.material;
  else if (operation.type !== "delete") {
    if (!["move", "scale", "rotate", "setTransform"].includes(operation.type))
      throw Error("Edit balcony parameters instead of individual rail pieces.");
    const delta =
      operation.type === "move"
        ? operation.delta
        : operation.type === "setTransform"
          ? operation.position.map((v, i) => v - object.position[i])
          : [0, 0, 0];
    const inverse = frameMatrix(info).invert();
    const local = new Vector3(...(delta as [number, number, number]))
      .applyMatrix4(inverse)
      .sub(new Vector3().applyMatrix4(inverse));
    if (Math.abs(local.y) > 1e-5 || Math.abs(side ? local.x : local.z) > 1e-5)
      throw Error(
        "A balcony must stay attached to its facade and floor; choose facade/floor in its Inspector.",
      );
    next.offset += side ? local.z : local.x;
    const factors =
      operation.type === "scale"
        ? operation.factors
        : operation.type === "setTransform"
          ? operation.scale.map((v, i) => v / object.scale[i])
          : [1, 1, 1];
    if (Math.abs(factors[1] - 1) > 1e-5)
      throw Error(
        "Keep balcony floor and rail heights fixed; edit rail height explicitly.",
      );
    next.width *= factors[side ? 2 : 0];
    next.depth *= factors[side ? 0 : 2];
    const angle =
      operation.type === "rotate"
        ? operation.angle
        : operation.type === "setTransform"
          ? operation.yaw - object.rotation[1]
          : 0;
    if (Math.abs(angle) > 1e-5)
      throw Error(
        "Balcony orientation follows its facade; rotate the whole structure instead.",
      );
    if (
      ["offset", "width", "depth"].every(
        (k) => Math.abs(next[k as "width"] - current[k as "width"]) < 1e-8,
      )
    )
      return { type: "move", delta: [0, 0, 0] };
  }
  const balconies =
    operation.type === "delete"
      ? recipe.balconies!.filter((b) => b.id !== current.id)
      : recipe.balconies!.map((b) => (b.id === current.id ? next : b));
  return {
    type: "design",
    balconies,
    openings: balconyOpeningChange(recipe, balconies),
  };
}
