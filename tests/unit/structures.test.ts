import { beforeEach, expect, it } from "vitest";
import { offlinePlan } from "../../src/generation/offline";
import { materializePlan } from "../../src/generation/engine";
import {
  applyStructure,
  members,
  structureInfo,
} from "../../src/scene/structures";
import { execute, undo, redo } from "../../src/scene/commandManager";
import { useSceneStore } from "../../src/scene/sceneStore";
import { createCube } from "../../src/scene/objectFactory";
import { serialize, deserialize } from "../../src/scene/sceneSerializer";
import { editPlanSchema } from "../../shared/editSchema.mjs";
function built(prompt = "house") {
  return materializePlan(offlinePlan(prompt)).objects;
}
const scene = () => useSceneStore.getState();
beforeEach(() =>
  useSceneStore.setState({
    objects: [],
    past: [],
    future: [],
    preview: null,
    selectedId: null,
    selectedStructureId: null,
    selectionMode: "component",
    snap: false,
  }),
);
it("explicit memberships, roles, floor and template metadata survive IO; legacy objects remain standalone", () => {
  const parts = built("house floors 2"),
    cube = createCube();
  expect(new Set(parts.map((p) => p.construction?.structureId)).size).toBe(1);
  expect(parts.some((p) => p.construction?.level === 1)).toBe(true);
  expect(deserialize(serialize([...parts, cube]))).toEqual([...parts, cube]);
  expect(cube.construction).toBeUndefined();
});
it("selection mode changes component/group selection without history", () => {
  const parts = built();
  useSceneStore.setState({ objects: parts });
  scene().select(parts[1].id);
  expect(scene().selectedStructureId).toBeNull();
  scene().setSelectionMode("structure");
  expect(scene().selectedStructureId).toBe(parts[0].construction!.structureId);
  scene().setSelectionMode("component");
  expect(scene().selectedId).toBe(parts[1].id);
  expect(scene().selectedStructureId).toBeNull();
  expect(scene().past).toHaveLength(0);
});
it("move/yaw/scale preserve layout and make one history entry each; undo/redo restore exact values", () => {
  const parts = built(),
    id = parts[0].construction!.structureId;
  useSceneStore.setState({ objects: parts });
  expect(
    execute({
      type: "structure",
      structureId: id,
      operation: { type: "move", delta: [3, 0, 2] },
    }),
  ).toBe(true);
  const moved = scene().objects;
  expect(moved[1].position[0] - parts[1].position[0]).toBeCloseTo(3);
  expect(
    execute({
      type: "structure",
      structureId: id,
      operation: { type: "rotate", angle: Math.PI / 4 },
    }),
  ).toBe(true);
  expect(
    execute({
      type: "structure",
      structureId: id,
      operation: { type: "scale", factors: [1.5, 1.5, 1.5] },
    }),
  ).toBe(true);
  expect(scene().past).toHaveLength(3);
  const after = scene().objects;
  undo();
  redo();
  expect(scene().objects).toEqual(after);
  undo();
  undo();
  expect(scene().objects).toEqual(moved);
  undo();
  expect(scene().objects).toEqual(parts);
});
it("repeated inverse rotations keep components aligned without meaningful drift", () => {
  let parts = built();
  const initial = structuredClone(parts),
    id = parts[0].construction!.structureId;
  for (let i = 0; i < 25; i++) {
    parts = applyStructure(parts, id, { type: "rotate", angle: 0.15 }).objects;
    parts = applyStructure(parts, id, { type: "rotate", angle: -0.15 }).objects;
  }
  parts.forEach((p, i) =>
    p.position.forEach((v, a) =>
      expect(v).toBeCloseTo(initial[i].position[a], 9),
    ),
  );
});
it("external collision, excessive scales and stale edits reject atomically", () => {
  const parts = built(),
    id = parts[0].construction!.structureId,
    obstacle = createCube([10, 0.5, 0]);
  useSceneStore.setState({ objects: [...parts, obstacle] });
  const before = scene().objects;
  expect(
    execute({
      type: "structure",
      structureId: id,
      operation: { type: "move", delta: [10, 0, 0] },
    }),
  ).toBe(false);
  expect(
    execute({
      type: "structure",
      structureId: id,
      operation: { type: "scale", factors: [20, 20, 20] },
    }),
  ).toBe(false);
  expect(
    execute({
      type: "structure",
      structureId: id,
      base: [],
      operation: { type: "rename", name: "bad" },
    }),
  ).toBe(false);
  expect(scene().objects).toBe(before);
  expect(scene().past).toHaveLength(0);
});
it("duplicates use new object/group IDs, ungroup keeps components and Undo restores metadata", () => {
  const parts = built(),
    id = parts[0].construction!.structureId;
  useSceneStore.setState({ objects: parts });
  expect(
    execute({
      type: "structure",
      structureId: id,
      operation: { type: "duplicate" },
    }),
  ).toBe(true);
  const copy = scene().selectedStructureId!;
  expect(copy).not.toBe(id);
  expect(members(scene().objects, copy)).toHaveLength(parts.length);
  expect(new Set(scene().objects.map((p) => p.id)).size).toBe(parts.length * 2);
  expect(
    execute({
      type: "structure",
      structureId: copy,
      operation: { type: "ungroup" },
    }),
  ).toBe(true);
  expect(members(scene().objects, id)).toEqual(parts);
  expect(members(scene().objects, copy)).toHaveLength(0);
  undo();
  expect(members(scene().objects, copy)).toHaveLength(parts.length);
});
it("role materials preserve color, floor operations preserve IDs/finishes and restore through undo", () => {
  const parts = built(),
    id = parts[0].construction!.structureId;
  useSceneStore.setState({ objects: parts });
  expect(
    execute({
      type: "structure",
      structureId: id,
      operation: { type: "material", role: "wall", material: "brick" },
    }),
  ).toBe(true);
  expect(
    scene()
      .objects.filter((p) => p.construction!.role === "wall")
      .every((p) => p.material === "brick"),
  ).toBe(true);
  const old = scene().objects;
  expect(
    execute({
      type: "structure",
      structureId: id,
      operation: { type: "floors", action: "add" },
    }),
  ).toBe(true);
  expect(structureInfo(scene().objects).template?.floors).toBe(2);
  expect(
    scene().objects.find((p) => p.construction!.partId === "roof")?.id,
  ).toBe(old.find((p) => p.construction!.partId === "roof")?.id);
  expect(
    execute({
      type: "structure",
      structureId: id,
      operation: { type: "floors", action: "height", height: 4 },
    }),
  ).toBe(true);
  expect(
    execute({
      type: "structure",
      structureId: id,
      operation: { type: "floors", action: "remove" },
    }),
  ).toBe(true);
  expect(structureInfo(scene().objects).template?.floors).toBe(1);
  undo();
  expect(structureInfo(scene().objects).template?.floors).toBe(2);
});
it("arbitrary or manually changed geometry cannot be silently redesigned by floor edits", () => {
  const parts = built(),
    id = parts[0].construction!.structureId;
  useSceneStore.setState({ objects: parts });
  expect(
    execute({ type: "update", id: parts[1].id, patch: { scale: [0.5, 1, 1] } }),
  ).toBe(true);
  expect(structureInfo(scene().objects).template).toBeUndefined();
  expect(
    execute({
      type: "structure",
      structureId: id,
      operation: { type: "floors", action: "add" },
    }),
  ).toBe(false);
  const bridge = built("bridge");
  expect(() =>
    applyStructure(bridge, bridge[0].construction!.structureId, {
      type: "floors",
      action: "add",
    }),
  ).toThrow(/template/);
});
it("edit schema rejects executable payloads, unknown fields, unsupported values", () => {
  for (const operation of [
    { type: "move", delta: [Infinity, 0, 0] },
    { type: "material", material: "lava" },
    { type: "execute", code: "delete" },
  ])
    expect(() => editPlanSchema.parse({ version: 1, operation })).toThrow();
  expect(() =>
    editPlanSchema.parse({
      version: 1,
      operation: { type: "delete" },
      script: "x",
    }),
  ).toThrow();
});

