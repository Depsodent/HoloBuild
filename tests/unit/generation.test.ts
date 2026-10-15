import { beforeEach, it, expect } from "vitest";
import {
  planSchema,
  parseModelPlan,
  cleanPrompt,
  materials,
  shapes,
} from "../../shared/planSchema.mjs";
import { offlinePlan } from "../../src/generation/offline";
import {
  materializePlan,
  preparePlan,
  validateBatch,
} from "../../src/generation/engine";
import { useSceneStore } from "../../src/scene/sceneStore";
import { execute, undo, redo } from "../../src/scene/commandManager";
import { serialize, deserialize } from "../../src/scene/sceneSerializer";
import { MATERIAL_IDS } from "../../src/scene/materialPresets";
import { createCube, SHAPES } from "../../src/scene/objectFactory";
beforeEach(() =>
  useSceneStore.setState({
    objects: [],
    selectedId: null,
    past: [],
    future: [],
    preview: null,
    snap: true,
  }),
);
it("honors negated openings, an explicit room roof, and bridge deck materials", () => {
  const p = offlinePlan("house without doors and no windows");
  expect(p.objects.some((o) => o.role === "door" || o.role === "window")).toBe(
    false,
  );
  expect(
    offlinePlan("room with a roof").objects.some((o) => o.role === "roof"),
  ).toBe(true);
  expect(
    offlinePlan("wooden bridge").objects.find((o) => o.role === "floor")
      ?.material,
  ).toBe("wood");
  expect(() => offlinePlan("house width -6")).toThrow();
  expect(offlinePlan("bridge", { doors: 1 }).warnings.join(" ")).toContain(
    "unsupported",
  );
});
it("honors no-roof requests and separates wall/roof material phrases", () => {
  expect(
    offlinePlan("house without a roof").objects.some((o) => o.role === "roof"),
  ).toBe(false);
  const p = offlinePlan("house with brick walls and a metal roof");
  expect(
    p.objects
      .filter((o) => o.role === "wall")
      .every((o) => o.material === "brick"),
  ).toBe(true);
  expect(p.objects.find((o) => o.role === "roof")?.material).toBe("solid");
  expect(
    offlinePlan("house floors 2").objects.filter((o) => o.role === "floor"),
  ).toHaveLength(2);
});
it("shared allowlists match the existing scene factories/materials", () => {
  expect(materials).toEqual([...MATERIAL_IDS]);
  expect(shapes).toEqual(Object.keys(SHAPES));
});
it.each([
  "Build a small house with four walls and a roof",
  "Generate a room with a floor, four walls, and a doorway",
  "Build a tower with five levels",
  "Create a small warehouse with a metal roof",
  "Generate a simple bridge supported by pillars",
  "Build a garden shed with wooden walls",
  "Create a modern two-story house with windows",
  "Create a modern glass office building",
])("offline template validates and aligns: %s", (prompt) => {
  const built = materializePlan(offlinePlan(prompt));
  expect(validateBatch(built.objects, [], built.plan.contacts)).toHaveLength(
    built.objects.length,
  );
  expect(built.box.min.y).toBeCloseTo(0);
  expect(
    built.objects.every(
      (o) =>
        o.construction?.structureId ===
        built.objects[0].construction?.structureId,
    ),
  ).toBe(true);
});
it("floors, dimensions, openings and materials are configured consistently", () => {
  const plan = offlinePlan("build a two-story house with windows", {
      width: 8,
      depth: 6,
      height: 3,
      material: "brick",
    }),
    built = materializePlan(plan);
  built.dimensions.forEach((v, i) => expect(v).toBeCloseTo([8, 6.6, 6][i]));
  expect(
    plan.objects.filter((o) => o.role === "floor").map((o) => o.position[1]),
  ).toEqual([0.1, 3.3000000000000003]);
  expect(plan.objects.filter((o) => o.role === "window")).toHaveLength(4);
  expect(
    plan.objects
      .filter((o) => o.role === "wall")
      .every((o) => o.material === "brick"),
  ).toBe(true);
  expect(
    offlinePlan("room with a doorway").objects.some((o) => o.role === "door"),
  ).toBe(false);
});
it.each([
  "castle",
  "house and bridge",
  "tower with 50 levels",
  "house width 100",
  "room with two floors",
  "house with two doors and four windows",
])("rejects ambiguous/unsupported/invalid layout: %s", (prompt) =>
  expect(() => materializePlan(offlinePlan(prompt))).toThrow(),
);
it("reports unsupported requested details instead of silently claiming them", () => {
  expect(
    offlinePlan("house with a swimming pool and gable roof").warnings.join(" "),
  ).toMatch(/pool/);
  expect(offlinePlan("house with a gable roof").warnings.join(" ")).toMatch(
    /unsupported/,
  );
});
it("schema rejects unknown shapes/materials/properties, excessive counts and unsafe values", () => {
  const base = offlinePlan("house");
  for (const patch of [
    { type: "model" },
    { material: "lava" },
    { position: [0, Infinity, 0] },
    { rotation: [999, 0, 0] },
    { dimensions: [-1, 2, 3] },
    { script: "alert(1)" },
  ])
    expect(() =>
      planSchema.parse({
        ...base,
        objects: [{ ...base.objects[0], ...patch }],
      }),
    ).toThrow();
  expect(() =>
    planSchema.parse({ ...base, objects: Array(121).fill(base.objects[0]) }),
  ).toThrow();
  expect(() =>
    planSchema.parse({ ...base, contacts: [["missing", "part-1"]] }),
  ).toThrow();
  expect(() => planSchema.parse({ ...base, execute: "delete" })).toThrow();
});
it("untrusted model output accepts only bounded JSON plans, never code/prose", () => {
  const p = offlinePlan("room");
  expect(parseModelPlan(JSON.stringify(p))).toEqual(p);
  expect(parseModelPlan("```json\n" + JSON.stringify(p) + "\n```")).toEqual(p);
  for (const input of [
    "<script>alert(1)</script>",
    "Here is a house: {}",
    "x".repeat(131073),
  ])
    expect(() => parseModelPlan(input)).toThrow();
  for (const input of ["", "a".repeat(1201), "house\u0000"])
    expect(() => cleanPrompt(input)).toThrow();
});
it("rejects disconnected floating parts and deep overlap; explicit shallow contacts stay bounded", () => {
  const built = materializePlan(offlinePlan("room"));
  const floating = structuredClone(built.objects);
  floating[1].position[1] += 5;
  expect(() => validateBatch(floating, [])).toThrow();
  const duplicate = {
    ...built.objects[0],
    id: crypto.randomUUID(),
    construction: { ...built.objects[0].construction!, partId: "extra" },
  };
  expect(() =>
    validateBatch([...built.objects, duplicate], [], [["part-1", "extra"]]),
  ).toThrow();
});
it("preview is inert, placement avoids existing scene, one batch is atomic with stable redo IDs and save/load metadata", () => {
  const cube = createCube();
  useSceneStore.setState({ objects: [cube] });
  const base = useSceneStore.getState().objects,
    prepared = preparePlan(offlinePlan("house"), base);
  expect(useSceneStore.getState().objects).toEqual([cube]);
  expect(useSceneStore.getState().past).toHaveLength(0);
  expect(prepared.origin).not.toEqual([0, 0, 0]);
  expect(
    execute({
      type: "construct",
      objects: prepared.objects,
      contacts: prepared.plan.contacts,
    }),
  ).toBe(true);
  const result = useSceneStore.getState().objects;
  expect(useSceneStore.getState().past).toHaveLength(1);
  undo();
  expect(useSceneStore.getState().objects).toEqual([cube]);
  redo();
  expect(useSceneStore.getState().objects).toEqual(result);
  expect(deserialize(serialize(result))).toEqual(result);
});
it("invalid batch preserves objects/history and cannot bypass budgets/preview checks", () => {
  const p = preparePlan(offlinePlan("house"), []),
    bad = structuredClone(p.objects);
  bad[1].position = [0, 45, 0];
  expect(execute({ type: "construct", objects: bad })).toBe(false);
  expect(useSceneStore.getState().objects).toEqual([]);
  expect(useSceneStore.getState().past).toHaveLength(0);
  expect(() =>
    validateBatch(p.objects, Array(200).fill(createCube())),
  ).toThrow();
  useSceneStore.setState({
    preview: { id: "x", position: [0, 0, 0], valid: true },
  });
  expect(execute({ type: "construct", objects: p.objects })).toBe(false);
});
