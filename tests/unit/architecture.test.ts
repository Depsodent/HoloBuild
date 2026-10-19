import { expect, it } from "vitest";
import { offlinePlan } from "../../src/generation/offline";
import { materializePlan } from "../../src/generation/engine";
import { stairFootprint } from "../../src/generation/architecture";
import { staircaseSchema, type Staircase } from "../../shared/planSchema.mjs";
import { serialize, deserialize } from "../../src/scene/sceneSerializer";
import { bounds } from "../../src/interaction/placement";
const stair: Staircase = {
  id: "stairs-1",
  from: 0,
  to: 1,
  steps: 16,
  rise: 0.2,
  run: 0.2,
  width: 1,
  x: -1,
  z: 0,
  yaw: 0,
  material: "wood",
  color: "#91603e",
};
const build = (patch: Partial<Staircase> = {}) =>
  offlinePlan("house", {
    width: 6,
    depth: 6,
    height: 3,
    floors: 2,
    stairs: [{ ...stair, ...patch }],
  });
it("parametric stairs have real steps, exact floor elevations and an empty upper slab footprint", () => {
  const plan = build();
  const built = materializePlan(plan);
  const steps = built.objects.filter(
    (o) => o.construction?.assembly === stair.id,
  );
  expect(steps).toHaveLength(16);
  expect(
    steps.every(
      (o) => o.material === "wood" && o.construction?.role === "stair",
    ),
  ).toBe(true);
  expect(bounds(steps[0]).min.y).toBeCloseTo(0.2);
  expect(bounds(steps.at(-1)!).max.y).toBeCloseTo(3.4);
  const hole = stairFootprint(stair);
  const floor = built.objects.filter(
    (o) => o.construction?.role === "floor" && o.construction.level === 1,
  );
  expect(floor).toHaveLength(4);
  for (const p of floor) {
    const b = bounds(p);
    expect(
      Math.min(b.max.x, hole.maxX) - Math.max(b.min.x, hole.minX) > 1e-6 &&
        Math.min(b.max.z, hole.maxZ) - Math.max(b.min.z, hole.minZ) > 1e-6,
    ).toBe(false);
  }
  expect(deserialize(serialize(built.objects))).toEqual(built.objects);
  expect(plan.warnings.join(" ")).toContain("not certified");
});
for (const yaw of [0, 90, 180, 270] as const)
  it(`quarter-turn stair orientation ${yaw} validates real rendered primitive bounds`, () => {
    const plan = build({ yaw, x: 0, z: 0 });
    const result = materializePlan(plan);
    expect(
      result.objects.some((o) => o.construction?.assembly === "stairs-1"),
    ).toBe(true);
  });
it("rejects disconnected elevations, absent floors, wall intersections, missing landing clearance and invalid parameters", () => {
  for (const patch of [
    { rise: 0.19 },
    { to: 2 },
    { x: 2.7 },
    { z: 1.5 },
    { run: 0.5 },
    { steps: 3 },
    { width: 0.1 },
    { yaw: 45 },
  ])
    expect(() => materializePlan(build(patch as Partial<Staircase>))).toThrow();
  expect(() => staircaseSchema.parse({ ...stair, code: "execute" })).toThrow();
});
it("keeps original walls, doors and windows exactly unchanged while cutting the slab", () => {
  const original = offlinePlan("house", {
    width: 6,
    depth: 6,
    height: 3,
    floors: 2,
  });
  const next = build();
  expect(
    next.objects.filter((o) => !["floor", "stair"].includes(o.role)),
  ).toEqual(original.objects.filter((o) => o.role !== "floor"));
});
it("rejects duplicate stairs and overlapping inter-floor flights rather than declaring a fake connection", () => {
  expect(() =>
    materializePlan(
      offlinePlan("house", {
        width: 6,
        depth: 6,
        height: 3,
        floors: 3,
        stairs: [stair, { ...stair, id: "stairs-2", from: 1, to: 2 }],
      }),
    ),
  ).toThrow(/overlap|obstruct/);
  expect(() =>
    materializePlan(
      offlinePlan("house", {
        width: 6,
        depth: 6,
        height: 3,
        floors: 2,
        stairs: [stair, stair],
      }),
    ),
  ).toThrow(/Duplicate/);
});
