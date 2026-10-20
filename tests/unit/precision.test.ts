import { beforeEach, expect, it } from "vitest";
import { createCube, createObject } from "../../src/scene/objectFactory";
import {
  meters,
  dimensions,
  dimensionPatch,
  precisionUpdate,
  floorPosition,
  structureDimensionOperation,
} from "../../src/scene/precision";
import { snapCoordinate } from "../../src/interaction/coordinateMapping";
import { usePrecisionSettings } from "../../src/scene/precisionSettings";
import { useSceneStore } from "../../src/scene/sceneStore";
import { execute, undo, redo } from "../../src/scene/commandManager";
import { surfaceValues } from "../../src/scene/surface";
import { serialize, deserialize } from "../../src/scene/sceneSerializer";
import { operationSchema } from "../../shared/editSchema.mjs";
import { precisionIntent } from "../../src/generation/precisionIntent";
import {
  confirmEdit,
  cancelEdit,
  useEditStore,
} from "../../src/generation/editStore";
import { materializePlan } from "../../src/generation/engine";
import { offlinePlan } from "../../src/generation/offline";
import { applyStructure } from "../../src/scene/structures";
const cube = () => createCube();
const settings = { mode: "offline" as const };
beforeEach(() => {
  cancelEdit();
  const o = cube();
  useSceneStore.setState({
    objects: [o],
    selectedId: o.id,
    selectedStructureId: null,
    selectionMode: "component",
    past: [],
    future: [],
    preview: null,
    snap: true,
  });
  usePrecisionSettings.setState({
    gridStep: 0.5,
    measurements: false,
    guides: true,
  });
});
it("converts metres centimetres millimetres and rejects nonfinite measurements", () => {
  expect(meters(20, "centimeters")).toBe(0.2);
  expect(meters(50, "mm")).toBe(0.05);
  expect(meters(3)).toBe(3);
  expect(() => meters(NaN)).toThrow();
});
it("snaps configurable increments symmetrically without accepting zero/NaN steps", () => {
  for (const step of [0.05, 0.1, 0.25, 0.5, 1])
    expect(snapCoordinate(1.13, step)).toBeCloseTo(
      Math.round(1.13 / step) * step,
    );
  expect(snapCoordinate(-1.13, 0.1)).toBeCloseTo(-1.1);
  expect(snapCoordinate(1, 0)).toBeNaN();
  usePrecisionSettings.setState({ gridStep: 0.1 });
  expect(snapCoordinate(0.24)).toBeCloseTo(0.2);
});
it("dimensions use the real local shape size and reject invalid scales", () => {
  const wall = createObject("wall", [0, 1, 0]);
  const p = dimensionPatch(wall, 0, 4);
  expect(dimensions({ ...wall, ...p })[0]).toBe(4);
  expect(() => dimensionPatch(wall, 0, -1)).toThrow();
  expect(() =>
    precisionUpdate([wall], wall, dimensionPatch(wall, 0, 100)),
  ).toThrow();
});
it("precise position and grounded dimensions create exact atomic history despite grid preference", () => {
  const o = useSceneStore.getState().objects[0];
  expect(
    execute(precisionUpdate([o], o, { position: [0.2, 0.5, 0] }).command),
  ).toBe(true);
  expect(useSceneStore.getState().objects[0].position[0]).toBe(0.2);
  undo();
  expect(useSceneStore.getState().objects[0]).toEqual(o);
  redo();
  expect(useSceneStore.getState().objects[0].position[0]).toBe(0.2);
});
it("surface changes render transparency on any preset and survive history and serialization", () => {
  const o = useSceneStore.getState().objects[0];
  expect(
    execute({
      type: "update",
      id: o.id,
      patch: { surface: { roughness: 0.2, metalness: 0.8, opacity: 0.5 } },
    }),
  ).toBe(true);
  const changed = useSceneStore.getState().objects;
  expect(surfaceValues(changed[0]).transparent).toBe(true);
  expect(surfaceValues(changed[0]).depthWrite).toBe(false);
  expect(deserialize(serialize(changed))).toEqual(changed);
  undo();
  expect(useSceneStore.getState().objects[0]).toEqual(o);
  redo();
  expect(useSceneStore.getState().objects).toEqual(changed);
});
it("strict surface operation rejects unknown fields ranges empty or conflicting resets", () => {
  for (const operation of [
    { type: "surface", values: {} },
    { type: "surface", values: { roughness: 2 } },
    { type: "surface", values: { opacity: 0 } },
    { type: "surface", values: { code: "run" } },
    { type: "surface", values: { roughness: 0.2 }, reset: true },
  ])
    expect(() => operationSchema.parse(operation)).toThrow();
  expect(operationSchema.parse({ type: "surface", reset: true })).toEqual({
    type: "surface",
    reset: true,
  });
});
it("floor attachment uses the real support top and rejects collisions", () => {
  const floor = createObject("floor", [0, 0.1, 0]),
    o = createCube([0, 2, 0]);
  const p = floorPosition(o, [o, floor]);
  expect(p[1]).toBeCloseTo(0.7);
  expect(
    precisionUpdate([o, floor], o, { position: p }).parts[0].position,
  ).toEqual(p);
  const other = createCube([0, 0.7, 0]);
  expect(() =>
    precisionUpdate([o, other], o, { position: [0, 0.7, 0] }),
  ).toThrow(/placement/);
});
it("AI surface preview is inert cancelable and selection bound", async () => {
  const base = useSceneStore.getState().objects;
  await precisionIntent("Set opacity to 50%", settings);
  expect(useSceneStore.getState().objects).toBe(base);
  cancelEdit();
  expect(useSceneStore.getState().objects).toBe(base);
  await precisionIntent("Make this object less rough", settings);
  expect(confirmEdit()).toBe(true);
  expect(useSceneStore.getState().past).toHaveLength(1);
  undo();
  expect(useSceneStore.getState().objects).toEqual(base);
});
it("AI centimetre move and dimension requests are precise preview commands", async () => {
  const base = useSceneStore.getState().objects;
  await precisionIntent(
    "Move this object 20 centimeters to the right",
    settings,
  );
  expect(useSceneStore.getState().objects).toBe(base);
  expect(confirmEdit()).toBe(true);
  expect(useSceneStore.getState().objects[0].position[0]).toBe(0.2);
  await precisionIntent("Make this object 2 meters wide", settings);
  expect(confirmEdit()).toBe(true);
  expect(dimensions(useSceneStore.getState().objects[0])[0]).toBe(2);
});
it("structure role surfaces preserve geometry, unrelated structures and exact history", async () => {
  const house = materializePlan(offlinePlan("house")).objects,
    other = createCube([20, 0.5, 0]),
    id = house[0].construction!.structureId;
  useSceneStore.setState({
    objects: [...house, other],
    selectedId: house[0].id,
    selectedStructureId: id,
    selectionMode: "structure",
  });
  const base = useSceneStore.getState().objects;
  await precisionIntent("Set the roof roughness to 0.2", settings);
  expect(useEditStore.getState().status).toBe("preview");
  expect(confirmEdit()).toBe(true);
  const changed = useSceneStore.getState().objects;
  expect(changed.find((o) => o.id === other.id)).toEqual(other);
  for (const o of changed.filter((o) => o.construction?.role === "roof"))
    expect(o.surface?.roughness).toBe(0.2);
  undo();
  expect(useSceneStore.getState().objects).toEqual(base);
  redo();
  expect(useSceneStore.getState().objects).toEqual(changed);
});
it("connected walls reject loose transforms while whole structure precision preserves attachments", () => {
  const house = materializePlan(offlinePlan("house")).objects;
  const wall = house.find(
    (o) => o.construction?.role === "wall" && o.construction.facade === "front",
  )!;
  expect(() =>
    precisionUpdate(house, wall, {
      position: [wall.position[0] + 0.2, wall.position[1], wall.position[2]],
    }),
  ).toThrow(/opening/);
  const result = applyStructure(
    house,
    house[0].construction!.structureId,
    { type: "move", delta: [0.2, 0, 0] },
    false,
  );
  expect(result.parts[0].position[0] - house[0].position[0]).toBeCloseTo(0.2);
});
it("Part/Structure ambiguity and multioperation precision never silently broaden targeting", async () => {
  const house = materializePlan(offlinePlan("house")).objects;
  useSceneStore.setState({
    objects: house,
    selectedId: house[0].id,
    selectedStructureId: house[0].construction!.structureId,
  });
  await expect(
    precisionIntent("Set this wall roughness to 0.2", settings),
  ).rejects.toThrow(/Part/);
  await expect(
    precisionIntent("Set opacity to 50% and delete this house", settings),
  ).rejects.toThrow(/one precision/);
  expect(useSceneStore.getState().past).toHaveLength(0);
});
it("structure dimensions are explicit and rotated ambiguous world edits are rejected", () => {
  const house = materializePlan(offlinePlan("house")).objects,
    id = house[0].construction!.structureId;
  expect(structureDimensionOperation(house, id, 0, 8).type).toBe("scale");
  const rotated = applyStructure(
    house,
    id,
    { type: "rotate", angle: Math.PI / 4 },
    false,
  ).parts;
  expect(() => structureDimensionOperation(rotated, id, 0, 8)).toThrow(/yaw/);
});

