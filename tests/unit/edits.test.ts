import { TwoHandController } from "../../src/interaction/twoHandController";
import { useAdvancedStore } from "../../src/interaction/advancedStore";
import { useInteractionStore } from "../../src/interaction/interactionStore";
import { recognized } from "../fixtures/advanced";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  deterministicEdit,
  isStructureEdit,
} from "../../src/generation/editPlanner";
import {
  requestEdit,
  confirmEdit,
  cancelEdit,
  editContext,
  resolveStructure,
  useEditStore,
} from "../../src/generation/editStore";
import { offlinePlan } from "../../src/generation/offline";
import { materializePlan } from "../../src/generation/engine";
import { useSceneStore } from "../../src/scene/sceneStore";
import { execute, undo, redo } from "../../src/scene/commandManager";
import { createCube } from "../../src/scene/objectFactory";
import {
  groupPreview,
  moveGroupPreview,
  commitPlacement,
} from "../../src/interaction/structureInteraction";
const scene = () => useSceneStore.getState(),
  edit = () => useEditStore.getState();
const settings = { mode: "offline" as const };
beforeEach(() => {
  cancelEdit();
  const parts = materializePlan(offlinePlan("house")).objects;
  useSceneStore.setState({
    objects: parts,
    selectedId: null,
    selectedStructureId: null,
    selectionMode: "component",
    preview: null,
    past: [],
    future: [],
    snap: false,
  });
});
afterEach(() => {
  cancelEdit();
  vi.unstubAllGlobals();
});
it.each([
  "Select the whole house",
  "Move the entire house to the right",
  "Make the entire building 50% larger",
  "Rotate the whole structure 90 degrees",
  "Change all walls to brick",
  "Make the roof metal",
  "Add another floor",
  "Remove the top floor",
  "Make the house wider",
  "Duplicate this building",
])("supports validated offline edit: %s", (text) => {
  expect(isStructureEdit(text)).toBe(true);
  expect(deterministicEdit(text)).toHaveProperty("operation.type");
});
it("quick commands keep their route unless whole-structure selection is explicit", () => {
  expect(isStructureEdit("Move it right by 2 meters")).toBe(false);
  expect(isStructureEdit("Move it right by 2 meters", true)).toBe(true);
  expect(isStructureEdit("Create a cube", true)).toBe(false);
});
it("preview and cancellation are inert; confirmation is one history entry with exact redo", async () => {
  const base = scene().objects;
  await requestEdit("Change all walls to brick", settings);
  expect(edit().status).toBe("preview");
  expect(scene().objects).toBe(base);
  expect(scene().past).toHaveLength(0);
  cancelEdit();
  expect(scene().objects).toBe(base);
  await requestEdit("Change all walls to brick", settings);
  expect(confirmEdit()).toBe(true);
  expect(scene().past).toHaveLength(1);
  const after = scene().objects;
  undo();
  expect(scene().objects).toEqual(base);
  redo();
  expect(scene().objects).toEqual(after);
});
it("duplicates confirm the exact preview IDs and keep unrelated objects unchanged", async () => {
  const cube = createCube([20, 0.5, 20]);
  useSceneStore.setState({ objects: [...scene().objects, cube] });
  await requestEdit("Duplicate this building", settings);
  const ids = edit().prepared!.result.parts.map((o) => o.id);
  expect(confirmEdit()).toBe(true);
  expect(
    scene().objects.some(
      (o) => o === cube || JSON.stringify(o) === JSON.stringify(cube),
    ),
  ).toBe(true);
  expect(scene().objects.filter((o) => ids.includes(o.id))).toHaveLength(
    ids.length,
  );
});
it("ambiguous targets and stale previews cannot alter the scene", async () => {
  const id = scene().objects[0].construction!.structureId;
  execute({
    type: "structure",
    structureId: id,
    operation: { type: "duplicate" },
  });
  scene().select(null);
  const base = scene().objects;
  await requestEdit("Move the entire house right", settings);
  expect(edit().status).toBe("error");
  expect(edit().message).toMatch(/Which|ambiguous/);
  expect(scene().objects).toBe(base);
  scene().setSelectionMode("structure");
  scene().select(base[0].id);
  await requestEdit("Make the entire building 50% larger", settings);
  expect(edit().status).toBe("preview");
  scene().select(null);
  expect(confirmEdit()).toBe(false);
  expect(scene().objects).toBe(base);
});
it("explicit named targets override selection; unknown targets never fall through", () => {
  const ctx = editContext(),
    first = ctx.structures[0];
  const second = {
    ...first,
    id: crypto.randomUUID(),
    name: "Tower",
    type: "tower",
  };
  ctx.structures.push(second);
  ctx.selected = first.id;
  expect(resolveStructure(undefined, ctx, "Move the tower right")).toBe(
    second.id,
  );
  expect(() => resolveStructure("missing", ctx)).toThrow();
});
it("unsupported opening edits are honest and leave geometry/history unchanged", async () => {
  const base = scene().objects;
  await requestEdit("Add windows to the front wall of the house", settings);
  expect(edit().status).toBe("error");
  expect(edit().message).toMatch(/not supported/);
  expect(scene().objects).toBe(base);
  expect(scene().past).toHaveLength(0);
});
it("mocked LLM intents validate locally, preserve unrelated objects, and cancel late responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        source: "llm",
        model: "mock",
        plan: { version: 1, operation: { type: "move", delta: [2, 0, 0] } },
      }),
    ),
  );
  await requestEdit("Move the whole house right", { mode: "llm" });
  expect(edit().status).toBe("preview");
  expect(edit().source).toMatch(/LLM/);
  cancelEdit();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        source: "llm",
        plan: { version: 1, operation: { type: "delete" }, code: "run" },
      }),
    ),
  );
  await requestEdit("Delete the whole house", { mode: "llm" });
  expect(edit().status).toBe("error");
  expect(scene().past).toHaveLength(0);
  let finish: (r: Response) => void = () => {};
  vi.stubGlobal(
    "fetch",
    () =>
      new Promise<Response>((r) => {
        finish = r;
      }),
  );
  const pending = requestEdit("Move the whole house right", { mode: "llm" });
  cancelEdit();
  finish(
    Response.json({
      source: "llm",
      plan: { version: 1, operation: { type: "delete" } },
    }),
  );
  await pending;
  expect(edit().prepared).toBeNull();
  expect(edit().status).toBe("idle");
});
it("group gesture previews use shared transactions; unchanged grabs have no history", () => {
  const o = scene().objects[0];
  scene().setSelectionMode("structure");
  scene().select(o.id);
  const p = moveGroupPreview(o.id, [
    o.position[0] + 2,
    o.position[1],
    o.position[2],
  ])!;
  expect(p.structure?.objects.length).toBe(scene().objects.length);
  expect(scene().past).toHaveLength(0);
  expect(commitPlacement(p)).toBe(true);
  expect(scene().past).toHaveLength(1);
  const base = scene().objects;
  const stationary = groupPreview(base[0].id, { type: "rotate", angle: 0 })!;
  expect(commitPlacement(stationary)).toBe(true);
  expect(scene().past).toHaveLength(1);
});
it("legacy explicit grouping remains editable without inventing template/floor relationships", () => {
  const parts = scene().objects.map((o) => ({
    ...o,
    construction: {
      structureId: o.construction!.structureId,
      partId: o.construction!.partId,
      role: o.construction!.role,
    },
  }));
  useSceneStore.setState({ objects: parts });
  const id = parts[0].construction.structureId;
  expect(
    execute({
      type: "structure",
      structureId: id,
      operation: { type: "move", delta: [2, 0, 0] },
    }),
  ).toBe(true);
  expect(
    execute({
      type: "structure",
      structureId: id,
      operation: { type: "floors", action: "add" },
    }),
  ).toBe(false);
});

