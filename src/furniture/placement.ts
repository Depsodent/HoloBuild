import { Box3, Vector3, Matrix4, Quaternion, Euler } from "three";
import { FURNITURE } from "../../shared/furnitureCatalog.mjs";
import type { SceneObject, Vec3 } from "../scene/objectTypes";
import { bounds } from "../interaction/placement";
/** Exact coverage of axis-aligned rectangular supports, including interior voids. */
function covered(b: Box3, surfaces: Box3[]) {
  const rects = surfaces.filter(
    (r) =>
      Math.min(r.max.x, b.max.x) > Math.max(r.min.x, b.min.x) + 1e-6 &&
      Math.min(r.max.z, b.max.z) > Math.max(r.min.z, b.min.z) + 1e-6,
  );
  if (!rects.length) return false;
  const xs = [
    ...new Set([
      b.min.x,
      b.max.x,
      ...rects.flatMap((r) => [
        Math.max(b.min.x, r.min.x),
        Math.min(b.max.x, r.max.x),
      ]),
    ]),
  ].sort((a, b) => a - b);
  const zs = [
    ...new Set([
      b.min.z,
      b.max.z,
      ...rects.flatMap((r) => [
        Math.max(b.min.z, r.min.z),
        Math.min(b.max.z, r.max.z),
      ]),
    ]),
  ].sort((a, b) => a - b);
  if (xs.length * zs.length > 10000) return false;
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < zs.length; j++) {
      if (xs[i] - xs[i - 1] < 1e-6 || zs[j] - zs[j - 1] < 1e-6) continue;
      const x = (xs[i] + xs[i - 1]) / 2,
        z = (zs[j] + zs[j - 1]) / 2;
      if (
        !rects.some(
          (r) =>
            x >= r.min.x - 1e-5 &&
            x <= r.max.x + 1e-5 &&
            z >= r.min.z - 1e-5 &&
            z <= r.max.z + 1e-5,
        )
      )
        return false;
    }
  return true;
}
function uprightYaw(o: SceneObject): number | null {
  const q = new Quaternion().setFromEuler(new Euler(...o.rotation)),
    up = new Vector3(0, 1, 0).applyQuaternion(q);
  if (up.distanceToSquared(new Vector3(0, 1, 0)) > 1e-10) return null;
  const right = new Vector3(1, 0, 0).applyQuaternion(q);
  return Math.atan2(-right.z, right.x);
}
const flat = (o: SceneObject) => {
  const yaw = uprightYaw(o);
  return (
    yaw !== null &&
    Math.abs(yaw / (Math.PI / 2) - Math.round(yaw / (Math.PI / 2))) < 1e-5
  );
};
const supports = [
  "coffee-table",
  "side-table",
  "dining-table",
  "study-desk",
  "office-desk",
  "kitchen-counter",
  "kitchen-island",
  "tv-stand",
  "bedside-table",
  "dresser",
  "bath-cabinet",
];
export function furniturePlacement(
  o: SceneObject,
  others: SceneObject[],
): { valid: boolean; reason: string } {
  const d = o.furniture && FURNITURE[o.furniture.preset];
  if (!d) return { valid: false, reason: "Unknown furniture preset." };
  if (uprightYaw(o) === null || o.scale.some((v) => v < 0.25 || v > 4))
    return {
      valid: false,
      reason: "Furniture must stay upright; scale range is 0.25–4.",
    };
  const b = bounds(o),
    objects = others.filter((p) => p.id !== o.id),
    boxes = objects.map((p) => ({ o: p, b: bounds(p) }));
  if (
    b.min.y < -0.001 ||
    [b.min.x, b.min.z, b.max.x, b.max.z].some((v) => Math.abs(v) > 49) ||
    b.max.y > 49
  )
    return { valid: false, reason: "Furniture exceeds workspace limits." };
  if (
    boxes.some(
      (p) =>
        Math.min(b.max.x, p.b.max.x) - Math.max(b.min.x, p.b.min.x) > 0.012 &&
        Math.min(b.max.y, p.b.max.y) - Math.max(b.min.y, p.b.min.y) > 0.012 &&
        Math.min(b.max.z, p.b.max.z) - Math.max(b.min.z, p.b.min.z) > 0.012,
    )
  )
    return {
      valid: false,
      reason: "Furniture intersects an existing object or wall.",
    };
  let attached = false;
  if (d.attachment === "floor" || d.attachment === "surface") {
    const candidates = boxes.filter(
      (p) =>
        flat(p.o) &&
        Math.abs(p.b.max.y - b.min.y) < 0.003 &&
        (d.attachment === "floor"
          ? p.o.type === "floor" ||
            p.o.construction?.role === "floor" ||
            (p.o.type === "cube" && !p.o.construction)
          : !!p.o.furniture && supports.includes(p.o.furniture.preset)),
    );
    attached =
      (d.attachment === "floor" && Math.abs(b.min.y) < 0.005) ||
      covered(
        b,
        candidates.map((p) => p.b),
      );
  } else if (d.attachment === "ceiling") {
    attached = covered(
      b,
      boxes
        .filter(
          (p) =>
            flat(p.o) &&
            (p.o.type === "floor" || p.o.type === "cube") &&
            Math.abs(p.b.min.y - b.max.y) < 0.003,
        )
        .map((p) => p.b),
    );
  } else if (flat(o)) {
    const nx = Math.round(Math.sin(uprightYaw(o) ?? 0)),
      nz = Math.round(Math.cos(uprightYaw(o) ?? 0));
    attached = boxes.some(
      (p) =>
        flat(p.o) &&
        (p.o.type === "wall" || p.o.construction?.role === "wall") &&
        b.min.y >= p.b.min.y - 0.005 &&
        b.max.y <= p.b.max.y + 0.005 &&
        (nx
          ? Math.abs(
              (nx > 0 ? b.min.x - p.b.max.x : p.b.min.x - b.max.x) - 0.008,
            ) < 0.003 &&
            b.min.z >= p.b.min.z - 0.005 &&
            b.max.z <= p.b.max.z + 0.005
          : Math.abs(
              (nz > 0 ? b.min.z - p.b.max.z : p.b.min.z - b.max.z) - 0.008,
            ) < 0.003 &&
            b.min.x >= p.b.min.x - 0.005 &&
            b.max.x <= p.b.max.x + 0.005),
    );
  }
  if (!attached)
    return {
      valid: false,
      reason:
        d.attachment === "wall"
          ? "Aim at a complete, axis-aligned wall face; the entire item needs backing."
          : d.attachment === "ceiling"
            ? "Aim at a flat ceiling underside with full coverage."
            : d.attachment === "surface"
              ? "Place on a supported table, desk, counter or cabinet top."
              : "The entire footprint must rest on ground or a flat floor/platform; stairs and floor voids are not supports.",
    };
  // Conservative accessible native portals and complete stair approaches remain reserved.
  for (const { o: p, b: pb } of boxes) {
    if (p.construction?.role === "door") {
      const corridor = pb.clone();
      if (pb.max.x - pb.min.x > pb.max.z - pb.min.z) {
        corridor.min.z -= 0.65;
        corridor.max.z += 0.65;
      } else {
        corridor.min.x -= 0.65;
        corridor.max.x += 0.65;
      }
      if (b.intersectsBox(corridor))
        return {
          valid: false,
          reason: "Keep the doorway and its approach clear.",
        };
    }
    if (p.construction?.role === "stair") {
      const lane = pb.clone();
      lane.min.y = Math.max(0, lane.min.y - 2);
      lane.max.y += 1.8;
      lane.expandByVector(new Vector3(0.3, 0, 0.3));
      if (b.intersectsBox(lane))
        return {
          valid: false,
          reason: "Keep stair treads, headroom and approaches clear.",
        };
    }
  }
  return { valid: true, reason: "Valid " + d.attachment + " attachment." };
}
/** Cheap reusable part proxies, not per-triangle collision. */
export function furnitureVolumes(o: SceneObject): Box3[] {
  const d = o.furniture && FURNITURE[o.furniture.preset];
  if (!d) return [];
  if (
    /^(?:sofa-|sectional|armchair|bed-|bunk-bed|wardrobe|dresser|tv-stand|kitchen-counter|kitchen-island|kitchen-cabinet|refrigerator|stove|sink|bath-cabinet|filing-cabinet)/.test(
      d.id,
    )
  )
    return [bounds(o)];
  const frame = new Matrix4().compose(
    new Vector3(...o.position),
    new Quaternion().setFromEuler(new Euler(...o.rotation)),
    new Vector3(...o.scale),
  );
  return d.parts.map((p) => {
    const local = new Matrix4().compose(
      new Vector3(...p.position),
      new Quaternion().setFromEuler(new Euler(...(p.rotation ?? [0, 0, 0]))),
      new Vector3(...p.size),
    );
    return new Box3(
      new Vector3(-0.5, -0.5, -0.5),
      new Vector3(0.5, 0.5, 0.5),
    ).applyMatrix4(frame.clone().multiply(local));
  });
}
export function attachmentCandidate(
  o: SceneObject,
  point: Vec3,
  normal: Vec3,
): SceneObject | null {
  const d = FURNITURE[o.furniture!.preset],
    size = d.size.map((v, i) => v * o.scale[i]);
  if (d.attachment === "floor" || d.attachment === "surface") {
    if (normal[1] < 0.99) return null;
    return { ...o, position: [point[0], point[1] + size[1] / 2, point[2]] };
  }
  if (d.attachment === "ceiling") {
    if (normal[1] > -0.99) return null;
    return { ...o, position: [point[0], point[1] - size[1] / 2, point[2]] };
  }
  if (
    Math.abs(normal[1]) > 0.01 ||
    Math.max(Math.abs(normal[0]), Math.abs(normal[2])) < 0.99
  )
    return null;
  return {
    ...o,
    rotation: [0, Math.atan2(normal[0], normal[2]), 0],
    position: [
      point[0] + normal[0] * (size[2] / 2 + 0.008),
      point[1],
      point[2] + normal[2] * (size[2] / 2 + 0.008),
    ],
  };
}

/** Keep the attachment plane stable for scale-only editor/Inspector changes. */
export function anchorFurnitureTransform(
  original: SceneObject,
  candidate: SceneObject,
): SceneObject {
  const d = original.furniture && FURNITURE[original.furniture.preset];
  if (!d) return candidate;
  const a = bounds(original),
    b = bounds(candidate),
    position = [...candidate.position] as Vec3;
  if (d.attachment === "ceiling") position[1] += a.max.y - b.max.y;
  else if (d.attachment === "wall") {
    if (Math.abs(original.rotation[1] - candidate.rotation[1]) < 1e-6) {
      const delta = (d.size[2] * (candidate.scale[2] - original.scale[2])) / 2;
      position[0] += Math.sin(original.rotation[1]) * delta;
      position[2] += Math.cos(original.rotation[1]) * delta;
    }
  } else position[1] += a.min.y - b.min.y;
  return { ...candidate, position };
}
