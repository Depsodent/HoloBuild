import { Vector3 } from "three";
import type { SceneObject } from "./objectTypes";
import type { StructureOperation } from "../../shared/editSchema.mjs";
import {
  frameMatrix,
  transformPart,
  structureInfo,
  members,
} from "./structures";
import { openingDefinitions, openingForGeometry } from "../generation/openings";
export function openingTarget(objects: SceneObject[], id: string) {
  const object = objects.find((o) => o.id === id);
  if (
    !object?.construction ||
    !["window", "door"].includes(object.construction.role)
  )
    return null;
  const info = structureInfo(members(objects, object.construction.structureId));
  const recipe = info.template ?? info.architectureTemplate;
  if (!recipe) return null;
  const local = transformPart(object, frameMatrix(info).invert());
  const current = openingForGeometry(
    recipe,
    {
      position: local.position,
      role: object.construction.role,
      level: object.construction.level,
      facade: object.construction.facade,
    },
    info.floorLayouts,
  );
  return current
    ? {
        object,
        info,
        recipe,
        current,
        definitions: openingDefinitions(recipe, info.floorLayouts),
      }
    : null;
}
export function openingOperation(
  objects: SceneObject[],
  id: string,
  operation: StructureOperation,
): StructureOperation {
  const target = openingTarget(objects, id);
  if (!target)
    throw Error(
      "The selected panel does not match a certified opening. Undo manual edits on its facade before continuing.",
    );
  const { object, info, current, definitions } = target;
  if (operation.type === "design") return operation;
  if (operation.type === "color" || operation.type === "material") {
    if (
      (operation.role && operation.role !== current.kind) ||
      (operation.level !== undefined && operation.level !== current.level)
    )
      throw Error("That role or floor differs from the selected opening.");
    return { ...operation, role: current.kind, opening: current.id };
  }
  if (operation.type === "delete")
    return {
      type: "design",
      openings: definitions.filter((d) => d.id !== current.id),
    };
  const next = { ...current };
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
  const side = current.facade === "left" || current.facade === "right";
  if (Math.abs(side ? local.x : local.z) > 1e-5)
    throw Error(
      "An opening must remain on its wall. Change its facade in the Opening Inspector.",
    );
  next.offset += side ? local.z : local.x;
  if (current.kind === "door" && Math.abs(local.y) > 1e-5)
    throw Error("A door opening must remain connected to its floor.");
  next.bottom += current.kind === "window" ? local.y : 0;
  const factors =
    operation.type === "scale"
      ? operation.factors
      : operation.type === "setTransform"
        ? operation.scale.map((v, i) => v / object.scale[i])
        : [1, 1, 1];
  next.width *= factors[0];
  next.height *= factors[1];
  if (current.kind === "window")
    next.bottom += (current.height - next.height) / 2;
  const angle =
    operation.type === "rotate"
      ? operation.angle
      : operation.type === "setTransform"
        ? operation.yaw - object.rotation[1]
        : 0;
  if (Math.abs(angle) > 1e-5)
    throw Error(
      "Opening orientation follows its wall. Choose another facade or rotate the whole building.",
    );
  if (!["move", "rotate", "scale", "setTransform"].includes(operation.type))
    throw Error("Use opening parameters for this operation.");
  if (
    (["offset", "bottom", "width", "height"] as const).every(
      (k) => Math.abs(next[k] - current[k]) < 1e-8,
    )
  )
    return { type: "move", delta: [0, 0, 0] };
  return {
    type: "design",
    openings: definitions.map((d) => (d.id === current.id ? next : d)),
  };
}