it("multi-operation and negative offline requests are rejected instead of partially interpreted", () => {
  expect(() =>
    deterministicEdit("Move the entire house right and delete the roof"),
  ).toThrow(/one structure operation/);
  expect(() =>
    deterministicEdit("Move the entire house right by -2 meters"),
  ).toThrow(/positive/);
});

it("two-hand group yaw release commits once and preserves every component relative transform", () => {
  const o = scene().objects[0];
  scene().setSelectionMode("structure");
  scene().select(o.id);
  const original = scene().objects;
  useAdvancedStore.setState({ mode: "rotate", active: false });
  useInteractionStore.setState({ menuOpen: false, phase: "idle" });
  const controller = new TwoHandController();
  const feed = (t: number, closed: boolean, angle: number) => {
    const d = 0.3;
    controller.update({
      hands: [
        recognized(
          1,
          0.5 - (d * Math.cos(angle)) / 2,
          closed,
          0.4 - (d * Math.sin(angle)) / 2,
        ),
        recognized(
          2,
          0.5 + (d * Math.cos(angle)) / 2,
          closed,
          0.4 + (d * Math.sin(angle)) / 2,
        ),
      ],
      timestamp: t,
      aspectRatio: 1,
      ambiguous: false,
    });
  };
  feed(0, false, 0);
  feed(100, true, 0);
  for (let t = 140; t <= 900; t += 40) feed(t, true, 0.5);
  expect(scene().preview?.structure?.operation.type).toBe("rotate");
  expect(scene().preview?.valid).toBe(true);
  expect(scene().objects).toBe(original);
  feed(940, false, 0.5);
  expect(scene().past).toHaveLength(1);
  expect(scene().objects[0].construction!.structure!.yaw).toBeCloseTo(0.5, 2);
  undo();
  expect(scene().objects).toEqual(original);
});

it("the client prevents an LLM from guessing ambiguous targets or overriding a selected target", async () => {
  const first = scene().objects[0].construction!.structureId;
  execute({
    type: "structure",
    structureId: first,
    operation: { type: "duplicate" },
  });
  const second = scene().selectedStructureId!;
  scene().select(null);
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        source: "llm",
        plan: { version: 1, target: second, operation: { type: "delete" } },
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  await requestEdit("Move the whole house right", { mode: "llm" });
  expect(edit().status).toBe("error");
  expect(fetcher).not.toHaveBeenCalled();
  scene().setSelectionMode("structure");
  scene().select(scene().objects[0].id);
  const base = scene().objects;
  await requestEdit("Delete the whole building", { mode: "llm" });
  expect(edit().status).toBe("error");
  expect(edit().message).toMatch(/target differs/);
  expect(scene().objects).toBe(base);
});
it("target matching treats names as words rather than unsafe substrings", () => {
  const a = { id: crypto.randomUUID(), name: "House", type: "house", count: 8 },
    b = {
      id: crypto.randomUUID(),
      name: "Warehouse",
      type: "warehouse",
      count: 8,
    };
  expect(
    resolveStructure(
      undefined,
      { selected: null, structures: [a, b] },
      "Move the warehouse right",
    ),
  ).toBe(b.id);
});
