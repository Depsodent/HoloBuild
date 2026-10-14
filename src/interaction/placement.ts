import { SHAPES } from "../scene/objectFactory";
import { Box3, Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { SceneObject, Vec3 } from "../scene/objectTypes";
import { snapCoordinate } from "./coordinateMapping";
export function bounds(object: SceneObject, position = object.position) {
  const matrix = new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromEuler(new Euler(...object.rotation)),
    new Vector3(...object.scale),
  );
  if (["sphere", "cylinder", "cone"].includes(object.type)) {
    // Support extents of transformed primitives. Unlike rotating their local
    // box, these keep sphere bounds tight and account for cone asymmetry.
    const e = matrix.elements;
    const min = new Vector3(),
      max = new Vector3();
    for (let axis = 0; axis < 3; axis++) {
      const x = e[axis],
        y = e[axis + 4],
        z = e[axis + 8];
      const radial = 0.5 * Math.hypot(x, z);
      let lo: number, hi: number;
      if (object.type === "sphere") {
        hi = 0.5 * Math.hypot(x, y, z);
        lo = -hi;
      } else if (object.type === "cylinder") {
        hi = radial + Math.abs(y) * 0.5;
        lo = -hi;
      } else {
        hi = Math.max(y * 0.5, -y * 0.5 + radial);
        lo = Math.min(y * 0.5, -y * 0.5 - radial);
      }
      min.setComponent(axis, position[axis] + lo);
      max.setComponent(axis, position[axis] + hi);
    }
    return new Box3(min, max);
  }
  return new Box3(
    new Vector3(...SHAPES[object.type].size).multiplyScalar(-0.5),
    new Vector3(...SHAPES[object.type].size).multiplyScalar(0.5),
  ).applyMatrix4(matrix);
}
export function placement(
  object: SceneObject,
  position: Vec3,
  objects: SceneObject[],
  snap: boolean,
) {
  const point: Vec3 = [
    snap ? snapCoordinate(position[0]) : position[0],
    position[1],
    snap ? snapCoordinate(position[2]) : position[2],
  ];
  if (point.some((v) => !Number.isFinite(v) || Math.abs(v) > 50))
    return { position: point, valid: false };
  const box = bounds(object, point);
  if (
    box.min.y < -0.01 ||
    [box.min.x, box.min.z, box.max.x, box.max.y, box.max.z].some(
      (v) => Math.abs(v) > 50,
    )
  )
    return { position: point, valid: false };
  const collision = objects.some((other) => {
    if (other.id === object.id) return false;
    const b = bounds(other);
    return (
      Math.min(box.max.x, b.max.x) - Math.max(box.min.x, b.min.x) > 0.02 &&
      Math.min(box.max.y, b.max.y) - Math.max(box.min.y, b.min.y) > 0.02 &&
      Math.min(box.max.z, b.max.z) - Math.max(box.min.z, b.min.z) > 0.02
    );
  });
  return { position: point, valid: !collision };
}
// Deterministic local search; creation/duplication either find a free position
// or fail atomically without an overlapping object or an undo entry.
export function findFreePosition(
  object: SceneObject,
  objects: SceneObject[],
): Vec3 | null {
  for (let radius = 0; radius <= 32; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const p: Vec3 = [
          object.position[0] + dx * 1.5,
          object.position[1],
          object.position[2] + dz * 1.5,
        ];
        const result = placement(object, p, objects, true);
        if (result.valid) return result.position;
      }
    }
  }
  return null;
}
