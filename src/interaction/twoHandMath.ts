import { anchorFurnitureTransform } from "../furniture/placement";
import { Euler, Quaternion, Vector3 } from "three";
import type { RecognizedHand } from "../vision/handRecognizer";
import type { SceneObject, Vec3 } from "../scene/objectTypes";
import { bounds, placement } from "./placement";
export function handReference(hand: RecognizedHand) {
  const a = hand.landmarks[4],
    b = hand.landmarks[8];
  return { x: 1 - (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
export function handDistance(
  a: RecognizedHand,
  b: RecognizedHand,
  aspect: number,
) {
  const p = handReference(a),
    q = handReference(b);
  return Math.hypot(q.x - p.x, (q.y - p.y) / aspect);
}
export function boundedFactor(scale: Vec3, factor: number) {
  return Math.max(
    Math.max(...scale.map((s) => 0.1 / s)),
    Math.min(Math.min(...scale.map((s) => 20 / s)), factor),
  );
}
export function transformedPlacement(
  original: SceneObject,
  scale: Vec3,
  rotation: Vec3,
  objects: SceneObject[],
  snap = false,
) {
  let candidate = {
    ...original,
    position: [...original.position] as Vec3,
    scale,
    rotation,
  };
  if (original.furniture)
    candidate = anchorFurnitureTransform(original, candidate);
  else if (Math.abs(bounds(original).min.y) < 0.01)
    candidate.position[1] -= bounds(candidate).min.y;
  const result = placement(candidate, candidate.position, objects, snap);
  return { ...candidate, position: result.position, valid: result.valid };
}
export function handAngle(
  a: RecognizedHand,
  b: RecognizedHand,
  aspect: number,
) {
  const p = handReference(a),
    q = handReference(b);
  return Math.atan2((q.y - p.y) / aspect, q.x - p.x);
}
export function angleDelta(next: number, previous: number) {
  return Math.atan2(Math.sin(next - previous), Math.cos(next - previous));
}
export function yawRotation(rotation: Vec3, angle: number): Vec3 {
  const q = new Quaternion()
    .setFromAxisAngle(new Vector3(0, 1, 0), angle)
    .multiply(new Quaternion().setFromEuler(new Euler(...rotation)));
  const e = new Euler().setFromQuaternion(q, "XYZ");
  return [e.x, e.y, e.z];
}