it("edge alignment touches real standalone faces and rejects rotated/architectural approximations", async () => {
  const { edgePosition } = await import("../../src/scene/precision");
  const a = createCube([0, 0.5, 0]),
    b = createCube([4, 0.5, 0]);
  expect(edgePosition(a, b, "left")).toEqual([3, 0.5, 0]);
  expect(
    precisionUpdate([a, b], a, { position: edgePosition(a, b, "left") })
      .parts[0].position[0],
  ).toBe(3);
  expect(() =>
    edgePosition(a, { ...b, rotation: [0, 0.2, 0] }, "left"),
  ).toThrow(/axis-aligned/);
});

it("small optical changes retain references for unrelated objects on a 200-object scene", () => {
  const objects = Array.from({ length: 200 }, (_, i) =>
    createCube([(i % 20) * 2, 0.5, Math.floor(i / 20) * 2]),
  );
  useSceneStore.setState({
    objects,
    selectedId: objects[0].id,
    past: [],
    future: [],
  });
  expect(
    execute({
      type: "update",
      id: objects[0].id,
      patch: { surface: { roughness: 0.2 } },
    }),
  ).toBe(true);
  expect(useSceneStore.getState().objects[199]).toBe(objects[199]);
  expect(useSceneStore.getState().past[0]).toEqual(objects);
});

