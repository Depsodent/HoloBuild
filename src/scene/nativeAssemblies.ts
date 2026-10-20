import { Vector3, Matrix4, Quaternion, Euler } from "three";
import { stairParts } from "../generation/architecture";
import { openingPlan } from "../generation/openings";
import { createObject, objectSize } from "./objectFactory";
import {
  objectSchema,
  type SceneObject,
  type StructureMetadata,
  type Vec3,
} from "./objectTypes";
import type {
  BuildingTemplate,
  ConstructionPlan,
} from "../../shared/planSchema.mjs";
import {
  standaloneStairSchema,
  nativeWallSchema,
} from "../../shared/nativeSchema.mjs";
import {
  frameMatrix,
  transformPart,
  structureInfo,
  members,
  validateStructure,
} from "./structures";
import { bounds } from "../interaction/placement";
export function nativeParts(
  info: StructureMetadata,
  group: string,
  previous: SceneObject[] = [],
): SceneObject[] {
  let plan: ConstructionPlan["objects"];
  if (info.standaloneStairs) {
    const r = standaloneStairSchema.parse(info.standaloneStairs);
    plan = stairParts(
      {
        id: "flight",
        from: 0,
        to: 1,
        steps: r.steps,
        rise: r.height / r.steps,
        run: r.run,
        width: r.width,
        x: 0,
        z: 0,
        yaw: 0,
        material: r.material,
        color: r.color,
      },
      0,
    );
  } else if (info.nativeWall) {
    const r = nativeWallSchema.parse(info.nativeWall);
    const template = {
      kind: "room",
      width: r.width,
      depth: 2,
      height: r.height,
      thickness: r.thickness,
      floors: 1,
      doors: 0,
      windows: 0,
      material: r.material,
      roof: "none",
      openings: r.openings,
      appearance: { wall: { material: r.material, color: r.color } },
    } as BuildingTemplate;
    // Reuse the segmented-facade compiler, retaining only the real standalone face.
    plan = openingPlan({
      version: 1,
      name: info.name,
      units: "meters",
      objects: [],
      contacts: [],
      warnings: [],
      template,
    })
      .objects.filter((o) => o.facade === "front")
      .map((o) => ({
        ...o,
        position: [o.position[0], o.position[1] - 0.2, 0] as Vec3,
      }));
  } else throw Error("Native recipe unavailable.");
  return plan.map((p) => {
    const old = previous.find((o) => o.construction?.partId === p.id);
    const o = objectSchema.parse({
      ...createObject(p.type),
      id: old?.id ?? crypto.randomUUID(),
      name: (info.name + " / " + p.name).slice(0, 60),
      position: p.position,
      rotation: p.rotation,
      scale: p.dimensions.map(
        (n, i) => n / objectSize(createObject(p.type))[i],
      ),
      color: old && p.role !== "wall" ? old.color : p.color,
      material: old && p.role !== "wall" ? old.material : p.material,
      ...(old?.surface ? { surface: old.surface } : {}),
      construction: {
        structureId: group,
        structure: info,
        partId: p.id,
        role: p.role,
        assembly: info.standaloneStairs ? "flight" : "wall",
        opening: p.opening,
        facade: p.facade,
        level: 0,
      },
    });
    return transformPart(o, frameMatrix(info));
  });
}
export function standaloneFlight(
  recipe: unknown,
  position: Vec3 = [-3, 0, 0],
  yaw = 0,
) {
  const info: StructureMetadata = {
    name: "Standalone Stairs",
    type: "standalone-stairs",
    position,
    yaw,
    scale: [1, 1, 1],
    contacts: [],
    standaloneStairs: standaloneStairSchema.parse(recipe),
  };
  return nativeParts(info, crypto.randomUUID());
}
export function nativeSupport(parts: SceneObject[], others: SceneObject[]) {
  if (!parts[0]?.construction?.structure?.standaloneStairs) return;
  const first = parts.find((o) => o.construction?.partId === "flight-step-1")!;
  const b = bounds(first);
  if (b.min.y < 0.035) return;
  if (
    !others.some(
      (o) =>
        o.type === "floor" &&
        Math.abs(bounds(o).max.y - b.min.y) < 0.035 &&
        bounds(o).min.x <= b.min.x + 0.01 &&
        bounds(o).max.x >= b.max.x - 0.01 &&
        bounds(o).min.z <= b.min.z + 0.01 &&
        bounds(o).max.z >= b.max.z - 0.01,
    )
  )
    throw Error(
      "Raised standalone stairs need a compatible supporting floor beneath their first tread; no floor connection is implied.",
    );
}
export function nativeRebuild(
  objects: SceneObject[],
  id: string,
  patch: Partial<StructureMetadata>,
) {
  const old = members(objects, id),
    info = { ...structureInfo(old), ...patch },
    parts = nativeParts(info, id, old),
    others = objects.filter((o) => o.construction?.structureId !== id);
  validateStructure(parts, others);
  nativeSupport(parts, others);
  return { objects: [...others, ...parts], parts };
}

