import { anchorFurnitureTransform } from "../furniture/placement";
import { openingDefinitions, facadeAt } from "../generation/openings";
import { frameMatrix, transformPart } from "./structures";
import { Vector3 } from "three";
import { objectSize } from "./objectFactory";
import { bounds, placement } from "../interaction/placement";
import { objectSchema, type SceneObject, type Vec3 } from "./objectTypes";
import {
  isArchitecturalPart,
  architecturalOperation,
} from "./architecturalTransform";
import {
  applyStructure,
  members,
  structureInfo,
  structureBox,
} from "./structures";
import type { Command } from "./commandManager";
export function meters(value: number, unit = "m") {
  if (!Number.isFinite(value)) throw Error("Enter a finite measurement.");
  return (
    value *
    (/^(cm|centimeter)/i.test(unit)
      ? 0.01
      : /^(mm|millimeter)/i.test(unit)
        ? 0.001
        : 1)
  );
}
export function dimensions(o: SceneObject): Vec3 {
  return objectSize(o).map((v, i) => v * o.scale[i]) as Vec3;
}
export function protectConnectedPart(o: SceneObject) {
  const info = o.construction?.structure,
    recipe = info?.template ?? info?.architectureTemplate;
  if (!recipe || !o.construction) return;
  if (
    o.construction.role === "floor" &&
    (recipe.stairs?.length || recipe.balconies?.length)
  )
    throw Error(
      "This floor connects an architectural assembly. Use the building/floor parameters.",
    );
  if (o.construction.role !== "wall") return;
  const local = info ? transformPart(o, frameMatrix(info).invert()) : o;
  const facade =
    o.construction.facade ??
    facadeAt({ position: local.position, role: "wall" }, recipe);
  if (
    openingDefinitions(recipe, info?.floorLayouts).some(
      (d) => d.level === o.construction!.level && d.facade === facade,
    )
  )
    throw Error(
      "This wall contains a connected opening. Edit the opening parameters or transform the whole structure so walls and panels stay connected.",
    );
}
export function precisionUpdate(
  objects: SceneObject[],
  o: SceneObject,
  patch: Partial<SceneObject>,
) {
  const transform = patch.position || patch.rotation || patch.scale;
  if (transform) protectConnectedPart(o);
  if (transform && isArchitecturalPart(o)) {
    if (
      patch.rotation &&
      [0, 2].some((i) => Math.abs(patch.rotation![i] - o.rotation[i]) > 1e-6)
    )
      throw Error(
        "Architectural orientation follows its connection; only supported yaw/parameter edits are allowed.",
      );
    const operation = architecturalOperation(objects, o.id, {
      type: "setTransform",
      position: patch.position ?? o.position,
      yaw: patch.rotation?.[1] ?? o.rotation[1],
      scale: patch.scale ?? o.scale,
    });
    const result = applyStructure(
      objects,
      o.construction!.structureId,
      operation,
      false,
    );
    return {
      command: {
        type: "structure",
        structureId: o.construction!.structureId,
        operation,
        snap: false,
      } as Command,
      objects: result.objects,
      parts: result.parts,
    };
  }
  const parsed = objectSchema.safeParse({ ...o, ...patch });
  if (!parsed.success)
    throw Error(
      "Invalid transform or surface: use finite coordinates, scale 0.1–20 and optical values in their displayed ranges.",
    );
  let candidate = parsed.data;
  if (
    (patch.scale || patch.rotation) &&
    !patch.position &&
    (Math.abs(bounds(o).min.y) < 0.01 || !!o.furniture)
  )
    candidate = o.furniture
      ? anchorFurnitureTransform(o, candidate)
      : {
          ...candidate,
          position: [
            candidate.position[0],
            candidate.position[1] - bounds(candidate).min.y,
            candidate.position[2],
          ],
        };
  if (transform) {
    const p = placement(candidate, candidate.position, objects, false);
    if (!p.valid)
      throw Error(
        "Invalid placement: collision, floor or workspace boundary. Scene unchanged.",
      );
  }
  return {
    command: {
      type: "update",
      id: o.id,
      patch: {
        ...patch,
        ...(transform ? { position: candidate.position } : {}),
      },
      precise: true,
    } as Command,
    objects: objects.map((v) => (v.id === o.id ? candidate : v)),
    parts: [candidate],
  };
}
export function dimensionPatch(o: SceneObject, axis: number, value: number) {
  if (!Number.isFinite(value) || value <= 0)
    throw Error("Dimensions must be positive metres.");
  const scale = [...o.scale] as Vec3;
  scale[axis] = value / objectSize(o)[axis];
  return { scale };
}
export function floorPosition(o: SceneObject, objects: SceneObject[]): Vec3 {
  protectConnectedPart(o);
  if (isArchitecturalPart(o))
    throw Error(
      "Connected assemblies must use their floor/connection parameters.",
    );
  const b = bounds(o);
  const surfaces = objects
    .filter((v) => v.id !== o.id && v.type === "floor" && !v.construction)
    .map((v) => bounds(v))
    .filter(
      (v) =>
        v.min.x <= b.min.x + 0.001 &&
        v.max.x >= b.max.x - 0.001 &&
        v.min.z <= b.min.z + 0.001 &&
        v.max.z >= b.max.z - 0.001 &&
        v.max.y <= b.min.y + 0.25,
    );
  const top = Math.max(0, ...surfaces.map((v) => v.max.y));
  return [o.position[0], o.position[1] + top - b.min.y, o.position[2]];
}
export function structureDimensions(objects: SceneObject[], id: string): Vec3 {
  return structureBox(members(objects, id))
    .getSize(new Vector3())
    .toArray() as Vec3;
}
export function structureDimensionOperation(
  objects: SceneObject[],
  id: string,
  axis: number,
  value: number,
) {
  if (!Number.isFinite(value) || value <= 0)
    throw Error("Dimensions must be positive metres.");
  const info = structureInfo(members(objects, id));
  if (Math.abs(info.yaw) > 1e-6)
    throw Error(
      "Set structure yaw to zero before editing world dimensions; use scale for rotated structures.",
    );
  const factors: [number, number, number] = [1, 1, 1];
  factors[axis] = value / structureDimensions(objects, id)[axis];
  return { type: "scale" as const, factors };
}

/** Exact face alignment for axis-aligned standalone boxes only. */
export function edgePosition(
  o: SceneObject,
  target: SceneObject,
  edge: "left" | "right" | "front" | "back",
): Vec3 {
  for (const p of [o, target])
    if (
      p.construction ||
      p.model ||
      !["cube", "wall", "floor"].includes(p.type) ||
      p.rotation.some((v) => Math.abs(v) > 1e-6)
    )
      throw Error(
        "Edge alignment supports axis-aligned standalone cubes, walls and floors; use connected architectural parameters for buildings.",
      );
  if (o.id === target.id) throw Error("Choose another alignment object.");
  const a = bounds(o),
    b = bounds(target),
    axis = edge === "left" || edge === "right" ? 0 : 2;
  const shift =
    edge === "left"
      ? b.min.x - a.max.x
      : edge === "right"
        ? b.max.x - a.min.x
        : edge === "front"
          ? b.min.z - a.max.z
          : b.max.z - a.min.z;
  const position = [...o.position] as Vec3;
  position[axis] += shift;
  return position;
}
