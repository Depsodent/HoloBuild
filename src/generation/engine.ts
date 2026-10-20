import { nativeSupport, certifyNative } from "../scene/nativeAssemblies";
import { offlinePlan } from "./offline";
import { Box3, Vector3 } from "three";
import {
  contactsSchema,
  planSchema,
  MAX_PARTS,
  type ConstructionPlan,
} from "../../shared/planSchema.mjs";
import { createObject, SHAPES } from "../scene/objectFactory";
import {
  objectSchema,
  type SceneObject,
  type Vec3,
} from "../scene/objectTypes";
import { bounds, placement } from "../interaction/placement";
const sizeOf = (box: Box3) => box.getSize(new Vector3());
export function geometry(
  objects: SceneObject[],
  contacts: [string, string][] = [],
) {
  const boxes = objects.map((o) => bounds(o)),
    whole = new Box3();
  boxes.forEach((b) => whole.union(b));
  const size = sizeOf(whole);
  if (size.x > 32 || size.y > 40 || size.z > 32 || whole.min.y < -0.01)
    throw Error("Structure exceeds 32×40×32 m or extends below ground.");
  const byId = new Map(objects.map((o, i) => [o.construction!.partId, i]));
  const intended = new Set(contacts.map(([a, b]) => [a, b].sort().join(":")));
  const graph = objects.map(() => new Set<number>());
  for (let i = 0; i < objects.length; i++)
    for (let j = i + 1; j < objects.length; j++) {
      const a = boxes[i],
        b = boxes[j],
        gap = Math.max(
          a.min.x - b.max.x,
          b.min.x - a.max.x,
          a.min.y - b.max.y,
          b.min.y - a.max.y,
          a.min.z - b.max.z,
          b.min.z - a.max.z,
        );
      if (gap > 0.035) continue;
      graph[i].add(j);
      graph[j].add(i);
      const overlap = [
        Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x),
        Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y),
        Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z),
      ];
      if (overlap.every((v) => v > 0.025)) {
        const volume = (v: Vector3) => v.x * v.y * v.z;
        const fraction =
          overlap.reduce((v, x) => v * x, 1) /
          Math.min(volume(sizeOf(a)), volume(sizeOf(b)));
        if (
          !intended.has(
            [objects[i].construction!.partId, objects[j].construction!.partId]
              .sort()
              .join(":"),
          ) ||
          Math.min(...overlap) > 0.08 ||
          fraction > 0.25
        )
          throw Error(
            `Excessive component overlap: ${objects[i].name} / ${objects[j].name}.`,
          );
      }
    }
  for (const [a, b] of contacts) {
    const i = byId.get(a),
      j = byId.get(b);
    if (i === undefined || j === undefined || !graph[i].has(j))
      throw Error("Declared components do not contact.");
  }
  const connected = new Set<number>(),
    queue = boxes
      .map((b, i) => (b.min.y <= 0.035 ? i : -1))
      .filter((i) => i >= 0);
  while (queue.length) {
    const i = queue.pop()!;
    if (connected.has(i)) continue;
    connected.add(i);
    queue.push(...[...graph[i]].filter((j) => !connected.has(j)));
  }
  if (connected.size !== objects.length)
    throw Error("Every component must connect to a grounded assembly.");
  return { dimensions: [size.x, size.y, size.z] as Vec3, box: whole };
}
export function materializePlan(input: unknown) {
  const plan = planSchema.parse(input),
    structureId = crypto.randomUUID();
  if (
    plan.objects.some((p) => p.role === "balcony") &&
    !plan.template?.balconies?.length
  )
    throw Error(
      "Balcony geometry requires a certified recipe and real access opening.",
    );
  if (
    plan.objects.some((p) => p.role === "stair") &&
    !plan.template?.stairs?.length
  )
    throw Error(
      "Stair geometry requires a certified staircase recipe and floor connection.",
    );
  if (
    plan.template &&
    (plan.template.stairs?.length ||
      plan.template.openings ||
      plan.template.balconies?.length)
  ) {
    const expected = offlinePlan(plan.template.kind, plan.template).objects;
    const physical = (p: (typeof plan.objects)[number]) =>
      JSON.stringify([
        p.type,
        p.role,
        p.level,
        p.assembly,
        p.opening,
        p.facade,
        ...[p.position, p.rotation, p.dimensions].map((v) =>
          v.map((n) => Number(n.toFixed(6))),
        ),
      ]);
    const actual = plan.objects.map(physical).sort();
    if (
      JSON.stringify(expected.map(physical).sort()) !== JSON.stringify(actual)
    )
      throw Error(
        "Architectural recipe does not match actual stair/opening geometry. Scene unchanged.",
      );
  }
  const objects = plan.objects.map((part) =>
    objectSchema.parse({
      ...createObject(part.type),
      name: `${plan.name.slice(0, 24)} / ${part.name.slice(0, 32)}`,
      position: part.position,
      rotation: part.rotation,
      scale: part.dimensions.map((v, i) => v / SHAPES[part.type].size[i]),
      material: part.material,
      color: part.color,
      construction: {
        structureId,
        partId: part.id,
        role: part.role,
        level: part.level,
        assembly: part.assembly,
        opening: part.opening,
        facade: part.facade,
        structure: {
          name: plan.name.slice(0, 60),
          type: plan.template?.kind ?? "generated",
          position: [0, 0, 0],
          yaw: 0,
          scale: [1, 1, 1],
          contacts: plan.contacts,
          template: plan.template,
        },
      },
    }),
  );
  const summary = geometry(objects, plan.contacts);
  return { plan, objects, ...summary };
}
export function validateBatch(
  input: SceneObject[],
  existing: SceneObject[],
  inputContacts: [string, string][] = [],
) {
  if (
    !input.length ||
    input.length > MAX_PARTS ||
    input.length + existing.length > 200
  )
    throw Error("Construction exceeds component/scene limits (120/200).");
  const objects = input.map((o) => objectSchema.parse(o)),
    contacts = contactsSchema.parse(inputContacts),
    ids = new Set(existing.map((o) => o.id));
  const group = objects[0].construction?.structureId,
    partIds = new Set<string>();
  if (!group || existing.some((o) => o.construction?.structureId === group))
    throw Error("New structure identity required.");
  for (const o of objects) {
    if (
      o.type === "model" ||
      !o.construction ||
      o.construction.structureId !== group ||
      ids.has(o.id) ||
      partIds.has(o.construction.partId)
    )
      throw Error("Invalid construction component identity/type.");
    ids.add(o.id);
    partIds.add(o.construction.partId);
  }
  certifyNative(objects);
  if (objects[0].construction?.structure?.standaloneStairs) {
    nativeSupport(objects, existing);
    const min = Math.min(...objects.map((o) => bounds(o).min.y));
    geometry(
      objects.map((o) => ({
        ...o,
        position: [o.position[0], o.position[1] - min, o.position[2]] as Vec3,
      })),
      contacts,
    );
  } else geometry(objects, contacts);
  if (objects.some((o) => !placement(o, o.position, existing, false).valid))
    throw Error(
      "Structure collides with existing objects or exceeds workspace bounds.",
    );
  return objects;
}
export function preparePlan(input: ConstructionPlan, existing: SceneObject[]) {
  const built = materializePlan(input);
  if (existing.length + built.objects.length > 200)
    throw Error(
      "Not enough scene capacity. Delete objects or request a smaller structure.",
    );
  const step =
    Math.ceil(Math.max(built.dimensions[0], built.dimensions[2]) / 2) + 1;
  for (let ring = 0; ring <= 8; ring++)
    for (let x = -ring; x <= ring; x++)
      for (let z = -ring; z <= ring; z++) {
        if (ring && Math.max(Math.abs(x), Math.abs(z)) !== ring) continue;
        const objects = built.objects.map((o) => ({
          ...o,
          construction: {
            ...o.construction!,
            structure: {
              ...o.construction!.structure!,
              position: [x * step, 0, z * step] as Vec3,
            },
          },
          position: [
            o.position[0] + x * step,
            o.position[1],
            o.position[2] + z * step,
          ] as Vec3,
        }));
        if (
          objects.every((o) => placement(o, o.position, existing, false).valid)
        )
          return {
            ...built,
            objects,
            base: existing,
            origin: [x * step, 0, z * step] as Vec3,
          };
      }
  throw Error("No free location for this structure within the workspace.");
}
export type PreparedPlan = ReturnType<typeof preparePlan>;
