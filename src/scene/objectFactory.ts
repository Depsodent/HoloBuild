import type { ObjectType, SceneObject, Vec3 } from "./objectTypes";
export const SHAPES: Record<
  ObjectType,
  { name: string; size: Vec3; description: string }
> = {
  cube: { name: "Cube", size: [1, 1, 1], description: "1 × 1 × 1 m" },
  sphere: { name: "Sphere", size: [1, 1, 1], description: "Ø 1 m" },
  cylinder: { name: "Cylinder", size: [1, 1, 1], description: "Ø 1 × 1 m" },
  cone: { name: "Cone", size: [1, 1, 1], description: "Ø 1 × 1 m" },
  wall: { name: "Wall", size: [3, 2, 0.25], description: "3 × 2 × 0.25 m" },
  floor: { name: "Floor", size: [4, 0.2, 4], description: "4 × 0.2 × 4 m" },
};
export function createObject(type: ObjectType, position?: Vec3): SceneObject {
  return {
    id: crypto.randomUUID(),
    name: SHAPES[type].name,
    type,
    position: position ?? [0, SHAPES[type].size[1] / 2, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: "#39dcca",
    material: "solid",
  };
}
export function createCube(position?: Vec3): SceneObject {
  return createObject("cube", position);
}
export function objectSize(object: SceneObject): Vec3 {
  return object.type === "model"
    ? object.model!.size
    : SHAPES[object.type].size;
}
