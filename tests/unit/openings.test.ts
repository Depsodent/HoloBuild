import { expect, it } from "vitest";
import { offlinePlan } from "../../src/generation/offline";
import { materializePlan } from "../../src/generation/engine";
import { openingDefinitions } from "../../src/generation/openings";
import { openingSchema, type Opening } from "../../shared/planSchema.mjs";
import { bounds } from "../../src/interaction/placement";
const openings: Opening[] = [
  {
    id: "front-window",
    kind: "window",
    level: 0,
    facade: "front",
    offset: -1.4,
    bottom: 1.1,
    width: 1,
    height: 1,
    panel: true,
  },
  {
    id: "front-door",
    kind: "door",
    level: 0,
    facade: "front",
    offset: 0.6,
    bottom: 0,
    width: 1,
    height: 2.1,
    panel: true,
  },
  {
    id: "upper-left",
    kind: "window",
    level: 1,
    facade: "left",
    offset: 0,
    bottom: 1,
    width: 1,
    height: 1,
    panel: true,
  },
];
const build = (list = openings) =>
  offlinePlan("house", {
    width: 6,
    depth: 6,
    height: 3,
    floors: 2,
    doors: 0,
    windows: 0,
    openings: list,
  });
it("builds real selected-floor openings on all facade orientations with static panels", () => {
  for (const facade of ["front", "back", "left", "right"] as const) {
    const plan = build([{ ...openings[2], facade }]);
    const built = materializePlan(plan);
    const panel = built.objects.find(
      (o) => o.construction?.opening === "upper-left",
    )!;
    expect(panel.construction).toMatchObject({
      role: "window",
      level: 1,
      facade,
      opening: "upper-left",
    });
    expect(plan.template?.windowCounts).toEqual([0, 1]);
    const p = bounds(panel);
    for (const wall of built.objects.filter(
      (o) =>
        o.construction?.role === "wall" &&
        o.construction.facade === facade &&
        o.construction.level === 1,
    )) {
      const b = bounds(wall);
      expect(
        [
          Math.min(p.max.x, b.max.x) - Math.max(p.min.x, b.min.x),
          Math.min(p.max.y, b.max.y) - Math.max(p.min.y, b.min.y),
          Math.min(p.max.z, b.max.z) - Math.max(p.min.z, b.min.z),
        ].every((n) => n > 1e-5),
      ).toBe(false);
    }
  }
  const plan = build();
  materializePlan(plan);
  expect(plan.objects.find((o) => o.opening === "front-door")?.name).toContain(
    "static door",
  );
});
it("explicitly removing all openings produces sealed walls and adding an unpanelled entrance leaves a true void", () => {
  const closed = build([]);
  expect(
    closed.objects.some((o) => o.role === "window" || o.role === "door"),
  ).toBe(false);
  materializePlan(closed);
  const doorway = build([{ ...openings[1], panel: false }]);
  expect(doorway.objects.some((o) => o.role === "door")).toBe(false);
  materializePlan(doorway);
});
it("rejects overlapping or out-of-bounds holes, absent floors and invalid lintels", () => {
  for (const list of [
    [openings[0], { ...openings[1], offset: -1.4 }],
    [{ ...openings[0], offset: 3 }],
    [{ ...openings[0], level: 2 }],
    [{ ...openings[0], height: 3 }],
    [openings[0], openings[0]],
  ])
    expect(() => materializePlan(build(list))).toThrow();
  expect(() => openingSchema.parse({ ...openings[0], hinged: true })).toThrow();
});
it("converting the existing segmented openings to explicit definitions preserves actual legacy geometry", () => {
  const legacy = offlinePlan("house", {
    width: 6,
    depth: 6,
    height: 3,
    floors: 2,
    windows: 2,
  });
  const explicit = offlinePlan("house", {
    ...legacy.template!,
    openings: openingDefinitions(legacy.template!),
  });
  const physical = (plan: typeof legacy) =>
    plan.objects
      .map((o) =>
        JSON.stringify([
          o.role,
          o.type,
          o.position.map((n) => Number(n.toFixed(9))),
          o.rotation.map((n) => Number(n.toFixed(9))),
          o.dimensions.map((n) => Number(n.toFixed(9))),
        ]),
      )
      .sort();
  expect(physical(explicit)).toEqual(physical(legacy));
  materializePlan(explicit);
});

