import { colorPatch } from "./colors";
import { Box3, Euler, Matrix4, Quaternion, Vector3 } from "three";
import {
  operationSchema,
  type StructureOperation,
} from "../../shared/editSchema.mjs";
import {
  objectSchema,
  type SceneObject,
  type Vec3,
  type StructureMetadata,
} from "./objectTypes";
import { bounds, placement } from "../interaction/placement";
import { geometry, materializePlan } from "../generation/engine";
import { offlinePlan } from "../generation/offline";
export const members = (objects: SceneObject[], id: string) =>
  objects.filter((o) => o.construction?.structureId === id);
export function structureBox(parts: SceneObject[]) {
  const box = new Box3();
  parts.forEach((o) => box.union(bounds(o)));
  return box;
}
export function structureInfo(parts: SceneObject[]): StructureMetadata {
  if (!parts.length) throw Error("Structure no longer exists.");
  const saved = parts[0].construction?.structure;
  if (saved) return structuredClone(saved);
  const box = structureBox(parts),
    center = box.getCenter(new Vector3());
  return {
    name: parts[0].name.split(" / ")[0].slice(0, 60),
    type: "legacy generated",
    position: [center.x, box.min.y, center.z],
    yaw: 0,
    scale: [1, 1, 1],
    contacts: [],
  };
}
export function structureIds(objects: SceneObject[]) {
  return [
    ...new Set(
      objects.flatMap((o) =>
        o.construction ? [o.construction.structureId] : [],
      ),
    ),
  ];
}
export function frameMatrix(info: StructureMetadata) {
  return new Matrix4().compose(
    new Vector3(...info.position),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), info.yaw),
    new Vector3(...info.scale),
  );
}
function transformPart(o: SceneObject, matrix: Matrix4): SceneObject {
  const m = matrix
    .clone()
    .multiply(
      new Matrix4().compose(
        new Vector3(...o.position),
        new Quaternion().setFromEuler(new Euler(...o.rotation)),
        new Vector3(...o.scale),
      ),
    );
  const p = new Vector3(),
    q = new Quaternion(),
    s = new Vector3();
  m.decompose(p, q, s);
  const check = new Matrix4().compose(p, q, s);
  if (m.elements.some((v, i) => Math.abs(v - check.elements[i]) > 1e-7))
    throw Error(
      "This non-uniform scale would shear rotated parts. Use uniform scaling.",
    );
  const e = new Euler().setFromQuaternion(q, "XYZ");
  return {
    ...o,
    position: p.toArray() as Vec3,
    rotation: [e.x, e.y, e.z],
    scale: s.toArray() as Vec3,
  };
}
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
function templateGeometry(
  recipe: NonNullable<StructureMetadata["template"]>,
  layouts?: StructureMetadata["floorLayouts"],
) {
  const built = materializePlan(offlinePlan(recipe.kind, recipe)).objects;
  if (!layouts) return built;
  if (layouts.length !== recipe.floors || layouts[0] !== "ground")
    throw Error("Invalid floor relationships.");
  const ground = built.filter((o) => o.construction!.level === 0);
  return built
    .filter(
      (o) =>
        o.construction!.level === undefined ||
        o.construction!.level === 0 ||
        layouts[o.construction!.level] !== "ground",
    )
    .concat(
      layouts.flatMap((layout, level) =>
        level > 0 && layout === "ground"
          ? ground.map((o) => ({
              ...o,
              id: crypto.randomUUID(),
              name: o.name.replace("Level 1", `Level ${level + 1}`),
              position: [
                o.position[0],
                o.position[1] + level * (recipe.height + 0.2),
                o.position[2],
              ] as Vec3,
              construction: {
                ...o.construction!,
                level,
                partId: o.construction!.partId.replace(
                  "level-1-",
                  `level-${level + 1}-`,
                ),
              },
            }))
          : [],
      ),
    );
}
export function validateStructure(parts: SceneObject[], others: SceneObject[]) {
  if (!parts.length || parts.length > 120 || parts.length + others.length > 200)
    throw Error("Structure/scene budget exceeded (120/200).");
  const parsed = parts.map((o) => objectSchema.parse(o));
  const ids = new Set(others.map((o) => o.id)),
    partIds = new Set<string>();
  const info = structureInfo(parsed),
    group = parsed[0].construction!.structureId;
  for (const o of parsed) {
    if (
      !o.construction ||
      o.construction.structureId !== group ||
      ids.has(o.id) ||
      partIds.has(o.construction.partId) ||
      JSON.stringify(o.construction.structure) !==
        JSON.stringify(parsed[0].construction!.structure)
    )
      throw Error("Inconsistent structure identity/metadata.");
    ids.add(o.id);
    partIds.add(o.construction.partId);
    if (!placement(o, o.position, others, false).valid)
      throw Error(
        "Structure collides with another object or exceeds workspace/ground bounds.",
      );
  }
  const local = parsed.map((o) => transformPart(o, frameMatrix(info).invert()));
  const localSize = structureBox(local)
    .getSize(new Vector3())
    .multiply(new Vector3(...info.scale));
  if (
    localSize.x > 32.00001 ||
    localSize.y > 40.00001 ||
    localSize.z > 32.00001
  )
    throw Error("Structure exceeds 32x40x32 m.");
  const min = structureBox(local).min.y;
  geometry(
    local.map((o) => ({
      ...o,
      position: [o.position[0], o.position[1] - min, o.position[2]] as Vec3,
    })),
    info.contacts,
  );
  return parsed;
}
export interface StructureResult {
  objects: SceneObject[];
  parts: SceneObject[];
  structureId: string;
  summary: string;
}
export function applyStructure(
  objects: SceneObject[],
  structureId: string,
  input: StructureOperation,
  snap = false,
): StructureResult {
  const operation = operationSchema.parse(input),
    original = members(objects, structureId);
  let info = structureInfo(original),
    parts = structuredClone(original),
    nextId = structureId;
  const sameVector = (a: Vec3, b: Vec3) =>
    a.every((v, i) => Math.abs(v - b[i]) < 1e-10);
  if (
    (operation.type === "move" && sameVector(operation.delta, [0, 0, 0])) ||
    (operation.type === "rotate" && Math.abs(operation.angle) < 1e-10) ||
    (operation.type === "scale" && sameVector(operation.factors, [1, 1, 1])) ||
    (operation.type === "setTransform" &&
      sameVector(operation.position, info.position) &&
      sameVector(operation.scale, info.scale) &&
      Math.abs(operation.yaw - info.yaw) < 1e-10)
  )
    return {
      objects,
      parts: original,
      structureId,
      summary: "Transform unchanged",
    };
  const others = objects.filter(
    (o) => o.construction?.structureId !== structureId,
  );
  if (operation.type === "unsupported") throw Error(operation.reason);
  if (operation.type === "clarify") throw Error(operation.question);
  if (operation.type === "select")
    return {
      objects,
      parts: original,
      structureId,
      summary: `Select ${info.name}`,
    };
  if (operation.type === "delete")
    return {
      objects: others,
      parts: [],
      structureId,
      summary: `Delete ${info.name} (${original.length} components)`,
    };
  if (operation.type === "ungroup") {
    const ungrouped = parts.map((o) => {
      const copy = { ...o };
      delete copy.construction;
      return copy;
    });
    return {
      objects: objects.map((o) => ungrouped.find((p) => p.id === o.id) ?? o),
      parts: ungrouped,
      structureId,
      summary: `Ungroup ${info.name}; keep all components`,
    };
  }
  if (operation.type === "rename") info.name = operation.name;
  else if (operation.type === "material") {
    const affected = parts.filter(
      (o) =>
        (!operation.role || o.construction!.role === operation.role) &&
        (operation.level === undefined ||
          o.construction!.level === operation.level),
    );
    if (!affected.length) throw Error("No components match that role/floor.");
    const ids = new Set(affected.map((o) => o.id));
    parts = parts.map((o) =>
      ids.has(o.id)
        ? {
            ...o,
            material: operation.material,
            surface: undefined,
            ...(o.model
              ? { model: { ...o.model, originalMaterials: false } }
              : {}),
          }
        : o,
    );
  } else if (operation.type === "color") {
    const affected = parts.filter(
      (o) =>
        (!operation.role || o.construction!.role === operation.role) &&
        (operation.level === undefined ||
          o.construction!.level === operation.level),
    );
    if (!affected.length) throw Error("No components match that role/floor.");
    const ids = new Set(affected.map((o) => o.id));
    parts = parts.map((o) =>
      ids.has(o.id)
        ? {
            ...o,
            ...colorPatch(o, operation.color ?? "#ffffff", !!operation.reset),
          }
        : o,
    );
  } else if (operation.type === "duplicate") {
    if (objects.length + parts.length > 200)
      throw Error("Duplicate exceeds the 200-object scene budget.");
    nextId = crypto.randomUUID();
    info.name = info.name.slice(0, 55) + " copy";
    parts = parts.map((o) => ({
      ...o,
      id: crypto.randomUUID(),
      construction: { ...o.construction!, structureId: nextId },
    }));
    const size = structureBox(parts).getSize(new Vector3());
    const step = Math.ceil(Math.max(size.x, size.z)) + 1;
    let found = false;
    for (let ring = 1; ring <= 8 && !found; ring++)
      for (let x = -ring; x <= ring && !found; x++)
        for (let z = -ring; z <= ring && !found; z++) {
          if (Math.max(Math.abs(x), Math.abs(z)) !== ring) continue;
          const delta: Vec3 = [x * step, 0, z * step];
          const candidates = parts.map((o) => ({
            ...o,
            position: o.position.map((v, i) => v + delta[i]) as Vec3,
          }));
          if (
            candidates.every(
              (o) => placement(o, o.position, objects, false).valid,
            )
          ) {
            parts = candidates;
            info.position = info.position.map((v, i) => v + delta[i]) as Vec3;
            found = true;
          }
        }
    if (!found) throw Error("No free location for a duplicate structure.");
  } else if (operation.type === "floors") {
    const recipe = info.template;
    if (!recipe || !["house", "tower", "office"].includes(recipe.kind))
      throw Error(
        "Floor editing requires an intact generated house/tower/office template; arbitrary or manually modified geometry is unsupported.",
      );
    const certified = templateGeometry(recipe, info.floorLayouts).map((o) =>
      transformPart(o, frameMatrix(info)),
    );
    if (
      certified.length !== original.length ||
      certified.some((o) => {
        const old = original.find(
          (p) => p.construction!.partId === o.construction!.partId,
        );
        return (
          !old ||
          old.type !== o.type ||
          old.construction!.role !== o.construction!.role ||
          old.construction!.level !== o.construction!.level ||
          !["position", "rotation", "scale"].every((k) =>
            (o[k as "position"] as Vec3).every(
              (v, i) => Math.abs(v - old[k as "position"][i]) < 1e-6,
            ),
          )
        );
      })
    )
      throw Error(
        "Template no longer matches the components. Floor redesign cancelled.",
      );
    if (
      operation.action === "duplicate" &&
      (operation.level === undefined || operation.level >= recipe.floors)
    )
      throw Error("Choose an existing floor (1-based in the UI).");
    if (operation.action === "height" && operation.height === undefined)
      throw Error("Specify a storey height of 2.5-5 m.");
    const floors =
      recipe.floors +
      (operation.action === "remove"
        ? -1
        : operation.action === "height"
          ? 0
          : 1);
    const template = {
      ...recipe,
      floors,
      ...(operation.action === "height" ? { height: operation.height! } : {}),
    };
    const layouts = info.floorLayouts
      ? [...info.floorLayouts]
      : Array.from({ length: recipe.floors }, (_, i) =>
          i === 0 ? ("ground" as const) : ("upper" as const),
        );
    if (operation.action === "remove") layouts.pop();
    if (operation.action === "add") layouts.push("upper");
    if (operation.action === "duplicate")
      layouts.push(layouts[operation.level!]);
    const built = { objects: templateGeometry(template, layouts) };
    info.floorLayouts = layouts;
    const lookup = new Map(original.map((o) => [o.construction!.partId, o]));
    parts = built.objects.map((o) => {
      const c = o.construction!,
        old =
          lookup.get(c.partId) ??
          lookup.get(
            c.partId.replace(
              /^level-\d+-/,
              `level-${(operation.level ?? recipe.floors - 1) + 1}-`,
            ),
          ) ??
          original.find(
            (p) =>
              p.construction!.level ===
                (operation.level ?? recipe.floors - 1) &&
              p.construction!.role === c.role,
          );
      const exact = lookup.get(c.partId);
      return transformPart(
        {
          ...o,
          id: exact?.id ?? crypto.randomUUID(),
          material: old?.material ?? o.material,
          color: old?.color ?? o.color,
          surface: old?.surface,
          construction: { ...c, structureId },
        },
        frameMatrix(info),
      );
    });
    info.template = template;
  } else {
    const baseline = structuredClone(info);
    const before = frameMatrix(info);
    if (operation.type === "move")
      info.position = info.position.map(
        (v, i) => v + operation.delta[i],
      ) as Vec3;
    if (operation.type === "rotate")
      info.yaw = wrap(info.yaw + operation.angle);
    if (operation.type === "scale")
      info.scale = info.scale.map((v, i) => v * operation.factors[i]) as Vec3;
    if (operation.type === "setTransform")
      info = {
        ...info,
        position: operation.position,
        yaw: operation.yaw,
        scale: operation.scale,
      };
    if (
      snap &&
      (operation.type === "move" || operation.type === "setTransform")
    )
      info.position = info.position.map((v, i) =>
        i === 1 ? v : Math.round(v * 2) / 2,
      ) as Vec3;
    if (
      sameVector(info.position, baseline.position) &&
      sameVector(info.scale, baseline.scale) &&
      Math.abs(wrap(info.yaw - baseline.yaw)) < 1e-10
    )
      return {
        objects,
        parts: original,
        structureId,
        summary: "Transform unchanged",
      };
    const matrix = frameMatrix(info).multiply(before.invert());
    parts = parts.map((o) => transformPart(o, matrix));
  }
  parts = parts.map((o) => ({
    ...o,
    construction: { ...o.construction!, structure: structuredClone(info) },
  }));
  validateStructure(parts, operation.type === "duplicate" ? objects : others);
  const replacement = new Map(parts.map((o) => [o.id, o]));
  const result =
    operation.type === "duplicate"
      ? [...objects, ...parts]
      : [
          ...objects
            .filter(
              (o) =>
                o.construction?.structureId !== structureId ||
                replacement.has(o.id),
            )
            .map((o) => replacement.get(o.id) ?? o),
          ...parts.filter((o) => !objects.some((p) => p.id === o.id)),
        ];
  const fmt = (values: number[]) =>
    values.map((v) => Number(v.toFixed(3))).join(", ");
  const action =
    operation.type === "material"
      ? `${operation.role ?? "all components"}${operation.level === undefined ? "" : ` / floor ${operation.level + 1}`} to ${operation.material}`
      : operation.type === "color"
        ? `${operation.role ?? "all components"} color ${operation.reset ? "material default" : operation.color}`
        : operation.type === "move"
          ? `move by [${fmt(operation.delta)}] m; origin [${fmt(info.position)}] m`
          : operation.type === "rotate"
            ? `yaw ${Number(((operation.angle * 180) / Math.PI).toFixed(2))} degrees`
            : operation.type === "scale"
              ? `local scale factors [${fmt(operation.factors)}]`
              : operation.type === "setTransform"
                ? `origin [${fmt(info.position)}] m; yaw ${Number(((info.yaw * 180) / Math.PI).toFixed(2))} degrees; scale [${fmt(info.scale)}]`
                : operation.type === "floors"
                  ? `${operation.action} floor${operation.level === undefined ? "" : ` ${operation.level + 1}`}; ${info.template!.floors} floors, ${info.template!.height} m storeys`
                  : operation.type;
  return {
    objects: result,
    parts,
    structureId: nextId,
    summary: `${info.name} / ${action} / ${parts.length} components`,
  };
}
export function invalidateTemplate(objects: SceneObject[], id?: string) {
  return objects.map((o) =>
    o.construction?.structureId === id && o.construction?.structure?.template
      ? {
          ...o,
          construction: {
            ...o.construction,
            structure: {
              ...o.construction.structure,
              template: undefined,
              floorLayouts: undefined,
            },
          },
        }
      : o,
  );
}