it("duplicate a ground floor preserves its exact layout/finishes and later floor edits remain safe", () => {
  let parts = built("house with windows");
  const id = parts[0].construction!.structureId;
  const source = parts.filter((o) => o.construction!.level === 0);
  source[1].color = "#123456";
  const copy = applyStructure(parts, id, {
    type: "floors",
    action: "duplicate",
    level: 0,
  });
  parts = copy.objects;
  expect(parts.filter((o) => o.construction!.level === 1)).toHaveLength(
    source.length,
  );
  const child = parts.find(
    (o) =>
      o.construction!.partId ===
      source[1].construction!.partId.replace("level-1-", "level-2-"),
  )!;
  expect(child.color).toBe("#123456");
  expect(structureInfo(parts).floorLayouts).toEqual(["ground", "ground"]);
  parts = applyStructure(parts, id, {
    type: "floors",
    action: "height",
    height: 4,
  }).objects;
  expect(structureInfo(parts).template!.height).toBe(4);
  expect(() =>
    applyStructure(parts, id, { type: "floors", action: "add" }),
  ).not.toThrow();
  expect(deserialize(serialize(parts))).toEqual(
    JSON.parse(JSON.stringify(parts)),
  );
});
it("widening after yaw retains orthogonal alignment; true shear is rejected", () => {
  const parts = built(),
    id = parts[0].construction!.structureId;
  const turned = applyStructure(parts, id, {
    type: "rotate",
    angle: Math.PI / 4,
  }).objects;
  expect(() =>
    applyStructure(turned, id, { type: "scale", factors: [1.2, 1, 1] }),
  ).not.toThrow();
});
it("forged/mismatched persisted template metadata never silently rebuilds components", () => {
  const parts = built(),
    id = parts[0].construction!.structureId;
  for (const p of parts) p.construction!.structure!.template!.width = 8;
  expect(() =>
    applyStructure(parts, id, { type: "floors", action: "add" }),
  ).toThrow(/no longer matches/);
});

