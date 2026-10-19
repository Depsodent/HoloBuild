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

it("staircase movement reuses gesture group previews, moves its slab opening and commits once", async () => {
  const { useSceneStore } = await import("../../src/scene/sceneStore");
  const { moveGroupPreview, commitPlacement } =
    await import("../../src/interaction/structureInteraction");
  const { undo, redo, execute } =
    await import("../../src/scene/commandManager");
  const objects = materializePlan(build({ x: 0 })).objects;
  const step = objects.find((o) => o.construction?.role === "stair")!;
  useSceneStore.setState({
    objects,
    selectedId: step.id,
    selectedStructureId: null,
    selectionMode: "component",
    past: [],
    future: [],
    preview: null,
    snap: false,
  });
  const preview = moveGroupPreview(step.id, [
    step.position[0] + 0.25,
    step.position[1],
    step.position[2],
  ])!;
  expect(preview.valid).toBe(true);
  expect(preview.structure?.operation.type).toBe("design");
  expect(useSceneStore.getState().objects).toBe(objects);
  expect(commitPlacement(preview)).toBe(true);
  const moved = useSceneStore.getState().objects;
  expect(useSceneStore.getState().past).toHaveLength(1);
  expect(
    moved.find((o) => o.id === step.id)?.construction?.structure?.template
      ?.stairs?.[0].x,
  ).toBeCloseTo(0.25);
  expect(useSceneStore.getState().selectedStructureId).toBeNull();
  undo();
  expect(useSceneStore.getState().objects).toEqual(objects);
  redo();
  expect(useSceneStore.getState().objects).toEqual(moved);
  const selected = moved.find((o) => o.construction?.assembly === stair.id)!;
  useSceneStore.getState().select(selected.id);
  const stationary = moveGroupPreview(selected.id, selected.position)!;
  expect(commitPlacement(stationary)).toBe(true);
  expect(useSceneStore.getState().past).toHaveLength(1);
  expect(
    moveGroupPreview(selected.id, [
      selected.position[0],
      selected.position[1] + 1,
      selected.position[2],
    ])?.valid,
  ).toBe(false);
  expect(
    execute({
      type: "update",
      id: selected.id,
      patch: { position: [0, 5, 0] },
    }),
  ).toBe(false);
  expect(useSceneStore.getState().objects).toBe(moved);
  expect(execute({ type: "delete", id: selected.id })).toBe(true);
  expect(
    useSceneStore
      .getState()
      .objects.some((o) => o.construction?.role === "stair"),
  ).toBe(false);
});

it("unrelated manual wall edits retain staircase parameters; later stair edits preserve that wall and protect connecting floors", async () => {
  const { useSceneStore } = await import("../../src/scene/sceneStore");
  const { execute } = await import("../../src/scene/commandManager");
  const { applyStructure } = await import("../../src/scene/structures");
  const objects = materializePlan(build({ x: 0 })).objects;
  const wall = objects.find((o) => o.name.includes("side -1"))!;
  useSceneStore.setState({
    objects,
    past: [],
    future: [],
    preview: null,
    selectedId: wall.id,
    selectedStructureId: null,
    selectionMode: "component",
    snap: false,
  });
  expect(
    execute({
      type: "update",
      id: wall.id,
      patch: {
        position: [wall.position[0] - 0.2, wall.position[1], wall.position[2]],
      },
    }),
  ).toBe(true);
  const edited = useSceneStore.getState().objects;
  const step = edited.find((o) => o.construction?.role === "stair")!;
  expect(step.construction?.structure?.template).toBeUndefined();
  expect(
    step.construction?.structure?.architectureTemplate?.stairs,
  ).toHaveLength(1);
  const definition =
    step.construction!.structure!.architectureTemplate!.stairs![0];
  const result = applyStructure(edited, step.construction!.structureId, {
    type: "design",
    stairs: [{ ...definition, width: 1.2 }],
  });
  expect(result.objects.find((o) => o.id === wall.id)?.position).toEqual(
    edited.find((o) => o.id === wall.id)!.position,
  );
  expect(
    result.parts.find((o) => o.id === step.id)?.construction?.structure
      ?.architectureTemplate?.stairs?.[0].width,
  ).toBe(1.2);
  const floor = edited.find((o) => o.construction?.role === "floor")!;
  expect(execute({ type: "delete", id: floor.id })).toBe(false);
  expect(
    execute({ type: "delete", id: step.id }),
    useSceneStore.getState().status,
  ).toBe(true);
  expect(
    useSceneStore
      .getState()
      .objects.some((o) => o.construction?.role === "stair"),
  ).toBe(false);
});

it("connects three floors with separate flights and preserves hierarchy through whole-building transformations", async () => {
  const plan = offlinePlan("house", {
    width: 6,
    depth: 6,
    height: 3,
    floors: 3,
    stairs: [stair, { ...stair, id: "stairs-2", from: 1, to: 2, x: 1 }],
  });
  const objects = materializePlan(plan).objects;
  const top = objects
    .filter((o) => o.construction?.assembly === "stairs-2")
    .at(-1)!;
  expect(bounds(top).max.y).toBeCloseTo(6.6);
  expect(
    objects.filter(
      (o) => o.construction?.role === "floor" && o.construction.level === 1,
    ),
  ).toHaveLength(4);
  expect(
    objects.filter(
      (o) => o.construction?.role === "floor" && o.construction.level === 2,
    ),
  ).toHaveLength(4);
  const { applyStructure } = await import("../../src/scene/structures");
  const id = objects[0].construction!.structureId;
  const rotated = applyStructure(objects, id, {
    type: "rotate",
    angle: Math.PI / 6,
  });
  const scaled = applyStructure(rotated.objects, id, {
    type: "scale",
    factors: [1.1, 1.1, 1.1],
  });
  expect(new Set(scaled.parts.map((o) => o.construction?.structureId))).toEqual(
    new Set([id]),
  );
  expect(deserialize(serialize(scaled.objects))).toEqual(
    JSON.parse(JSON.stringify(scaled.objects)),
  );
});