export function nativePartOperation(
  objects: SceneObject[],
  id: string,
  op: import("../../shared/editSchema.mjs").StructureOperation,
): import("../../shared/editSchema.mjs").StructureOperation {
  const o = objects.find((o) => o.id === id)!,
    info = o.construction!.structure!;
  const opening = info.nativeWall?.openings.find(
    (d) => d.id === o.construction?.opening,
  );
  if (opening) {
    if (op.type === "duplicate")
      throw Error(
        "Add another window on this wall instead of copying a loose panel.",
      );
    if (op.type === "delete")
      return {
        type: "design",
        nativeWall: {
          ...info.nativeWall!,
          openings: info.nativeWall!.openings.filter(
            (d) => d.id !== opening.id,
          ),
        },
      };
    if (op.type === "setTransform") {
      const inverse = frameMatrix(info).invert(),
        delta = new Vector3(...op.position)
          .sub(new Vector3(...o.position))
          .applyMatrix4(inverse)
          .sub(new Vector3().applyMatrix4(inverse));
      if (
        Math.abs(delta.z) > 0.001 ||
        Math.abs(op.yaw - o.rotation[1]) > 0.001 ||
        Math.abs(op.scale[2] - o.scale[2]) > 0.001
      )
        throw Error("The window must stay aligned with its wall.");
      const width = (opening.width * op.scale[0]) / o.scale[0],
        height = (opening.height * op.scale[1]) / o.scale[1];
      const next = {
        ...opening,
        width,
        height,
        offset: opening.offset + delta.x,
        bottom: opening.bottom + delta.y - (height - opening.height) / 2,
      };
      return {
        type: "design",
        nativeWall: {
          ...info.nativeWall!,
          openings: info.nativeWall!.openings.map((d) =>
            d.id === next.id ? next : d,
          ),
        },
      };
    }
  }
  if (op.type !== "setTransform") return op;
  const factors = op.scale.map((v, i) => v / o.scale[i]) as Vec3;
  return {
    type: "setTransform",
    position: info.position.map(
      (v, i) => v + op.position[i] - o.position[i],
    ) as Vec3,
    yaw: Math.atan2(
      Math.sin(info.yaw + op.yaw - o.rotation[1]),
      Math.cos(info.yaw + op.yaw - o.rotation[1]),
    ),
    scale: info.scale.map((v, i) => v * factors[i]) as Vec3,
  };
}

export function certifyNative(parts: SceneObject[]) {
  const info = parts[0]?.construction?.structure;
  if (!info?.standaloneStairs && !info?.nativeWall) return;
  const expected = nativeParts(info, parts[0].construction!.structureId),
    map = new Map(parts.map((o) => [o.construction?.partId, o]));
  if (parts.length !== expected.length)
    throw Error("Native recipe does not match actual component count.");
  const matrix = (o: SceneObject) =>
    new Matrix4().compose(
      new Vector3(...o.position),
      new Quaternion().setFromEuler(new Euler(...o.rotation)),
      new Vector3(...o.scale),
    );
  for (const o of expected) {
    const a = map.get(o.construction!.partId);
    if (
      !a ||
      a.type !== o.type ||
      a.construction?.role !== o.construction?.role ||
      a.construction?.opening !== o.construction?.opening ||
      matrix(a).elements.some(
        (v, i) => Math.abs(v - matrix(o).elements[i]) > 1e-6,
      )
    )
      throw Error(
        "Native recipe does not match actual geometry. Scene unchanged.",
      );
  }
}
