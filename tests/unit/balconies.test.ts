import { expect, it } from "vitest";
import { offlinePlan } from "../../src/generation/offline";
import { materializePlan } from "../../src/generation/engine";
import { balconyIntent } from "../../src/generation/balconyIntent";
import { bounds } from "../../src/interaction/placement";
import type { Balcony, Opening } from "../../shared/planSchema.mjs";
const balcony: Balcony = {
  id: "balcony-1",
  level: 1,
  facade: "front",
  offset: 0,
  width: 2.4,
  depth: 1.5,
  railHeight: 1.1,
  material: "concrete",
  color: "#aab5c2",
  access: "entry",
  ownsAccess: true,
};
const entry: Opening = {
  id: "entry",
  kind: "door",
  level: 1,
  facade: "front",
  offset: 0,
  bottom: 0,
  width: 1,
  height: 2.1,
  panel: true,
};
const build = (b = balcony, o = entry) =>
  offlinePlan("house", {
    width: 6,
    depth: 6,
    height: 3,
    floors: 2,
    doors: 0,
    windows: 0,
    openings: [o],
    balconies: [b],
  });
it("balcony slabs meet their actual floor with three rails, posts and a real access door on all facades", () => {
  for (const facade of ["front", "back", "left", "right"] as const) {
    const plan = build({ ...balcony, facade }, { ...entry, facade });
    const built = materializePlan(plan);
    const pieces = built.objects.filter(
      (o) => o.construction?.role === "balcony",
    );
    expect(pieces).toHaveLength(8);
    const slab = pieces.find((o) => o.construction?.partId.endsWith("slab"))!;
    expect(bounds(slab).max.y).toBeCloseTo(3.4);
    expect(
      pieces.every(
        (o) =>
          o.construction?.assembly === "balcony-1" &&
          o.construction.level === 1,
      ),
    ).toBe(true);
    expect(built.objects.some((o) => o.construction?.opening === "entry")).toBe(
      true,
    );
  }
});
it("balconies reject missing/misaligned access, nonexistent floors, overhanging corners and intersections", () => {
  for (const [b, o] of [
    [{ ...balcony, offset: 3 }, entry],
    [{ ...balcony, level: 2 }, entry],
    [balcony, { ...entry, offset: 1 }],
    [balcony, { ...entry, kind: "window" as const, bottom: 1 }],
  ] as [Balcony, Opening][])
    expect(() => materializePlan(build(b, o))).toThrow();
  const original = build();
  expect(() =>
    materializePlan({
      ...original,
      objects: original.objects.filter((o) => o.role !== "balcony"),
    }),
  ).toThrow(/recipe/);
});
it("balcony requests clarify floor/facade, preserve openings and never silently replace a window for access", () => {
  const base = offlinePlan("house", {
    width: 6,
    depth: 6,
    height: 3,
    floors: 2,
    windows: 0,
    doors: 0,
  }).template!;
  expect(balconyIntent("Add a balcony", base)?.message).toMatch(
    /Which upper floor/,
  );
  expect(
    balconyIntent("Add a balcony on the second floor", base)?.message,
  ).toMatch(/Which facade/);
  const result = balconyIntent(
    "Add a balcony on the second floor on the front",
    base,
  )!;
  expect(result.operation?.type).toBe("design");
  if (result.operation?.type !== "design") throw Error(result.message);
  const plan = offlinePlan("house", { ...base, ...result.operation });
  materializePlan(plan);
  expect(plan.template?.balconies).toHaveLength(1);
  expect(plan.template?.openings).toHaveLength(1);
  const blocked = {
    ...base,
    openings: [{ ...entry, kind: "window" as const, bottom: 1 }],
  };
  expect(
    balconyIntent("Add a balcony on the second floor on the front", blocked)
      ?.message,
  ).toMatch(/overlap/);
});

