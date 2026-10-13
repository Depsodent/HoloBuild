import { Box3, Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { SceneObject, Vec3 } from "../scene/objectTypes";
import { snapCoordinate } from "./coordinateMapping";
export function bounds(object: SceneObject, position = object.position) {
  const matrix = new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromEuler(new Euler(...object.rotation)),
    new Vector3(...object.scale),
  );
  return new Box3(
    new Vector3(-0.5, -0.5, -0.5),
    new Vector3(0.5, 0.5, 0.5),
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
  if (box.min.y < -0.01) return { position: point, valid: false };
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
