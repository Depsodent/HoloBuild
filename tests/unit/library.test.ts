import { beforeEach, expect, it } from "vitest";
import { offlinePlan } from "../../src/generation/offline";
import { materializePlan } from "../../src/generation/engine";
import {
  insertStaircase,
  insertBalcony,
} from "../../src/generation/libraryOperations";
import { applyStructure, structureInfo } from "../../src/scene/structures";
import { useSceneStore } from "../../src/scene/sceneStore";
import { execute, undo, redo } from "../../src/scene/commandManager";
import { serialize, deserialize } from "../../src/scene/sceneSerializer";
import { bounds } from "../../src/interaction/placement";
const build = () =>
  materializePlan(
    offlinePlan("house", {
      width: 6,
      depth: 6,
      height: 3,
      floors: 2,
      doors: 0,
      windows: 0,
    }),
  ).objects;
const stair = {
  from: 0,
  to: 1,
  steps: 16,
  run: 0.2,
  width: 1,
  x: -1.5,
  z: 0,
  yaw: 0 as const,
  material: "wood" as const,
  color: "#886633",
};
const balcony = {
  level: 1,
  facade: "front" as const,
  offset: 0,
  width: 2.4,
  depth: 1.5,
  railHeight: 1.1,
  material: "concrete" as const,
  color: "#aab5c2",
};
beforeEach(() =>
  useSceneStore.setState({
    objects: [],
    past: [],
    future: [],
    selectedId: null,
    selectedStructureId: null,
    selectionMode: "component",
    preview: null,
    snap: false,
  }),
);
it("manual stairs use native steps and a real destination-floor hole with exact history", () => {
  const objects = build(),
    id = objects[0].construction!.structureId,
    recipe = structureInfo(objects).template!;
  useSceneStore.setState({ objects });
  const op = insertStaircase(recipe, stair);
  expect(execute({ type: "structure", structureId: id, operation: op })).toBe(
    true,
  );
  const placed = useSceneStore.getState().objects,
    steps = placed.filter((o) => o.construction?.role === "stair");
  expect(steps).toHaveLength(16);
  expect(
    placed.filter(
      (o) => o.construction?.role === "floor" && o.construction.level === 1,
    ),
  ).toHaveLength(4);
  expect(
    placed
      .filter(
        (o) => o.construction?.role === "floor" && o.construction.level === 1,
      )
      .every(
        (o) =>
          bounds(o).max.x <= -2 + 1e-6 ||
          bounds(o).min.x >= -1 - 1e-6 ||
          bounds(o).max.z <= -1.6 + 1e-6 ||
          bounds(o).min.z >= 1.6 - 1e-6,
      ),
  ).toBe(true);
  expect(deserialize(serialize(placed))).toEqual(
    JSON.parse(JSON.stringify(placed)),
  );
  undo();
  expect(useSceneStore.getState().objects).toEqual(objects);
  redo();
  expect(useSceneStore.getState().objects).toEqual(placed);
});
it("manual balcony creates native rails and an aligned real access opening", () => {
  const objects = build(),
    id = objects[0].construction!.structureId,
    recipe = structureInfo(objects).template!;
  const result = applyStructure(
    objects,
    id,
    insertBalcony(recipe, balcony),
    false,
  );
  expect(
    result.parts.filter((o) => o.construction?.role === "balcony"),
  ).toHaveLength(8);
  const updated = structureInfo(result.parts).template!,
    b = updated.balconies![0],
    door = updated.openings!.find((o) => o.id === b.access)!;
  expect(door).toMatchObject({
    kind: "door",
    level: b.level,
    facade: b.facade,
    offset: b.offset,
  });
  expect(result.parts.some((o) => o.construction?.opening === door.id)).toBe(
    true,
  );
});
it("unsafe insertion configurations reject rather than substitute valid defaults", () => {
  const objects = build(),
    id = objects[0].construction!.structureId,
    recipe = structureInfo(objects).template!;
  expect(() => insertBalcony(recipe, { ...balcony, width: NaN })).toThrow();
  expect(() => insertStaircase(recipe, { ...stair, steps: 0 })).toThrow();
  expect(() => insertStaircase({ ...recipe, floors: 1 }, stair)).toThrow(
    /multi-floor/,
  );
  expect(() =>
    applyStructure(
      objects,
      id,
      insertStaircase(recipe, { ...stair, x: 20 }),
      false,
    ),
  ).toThrow();
  expect(() =>
    applyStructure(
      objects,
      id,
      insertBalcony(recipe, { ...balcony, offset: 20 }),
      false,
    ),
  ).toThrow();
});
it("duplicate and delete stairs operate on the complete assembly and restore floor connections", () => {
  let objects = materializePlan(
    offlinePlan("house", {
      width: 6,
      depth: 6,
      height: 3,
      floors: 3,
      doors: 0,
      windows: 0,
    }),
  ).objects;
  const id = objects[0].construction!.structureId;
  objects = applyStructure(
    objects,
    id,
    insertStaircase(structureInfo(objects).template!, stair),
    false,
  ).parts;
  const step = objects.find((o) => o.construction?.role === "stair")!;
  useSceneStore.setState({ objects, selectedId: step.id });
  expect(execute({ type: "duplicate", id: step.id })).toBe(true);
  const duplicated = useSceneStore.getState().objects;
  expect(
    duplicated.filter((o) => o.construction?.role === "stair"),
  ).toHaveLength(32);
  undo();
  expect(useSceneStore.getState().objects).toEqual(objects);
  redo();
  expect(useSceneStore.getState().objects).toEqual(duplicated);
  useSceneStore.setState({ selectedStructureId: null, selectedId: step.id });
  expect(execute({ type: "delete", id: step.id })).toBe(true);
  expect(
    useSceneStore
      .getState()
      .objects.filter((o) => o.construction?.role === "stair"),
  ).toHaveLength(16);
});
it("balcony duplication uses the opposite facade and own access without touching retained stairs", () => {
  const original = build(),
    id = original[0].construction!.structureId;
  const stairs = applyStructure(
      original,
      id,
      insertStaircase(structureInfo(original).template!, stair),
      false,
    ).parts,
    objects = applyStructure(
      stairs,
      id,
      insertBalcony(structureInfo(stairs).template!, balcony),
      false,
    ).parts;
  const b = objects.find((o) => o.construction?.role === "balcony")!;
  useSceneStore.setState({ objects, selectedId: b.id });
  expect(execute({ type: "duplicate", id: b.id })).toBe(true);
  const changed = useSceneStore.getState().objects;
  expect(
    changed.filter((o) => o.construction?.role === "balcony"),
  ).toHaveLength(16);
  expect(structureInfo(changed).template!.stairs).toEqual(
    structureInfo(objects).template!.stairs,
  );
  expect(deserialize(serialize(changed))).toEqual(
    JSON.parse(JSON.stringify(changed)),
  );
  undo();
  expect(useSceneStore.getState().objects).toEqual(objects);
});