it("balcony gesture/Inspector transforms update access, preserve other components and commit exactly once", async () => {
  const { useSceneStore } = await import("../../src/scene/sceneStore");
  const { execute, undo, redo } =
    await import("../../src/scene/commandManager");
  const { moveGroupPreview, commitPlacement } =
    await import("../../src/interaction/structureInteraction");
  const { serialize, deserialize } =
    await import("../../src/scene/sceneSerializer");
  const objects = materializePlan(build()).objects;
  const slab = objects.find((o) => o.construction?.role === "balcony")!;
  useSceneStore.setState({
    objects,
    selectedId: slab.id,
    selectedStructureId: null,
    selectionMode: "component",
    past: [],
    future: [],
    preview: null,
    snap: false,
  });
  const preview = moveGroupPreview(slab.id, [
    slab.position[0] + 0.25,
    slab.position[1],
    slab.position[2],
  ])!;
  expect(preview.valid).toBe(true);
  expect(useSceneStore.getState().objects).toBe(objects);
  expect(commitPlacement(preview)).toBe(true);
  const moved = useSceneStore.getState().objects;
  expect(useSceneStore.getState().past).toHaveLength(1);
  expect(useSceneStore.getState().selectedId).toBe(slab.id);
  expect(
    moved.find((o) => o.construction?.opening === "entry")!.position[0],
  ).toBeCloseTo(0.25);
  expect(deserialize(serialize(moved))).toEqual(
    JSON.parse(JSON.stringify(moved)),
  );
  undo();
  expect(useSceneStore.getState().objects).toEqual(objects);
  redo();
  expect(useSceneStore.getState().objects).toEqual(moved);
  expect(
    execute({
      type: "delete",
      id: moved.find((o) => o.construction?.opening === "entry")!.id,
    }),
  ).toBe(false);
  expect(useSceneStore.getState().objects).toBe(moved);
  expect(
    execute({ type: "update", id: slab.id, patch: { color: "#508ee8" } }),
  ).toBe(true);
  expect(
    useSceneStore
      .getState()
      .objects.filter((o) => o.construction?.role === "balcony")
      .every((o) => o.color === "#508ee8"),
  ).toBe(true);
  expect(execute({ type: "delete", id: slab.id })).toBe(true);
  expect(
    useSceneStore
      .getState()
      .objects.some(
        (o) =>
          o.construction?.role === "balcony" ||
          o.construction?.opening === "entry",
      ),
  ).toBe(false);
  undo();
  expect(
    useSceneStore
      .getState()
      .objects.filter((o) => o.construction?.role === "balcony"),
  ).toHaveLength(8);
});
it("removing a balcony preserves a pre-existing doorway it does not own", async () => {
  const { applyStructure } = await import("../../src/scene/structures");
  const { balconyOperation } = await import("../../src/scene/balconyTransform");
  const objects = materializePlan(
    build({ ...balcony, ownsAccess: false }),
  ).objects;
  const slab = objects.find((o) => o.construction?.role === "balcony")!;
  const result = applyStructure(
    objects,
    slab.construction!.structureId,
    balconyOperation(objects, slab.id, { type: "delete" }),
  );
  expect(result.parts.some((o) => o.construction?.opening === "entry")).toBe(
    true,
  );
});

it("per-floor window count edits choose free facade apertures while preserving balcony access", async () => {
  const { applyStructure } = await import("../../src/scene/structures");
  const objects = materializePlan(build()).objects;
  const result = applyStructure(objects, objects[0].construction!.structureId, {
    type: "design",
    windows: 1,
  });
  expect(
    result.parts.filter((o) => o.construction?.role === "window"),
  ).toHaveLength(2);
  expect(
    result.parts.find((o) => o.construction?.opening === "entry")!.position,
  ).toEqual(objects.find((o) => o.construction?.opening === "entry")!.position);
  expect(
    result.parts
      .filter((o) => o.construction?.role === "balcony")
      .map((o) => [o.id, o.position, o.scale]),
  ).toEqual(
    objects
      .filter((o) => o.construction?.role === "balcony")
      .map((o) => [o.id, o.position, o.scale]),
  );
});
it("untrusted balcony-tagged geometry cannot omit its certified access recipe", () => {
  const plan = build();
  expect(() => materializePlan({ ...plan, template: undefined })).toThrow(
    /recipe/,
  );
});