it("selected opening movement rebuilds its wall once, preserves unrelated parts and restores exact history", async () => {
  const { useSceneStore } = await import("../../src/scene/sceneStore");
  const { moveGroupPreview, commitPlacement } =
    await import("../../src/interaction/structureInteraction");
  const { execute, undo, redo } =
    await import("../../src/scene/commandManager");
  const { serialize, deserialize } =
    await import("../../src/scene/sceneSerializer");
  const objects = materializePlan(build()).objects;
  const panel = objects.find((o) => o.construction?.opening === "upper-left")!;
  useSceneStore.setState({
    objects,
    selectedId: panel.id,
    selectedStructureId: null,
    selectionMode: "component",
    preview: null,
    past: [],
    future: [],
    snap: false,
  });
  const preview = moveGroupPreview(panel.id, [
    panel.position[0],
    panel.position[1],
    panel.position[2] + 0.25,
  ])!;
  expect(preview.valid).toBe(true);
  expect(useSceneStore.getState().objects).toBe(objects);
  expect(commitPlacement(preview)).toBe(true);
  const moved = useSceneStore.getState().objects;
  expect(useSceneStore.getState().past).toHaveLength(1);
  expect(useSceneStore.getState().selectedId).toBe(panel.id);
  expect(moved.find((o) => o.id === panel.id)!.position[2]).toBeCloseTo(0.25);
  const floors = (items: typeof objects) =>
    items
      .filter((o) => o.construction?.role === "floor")
      .map((o) => [o.id, o.position, o.rotation, o.scale, o.color, o.material]);
  expect(floors(moved)).toEqual(floors(objects));
  expect(deserialize(serialize(moved))).toEqual(
    JSON.parse(JSON.stringify(moved)),
  );
  undo();
  expect(useSceneStore.getState().objects).toEqual(objects);
  redo();
  expect(useSceneStore.getState().objects).toEqual(moved);
  expect(execute({ type: "delete", id: panel.id })).toBe(true);
  expect(
    useSceneStore
      .getState()
      .objects.some((o) => o.construction?.opening === "upper-left"),
  ).toBe(false);
  expect(useSceneStore.getState().past).toHaveLength(2);
  undo();
  expect(useSceneStore.getState().objects).toEqual(moved);
});
it("rejects a model recipe whose actual geometry omits the real aperture or staircase", () => {
  const plan = build();
  const fake = offlinePlan("house", {
    width: 6,
    depth: 6,
    height: 3,
    floors: 2,
    windows: 0,
    doors: 0,
  });
  expect(() => materializePlan({ ...fake, template: plan.template })).toThrow(
    /recipe/,
  );
  expect(() =>
    materializePlan({
      ...fake,
      objects: fake.objects.map((p, i) => (i ? p : { ...p, role: "stair" })),
    }),
  ).toThrow(/recipe/);
});
it("opening additions preserve existing holes and clarify missing floors instead of guessing", async () => {
  const { openingIntent } = await import("../../src/generation/openingIntent");
  const recipe = build().template!;
  expect(openingIntent("Add a window", recipe)?.message).toMatch(/Which floor/);
  const change = openingIntent(
    "Add a window on the second floor",
    recipe,
  )!.operation;
  expect(change?.type).toBe("design");
  if (change?.type !== "design") throw Error("missing operation");
  expect(change.openings).toHaveLength(4);
  expect(change.openings!.slice(0, 3)).toEqual(openings);
  materializePlan(
    offlinePlan(recipe.kind, { ...recipe, openings: change.openings }),
  );
});

it("opening edits preserve an unrelated manually moved facade and reject rebuilding the altered facade", async () => {
  const { useSceneStore } = await import("../../src/scene/sceneStore");
  const { execute } = await import("../../src/scene/commandManager");
  const { applyStructure } = await import("../../src/scene/structures");
  const objects = materializePlan(build()).objects;
  const wall = objects.find(
    (o) => o.construction?.role === "wall" && o.construction.facade === "right",
  )!;
  useSceneStore.setState({
    objects,
    selectedId: wall.id,
    selectedStructureId: null,
    selectionMode: "component",
    past: [],
    future: [],
    preview: null,
    snap: false,
  });
  expect(
    execute({
      type: "update",
      id: wall.id,
      patch: {
        position: [wall.position[0] + 0.2, wall.position[1], wall.position[2]],
      },
    }),
  ).toBe(true);
  const edited = useSceneStore.getState().objects;
  const changed = applyStructure(edited, wall.construction!.structureId, {
    type: "design",
    openings: openings.map((d) =>
      d.id === "upper-left" ? { ...d, width: 1.2 } : d,
    ),
  });
  expect(changed.objects.find((o) => o.id === wall.id)!.position).toEqual(
    edited.find((o) => o.id === wall.id)!.position,
  );
  expect(() =>
    applyStructure(edited, wall.construction!.structureId, {
      type: "design",
      openings: [
        ...openings,
        { ...openings[2], id: "right-new", level: 0, facade: "right" },
      ],
    }),
  ).toThrow(/match/);
});