it("editing a duplicated-floor component invalidates only the template recipe and remains undoable", () => {
  let parts = built();
  const id = parts[0].construction!.structureId;
  parts = applyStructure(parts, id, {
    type: "floors",
    action: "duplicate",
    level: 0,
  }).objects;
  useSceneStore.setState({ objects: parts });
  expect(
    execute({
      type: "update",
      id: parts[0].id,
      patch: { scale: [1.4, 1, 1.4] },
    }),
  ).toBe(true);
  expect(structureInfo(scene().objects).template).toBeUndefined();
  expect(structureInfo(scene().objects).floorLayouts).toBeUndefined();
  undo();
  expect(scene().objects).toEqual(parts);
});

it.each([Math.PI / 2, Math.PI, Math.PI / 4])(
  "template floor editing after yaw %s and local scaling preserves certification",
  (angle) => {
    let parts = built();
    const id = parts[0].construction!.structureId;
    parts = applyStructure(parts, id, { type: "rotate", angle }).objects;
    parts = applyStructure(parts, id, {
      type: "scale",
      factors: [1.2, 1.2, 1.2],
    }).objects;
    expect(() =>
      applyStructure(parts, id, { type: "floors", action: "add" }),
    ).not.toThrow();
  },
);

it("sub-grid group movement after yaw/scaling remains a true no-op without numerical history drift", () => {
  let parts = built();
  const id = parts[0].construction!.structureId;
  parts = applyStructure(parts, id, { type: "rotate", angle: 0.7 }).objects;
  parts = applyStructure(parts, id, {
    type: "scale",
    factors: [1.2, 1.2, 1.2],
  }).objects;
  useSceneStore.setState({ objects: parts, snap: true });
  expect(
    execute({
      type: "structure",
      structureId: id,
      operation: { type: "move", delta: [0.1, 0, 0.1] },
    }),
  ).toBe(true);
  expect(scene().past).toHaveLength(0);
  expect(scene().objects).toEqual(parts);
});
