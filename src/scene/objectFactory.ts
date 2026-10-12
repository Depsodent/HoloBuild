import type { SceneObject, Vec3 } from "./objectTypes";
export function createCube(position: Vec3 = [0, 0.5, 0]): SceneObject {
  return {
    id: crypto.randomUUID(),
    name: "Cube",
    type: "cube",
    position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: "#39dcca",
    material: "solid",
  };
}