it("creation wording with dimensions or optics never edits the selected starter object", async () => {
  const before = useSceneStore.getState().objects;
  for (const text of [
    "Build a house 4 meters wide",
    "Generate a home with roughness 0.3",
    "Make a house 4 meters wide",
  ])
    expect(await precisionIntent(text, settings)).toBeNull();
  expect(useSceneStore.getState().objects).toBe(before);
  expect(useEditStore.getState().prepared).toBeNull();
});
it("structure movement uses the same configurable grid as object placement", () => {
  const house = materializePlan(offlinePlan("house")).objects,
    id = house[0].construction!.structureId;
  usePrecisionSettings.setState({ gridStep: 0.1 });
  const before = house[0].position[0];
  const result = applyStructure(
    house,
    id,
    { type: "move", delta: [0.24, 0, 0] },
    true,
  );
  expect(result.parts[0].position[0] - before).toBeCloseTo(0.2);
});

it("descriptive metallic wording stays on the existing semantic planner path", async () => {
  expect(
    await precisionIntent("Give my house a shiny metallic top", settings),
  ).toBeNull();
  expect(useEditStore.getState().prepared).toBeNull();
});
it("an invalid replacement precision request clears the previous unconfirmed operation", async () => {
  await precisionIntent("Set roughness to 0.2", settings);
  expect(useEditStore.getState().prepared).not.toBeNull();
  await expect(precisionIntent("Set roughness to 2", settings)).rejects.toThrow(
    /between 0 and 1/,
  );
  expect(useEditStore.getState().prepared).toBeNull();
  expect(confirmEdit()).toBe(false);
  expect(useSceneStore.getState().past).toHaveLength(0);
});

it("mouse guides validate transient geometry without polluting scene or saved objects", async () => {
  const { updateMouseGuide, clearMouseGuide, useMouseGuide } =
    await import("../../src/scene/precisionGuide");
  const base = useSceneStore.getState().objects,
    o = base[0];
  clearMouseGuide();
  updateMouseGuide({ ...o, position: [0.2, 0.5, 0] }, base, false, 100);
  expect(useMouseGuide.getState().sample?.valid).toBe(true);
  expect(useSceneStore.getState().objects).toBe(base);
  updateMouseGuide({ ...o, position: [0, -1, 0] }, base, false, 200);
  expect(useMouseGuide.getState().sample?.valid).toBe(false);
  expect(deserialize(serialize(base))).toEqual(base);
  clearMouseGuide(o.id);
  expect(useMouseGuide.getState().sample).toBeNull();
});
it("disabled guides do not retain samples and updates are bounded to 30 Hz", async () => {
  const { updateMouseGuide, clearMouseGuide, useMouseGuide } =
    await import("../../src/scene/precisionGuide");
  const objects = useSceneStore.getState().objects,
    o = objects[0];
  clearMouseGuide();
  updateMouseGuide(o, objects, false, 100);
  const first = useMouseGuide.getState().sample;
  updateMouseGuide({ ...o, position: [1, 0.5, 0] }, objects, false, 110);
  expect(useMouseGuide.getState().sample).toBe(first);
  usePrecisionSettings.setState({ measurements: false, guides: false });
  updateMouseGuide(o, objects, false, 200);
  expect(useMouseGuide.getState().sample).toBeNull();
});
