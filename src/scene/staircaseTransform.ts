import { Vector3 } from "three";
import type { SceneObject } from "./objectTypes";
import type { StructureOperation } from "../../shared/editSchema.mjs";
import { frameMatrix } from "./structures";
/** Convert assembly manipulation to recipe edits so the slab void moves with it. */
export function staircaseOperation(
  objects: SceneObject[],
  id: string,
  operation: StructureOperation,
): StructureOperation {
  const object = objects.find((o) => o.id === id),
    info = object?.construction?.structure;
  const template = info?.template ?? info?.architectureTemplate;
  const current = template?.stairs?.find(
    (s) => s.id === object?.construction?.assembly,
  );
  if (!object || !info || !current)
    throw Error("Select a certified staircase assembly.");
  if (operation.type === "design") return operation;
  const next = { ...current };
  const delta =
    operation.type === "move"
      ? operation.delta
      : operation.type === "setTransform"
        ? operation.position.map((n, i) => n - object.position[i])
        : [0, 0, 0];
  const inverse = frameMatrix(info).invert();
  const local = new Vector3(...(delta as [number, number, number]))
    .applyMatrix4(inverse)
    .sub(new Vector3().applyMatrix4(inverse));
  if (Math.abs(local.y) > 1e-5)
    throw Error(
      "Staircase height is tied to its floors; move it horizontally or edit its destination floor.",
    );
  next.x += local.x;
  next.z += local.z;
  const factors =
    operation.type === "scale"
      ? operation.factors
      : operation.type === "setTransform"
        ? operation.scale.map((n, i) => n / object.scale[i])
        : [1, 1, 1];
  if (Math.abs(factors[1] - 1) > 1e-5)
    throw Error(
      "Keep staircase floor elevations fixed. Resize its width/run, or transform the whole building.",
    );
  next.width *= factors[0];
  next.run *= factors[2];
  const angle =
    operation.type === "rotate"
      ? operation.angle
      : operation.type === "setTransform"
        ? operation.yaw - object.rotation[1]
        : 0;
  const degrees = current.yaw + (angle * 180) / Math.PI;
  const quarter = Math.round(degrees / 90) * 90;
  if (Math.abs(degrees - quarter) > 1e-4)
    throw Error(
      "Straight staircase openings support quarter-turn orientations.",
    );
  next.yaw = (((quarter % 360) + 360) % 360) as typeof next.yaw;
  if (!["move", "rotate", "scale", "setTransform"].includes(operation.type))
    throw Error("Use staircase parameters for assembly edits.");
  if (
    (["x", "z", "width", "run"] as const).every(
      (k) => Math.abs(next[k] - current[k]) < 1e-8,
    ) &&
    next.yaw === current.yaw
  )
    return { type: "move", delta: [0, 0, 0] };
  return {
    type: "design",
    stairs: template!.stairs!.map((s) => (s.id === current.id ? next : s)),
  };
}
