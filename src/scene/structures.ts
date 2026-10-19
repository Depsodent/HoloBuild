import {
  openingDesign,
  floorOpeningDesign,
  openingForGeometry,
  openingDefinitions,
  facadeAt,
} from "../generation/openings";
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
export function transformPart(o: SceneObject, matrix: Matrix4): SceneObject {
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
  if (!layouts || recipe.openings) return built;
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
                opening: o.construction!.opening?.replace(
                  /^(door|window)-0-/,
                  `$1-${level}-`,
                ),
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
  const operation = operationSchema.parse(input);
  if (operation.type === "batch") {
    let result: StructureResult | undefined;
    for (const op of operation.operations) {
      if (
        [
          "select",
          "delete",
          "duplicate",
          "ungroup",
          "unsupported",
          "clarify",
        ].includes(op.type)
      )
        throw Error(
          "Use separate requests for selection/deletion/duplication or unsupported changes.",
        );
      result = applyStructure(
        result?.objects ?? objects,
        structureId,
        op,
        snap,
      );
    }
    return {
      ...result!,
      summary:
        operation.operations.length +
        " validated changes; one Undo restores them.",
    };
  }
  const original = members(objects, structureId);
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
  const matchesOpening = (o: SceneObject, id: string | undefined) => {
    if (!id) return true;
    const recipe = info.template ?? info.architectureTemplate;
    if (!recipe) return o.construction?.opening === id;
    const local = transformPart(o, frameMatrix(info).invert());
    return (
      openingForGeometry(
        recipe,
        {
          position: local.position,
          role: o.construction!.role,
          level: o.construction!.level,
          facade: o.construction!.facade,
        },
        info.floorLayouts,
      )?.id === id
    );
  };
  if (operation.type === "rename") info.name = operation.name;
  else if (operation.type === "material") {
    const affected = parts.filter(
      (o) =>
        (!operation.role || o.construction!.role === operation.role) &&
        matchesOpening(o, operation.opening) &&
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
        matchesOpening(o, operation.opening) &&
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
  } else if (operation.type === "floors" || operation.type === "design") {
    const action = operation.type === "floors" ? operation.action : undefined;
    const partialArchitecture =
      !info.template &&
      operation.type === "design" &&
      Object.keys(operation).every((key) =>
        ["type", "stairs", "openings"].includes(key),
      );
    const recipe =
      info.template ??
      (partialArchitecture ? info.architectureTemplate : undefined);
    if (
      !recipe ||
      recipe.kind === "bridge" ||
      (operation.type === "floors" &&
        !["house", "tower", "office"].includes(recipe.kind))
    )
      throw Error(
        "Floor editing requires an intact generated house/tower/office template; arbitrary or manually modified geometry is unsupported.",
      );
    const affectedFaces = new Set<string>();
    if (operation.type === "design" && operation.openings !== undefined) {
      const before = openingDefinitions(recipe, info.floorLayouts),
        after = operation.openings;
      for (const d of [...before, ...after]) {
        const other = (before.includes(d) ? after : before).find(
          (p) => p.id === d.id,
        );
        if (JSON.stringify(d) !== JSON.stringify(other))
          affectedFaces.add(d.level + ":" + d.facade);
      }
    }
    const architecturePart = (o: SceneObject, local = false) => {
      const c = o.construction!;
      if (
        operation.type === "design" &&
        operation.stairs !== undefined &&
        ["floor", "stair"].includes(c.role)
      )
        return true;
      const point = local ? o : transformPart(o, frameMatrix(info).invert());
      const face =
        c.facade ??
        facadeAt({ position: point.position, role: c.role }, recipe);
      return face !== undefined && affectedFaces.has(c.level + ":" + face);
    };
    const checkedOriginal = partialArchitecture
      ? original.filter((o) => architecturePart(o))
      : original;
    const certified = templateGeometry(recipe, info.floorLayouts)
      .filter((o) => !partialArchitecture || architecturePart(o, true))
      .map((o) => transformPart(o, frameMatrix(info)));
    const matched = new Set<string>();
    if (
      certified.length !== checkedOriginal.length ||
      certified.some((o) => {
        const old = checkedOriginal.find(
          (p) =>
            !matched.has(p.id) &&
            p.type === o.type &&
            p.construction!.role === o.construction!.role &&
            p.construction!.level === o.construction!.level &&
            ["position", "rotation", "scale"].every((k) =>
              (o[k as "position"] as Vec3).every(
                (v, i) => Math.abs(v - p[k as "position"][i]) < 1e-6,
              ),
            ),
        );
        if (old) matched.add(old.id);
        return !old;
      })
    )
      throw Error(
        "Template no longer matches the affected components. Undo manual edits on that floor/facade and retry.",
      );
    if (
      (operation.type === "floors" ? action : "design") === "duplicate" &&
      (operation.level === undefined || operation.level >= recipe.floors)
    )
      throw Error("Choose an existing floor (1-based in the UI).");
    if (
      operation.type === "floors" &&
      operation.action === "height" &&
      operation.height === undefined
    )
      throw Error("Specify a storey height of 2.5-5 m.");
    const floors =
      operation.type === "design"
        ? (operation.floors ?? recipe.floors)
        : recipe.floors +
          (action === "remove" ? -1 : action === "height" ? 0 : 1);
    let template = {
      ...recipe,
      floors,
      ...(operation.type !== "design"
        ? {}
        : {
            ...(openingDesign(recipe, operation) === undefined
              ? {}
              : { openings: openingDesign(recipe, operation) }),
            ...(operation.stairs === undefined
              ? {}
              : { stairs: operation.stairs }),
            ...(operation.windows === undefined
              ? {}
              : operation.level === undefined
                ? { windows: operation.windows, windowCounts: undefined }
                : {
                    windowCounts: Array.from({ length: floors }, (_, i) =>
                      i === operation.level
                        ? operation.windows!
                        : (recipe.windowCounts?.[i] ?? recipe.windows),
                    ),
                  }),
            ...(operation.windowScale === undefined
              ? {}
              : {
                  windowWidth:
                    (recipe.windowWidth ?? 1) * operation.windowScale,
                  windowHeight:
                    (recipe.windowHeight ?? 1) * operation.windowScale,
                }),
            ...(operation.doorOffset === undefined
              ? {}
              : { doorOffset: operation.doorOffset }),
            ...(operation.doors === undefined
              ? {}
              : { doors: operation.doors }),
            ...(operation.roof === undefined ? {} : { roof: operation.roof }),
          }),
      ...(action === "height"
        ? { height: (operation as { height: number }).height }
        : {}),
    };
    if (template.openings) {
      template.openings = floorOpeningDesign(
        recipe,
        template.openings,
        floors,
        action,
        operation.level,
      );
      const counts = Array.from(
        { length: floors },
        (_, level) =>
          template.openings!.filter(
            (d) => d.kind === "window" && d.level === level,
          ).length,
      );
      template = {
        ...template,
        windowCounts: counts,
        windows: counts[0],
        doorOffset: (() => {
          const d = template.openings!.filter(
            (o) => o.kind === "door" && o.level === 0 && o.facade === "front",
          );
          const offset = d.reduce((n, o) => n + o.offset, 0) / (d.length || 1);
          return Math.abs(offset) <= 2 ? offset : undefined;
        })(),
        doors: template.openings.filter(
          (d) => d.kind === "door" && d.level === 0 && d.facade === "front",
        ).length,
      };
    }
    const layouts = info.floorLayouts
      ? [...info.floorLayouts]
      : Array.from({ length: recipe.floors }, (_, i) =>
          i === 0 ? ("ground" as const) : ("upper" as const),
        );
    if (action === "remove") layouts.pop();
    if (action === "add") layouts.push("upper");
    if (action === "duplicate") layouts.push(layouts[operation.level!]);
    if (operation.type === "design") {
      if (operation.level !== undefined && operation.level >= floors)
        throw Error("That floor does not exist.");
      while (layouts.length < floors) layouts.push("upper");
      layouts.length = floors;
    }
    const built = {
      objects: partialArchitecture
        ? templateGeometry(template, layouts)
            .filter((o) => architecturePart(o, true))
            .concat(
              original
                .filter((o) => !architecturePart(o))
                .map((o) => transformPart(o, frameMatrix(info).invert())),
            )
        : templateGeometry(template, layouts),
    };
    info.floorLayouts = layouts;
    const lookup = new Map(original.map((o) => [o.construction!.partId, o]));
    const legacyOpenings = new Map(
      original.flatMap((o) => {
        const local = transformPart(o, frameMatrix(info).invert());
        const d = openingForGeometry(
          recipe,
          {
            position: local.position,
            role: o.construction!.role,
            level: o.construction!.level,
            facade: o.construction!.facade,
          },
          info.floorLayouts,
        );
        return d ? [[d.id, o] as const] : [];
      }),
    );

    const equalShape = (a: SceneObject, b: SceneObject) =>
      a.type === b.type &&
      a.construction?.role === b.construction?.role &&
      a.construction?.level === b.construction?.level &&
      ["position", "rotation", "scale"].every((k) =>
        (a[k as "position"] as Vec3).every(
          (v, i) => Math.abs(v - b[k as "position"][i]) < 1e-9,
        ),
      );
    const stable = new Map(
      built.objects.map((o) => [
        o.construction!.partId,
        original.find((p) =>
          equalShape(transformPart(o, frameMatrix(info)), p),
        ),
      ]),
    );
    const reserved = new Set(
      [...stable.values()].flatMap((o) => (o ? [o.id] : [])),
    );
    const used = new Set<string>();

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
      const candidate =
        (c.opening
          ? (legacyOpenings.get(c.opening) ??
            original.find(
              (p) =>
                p.construction?.opening === c.opening &&
                p.construction?.role === c.role &&
                p.construction?.level === c.level,
            ))
          : undefined) ?? lookup.get(c.partId);
      const exact =
        stable.get(c.partId) ??
        (candidate?.construction?.role === c.role &&
        !reserved.has(candidate.id) &&
        !used.has(candidate.id)
          ? candidate
          : undefined);
      if (exact) used.add(exact.id);
      const matching =
        exact ??
        (old?.construction?.role === c.role
          ? old
          : original.find(
              (p) =>
                p.construction?.role === c.role &&
                p.construction.level === c.level,
            ));
      const previousAssembly = recipe.stairs?.find((s) => s.id === c.assembly);
      const nextAssembly = template.stairs?.find((s) => s.id === c.assembly);
      const materialChanged =
        nextAssembly && nextAssembly.material !== previousAssembly?.material;
      const colorChanged =
        nextAssembly && nextAssembly.color !== previousAssembly?.color;
      const transformed = transformPart(
        {
          ...o,
          id: exact?.id ?? crypto.randomUUID(),
          name: exact?.name ?? o.name,
          material: materialChanged
            ? o.material
            : (matching?.material ?? o.material),
          color: colorChanged ? o.color : (matching?.color ?? o.color),
          surface: matching?.surface,
          construction: { ...c, structureId },
        },
        frameMatrix(info),
      );
      const preserved = stable.get(c.partId);
      return preserved
        ? {
            ...transformed,
            position: preserved.position,
            rotation: preserved.rotation,
            scale: preserved.scale,
            name: preserved.name,
          }
        : transformed;
    });
    if (partialArchitecture) info.architectureTemplate = template;
    else info.template = template;
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
              architectureTemplate:
                o.construction.structure.template ??
                o.construction.structure.architectureTemplate,
              template: undefined,
              floorLayouts: o.construction.structure.floorLayouts,
            },
          },
        }
      : o,
  );
}
