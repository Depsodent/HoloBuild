import { FURNITURE } from "../../shared/furnitureCatalog.mjs";
import {
  objectSchema,
  type SceneObject,
  type Vec3,
} from "../scene/objectTypes";
export function createFurniture(
  preset: string,
  base: Vec3 = [0, 0, 0],
  yaw = 0,
): SceneObject {
  const d = FURNITURE[preset];
  if (!d) throw Error("Choose a registered furniture preset.");
  return objectSchema.parse({
    id: crypto.randomUUID(),
    name: d.name,
    type: "furniture",
    furniture: { preset },
    position: [base[0], base[1] + d.size[1] / 2, base[2]],
    rotation: [0, yaw, 0],
    scale: [1, 1, 1],
    color: d.color,
    material: d.material,
  });
}
