import { beforeEach, it, expect, vi } from "vitest";
import {
  standaloneFlight,
  nativeSupport,
} from "../../src/scene/nativeAssemblies";
import { useSceneStore } from "../../src/scene/sceneStore";
import { execute, undo, redo } from "../../src/scene/commandManager";
import { validateBatch, materializePlan } from "../../src/generation/engine";
import { applyStructure } from "../../src/scene/structures";
import { selectedWallIntent } from "../../src/generation/selectedWall";
import {
  cancelEdit,
  confirmEdit,
  useEditStore,
} from "../../src/generation/editStore";
import { useGenerationStore } from "../../src/generation/generationStore";
import { offlinePlan } from "../../src/generation/offline";
import { createObject } from "../../src/scene/objectFactory";
import {
  SpeechController,
  type Recognition,
  type SpeechResults,
} from "../../src/commands/speech";
const recipe = {
  steps: 8,
  height: 1.6,
  run: 0.25,
  width: 1,
  material: "wood",
  color: "#aabbcc",
};
beforeEach(() => {
  cancelEdit();
  useGenerationStore.setState({ prepared: null });
  useSceneStore.setState({
    objects: [],
    past: [],
    future: [],
    selectedId: null,
    selectedStructureId: null,
    selectionMode: "component",
    preview: null,
    snap: true,
  });
});
it("standalone native stairs are solid real steps without invented floors and have atomic history", () => {
  const p = standaloneFlight(recipe, [0, 0, 0]);
  expect(p).toHaveLength(8);
  expect(p.every((o) => o.construction?.role === "stair")).toBe(true);
  expect(validateBatch(p, [])).toHaveLength(8);
  expect(execute({ type: "construct", objects: p })).toBe(true);
  const after = useSceneStore.getState().objects;
  undo();
  expect(useSceneStore.getState().objects).toEqual([]);
  redo();
  expect(useSceneStore.getState().objects).toEqual(after);
});
it("standalone support and dimensions remain validated", () => {
  expect(() => standaloneFlight({ ...recipe, height: 5 })).toThrow();
  const p = standaloneFlight(recipe, [0, 1, 0]);
  expect(() => nativeSupport(p, [])).toThrow(/supporting floor/);
  const floor = createObject("floor", [0, 0.9, 0]);
  expect(() => nativeSupport(p, [floor])).not.toThrow();
  expect(() => validateBatch(p, [floor])).not.toThrow();
});
it("standalone configuration, duplicate and Part movement use whole native assembly commands", () => {
  const p = standaloneFlight(recipe, [0, 0, 0]);
  execute({ type: "construct", objects: p });
  const id = p[0].construction!.structureId;
  expect(
    execute({
      type: "structure",
      structureId: id,
      operation: {
        type: "design",
        standaloneStairs: { ...recipe, material: "wood", width: 1.4 },
      },
    }),
  ).toBe(true);
  const base = useSceneStore.getState().objects;
  expect(base[0].scale[0]).toBe(1.4);
  expect(
    execute({
      type: "update",
      id: base[0].id,
      patch: { position: [2, base[0].position[1], base[0].position[2]] },
      precise: true,
    }),
  ).toBe(true);
  expect(
    useSceneStore
      .getState()
      .objects.every((o, i) => o.position[0] === base[i].position[0] + 2),
  ).toBe(true);
  undo();
  expect(useSceneStore.getState().objects).toEqual(base);
  expect(execute({ type: "duplicate", id: base[0].id })).toBe(true);
  expect(useSceneStore.getState().objects).toHaveLength(16);
});
it("ordinary manual wall gains a genuine window hole with inert cancelable preview and exact undo", () => {
  const wall = createObject("wall"),
    other = createObject("cube", [5, 0.5, 0]);
  useSceneStore.setState({ objects: [wall, other], selectedId: wall.id });
  expect(selectedWallIntent("Add a window to the selected wall.")).toMatch(
    /Review/,
  );
  expect(useSceneStore.getState().objects).toEqual([wall, other]);
  cancelEdit();
  expect(useSceneStore.getState().objects).toEqual([wall, other]);
  selectedWallIntent("Add a window to the selected wall.");
  expect(confirmEdit()).toBe(true);
  const after = useSceneStore.getState().objects;
  expect(after.some((o) => o.construction?.role === "window")).toBe(true);
  expect(after.find((o) => o.id === other.id)).toEqual(other);
  expect(after.filter((o) => o.construction?.role === "wall")).toHaveLength(4);
  expect(useSceneStore.getState().selectedId).not.toBeNull();
  undo();
  expect(useSceneStore.getState().objects).toEqual([wall, other]);
  redo();
  expect(useSceneStore.getState().objects).toEqual(after);
});
it("selected facade creation preserves old openings, other facades and connected stairs", () => {
  const house = materializePlan(
      offlinePlan("house", { floors: 2, doors: 0, windows: 0 }),
    ).objects,
    wall = house.find(
      (o) => o.construction?.role === "wall" && o.construction.level === 1,
    )!;
  useSceneStore.setState({ objects: house, selectedId: wall.id });
  selectedWallIntent("Add a window to the selected wall.");
  expect(confirmEdit()).toBe(true);
  const once = useSceneStore.getState().objects,
    selected = once.find(
      (o) =>
        o.construction?.role === "wall" &&
        o.construction.level === 1 &&
        o.construction.facade === "front",
    )!;
  useSceneStore.setState({
    selectedId: selected.id,
    selectedStructureId: null,
  });
  selectedWallIntent("Add a window to the selected wall.");
  const p = useEditStore.getState().prepared!;
  expect(
    p.result.parts.filter((o) => o.construction?.role === "window"),
  ).toHaveLength(2);
  expect(confirmEdit()).toBe(true);
  undo();
  expect(useSceneStore.getState().objects).toEqual(once);
});
it("window creation has specific missing/invalid/Structure selection guidance", () => {
  expect(() => selectedWallIntent("Add a window to the selected wall")).toThrow(
    /Select the native wall/,
  );
  const cube = createObject("cube");
  useSceneStore.setState({ objects: [cube], selectedId: cube.id });
  expect(() => selectedWallIntent("Add a window to the selected wall")).toThrow(
    /native editable wall/,
  );
  const wall = createObject("wall");
  useSceneStore.setState({
    objects: [wall],
    selectedId: wall.id,
    selectedStructureId: crypto.randomUUID(),
  });
  expect(() => selectedWallIntent("Add a window to the selected wall")).toThrow(
    /Choose Part/,
  );
});
it("existing standalone window resizing retains the wall and validates bounds", () => {
  const wall = createObject("wall");
  useSceneStore.setState({ objects: [wall], selectedId: wall.id });
  selectedWallIntent("Add a window to the selected wall");
  confirmEdit();
  const base = useSceneStore.getState().objects,
    window = base.find((o) => o.construction?.role === "window")!;
  useSceneStore.setState({ selectedId: window.id, selectedStructureId: null });
  selectedWallIntent("Make this window wider");
  expect(confirmEdit()).toBe(true);
  const after = useSceneStore
    .getState()
    .objects.find((o) => o.id === window.id)!;
  expect(after.scale[0]).toBeGreaterThan(window.scale[0]);
  undo();
  expect(useSceneStore.getState().objects).toEqual(base);
});
it("connected stairs still require adjacent real floors", () => {
  const house = materializePlan(
      offlinePlan("house", { floors: 2, doors: 0, windows: 0 }),
    ).objects,
    id = house[0].construction!.structureId;
  expect(() =>
    applyStructure(house, id, {
      type: "design",
      stairs: [
        {
          id: "flight",
          from: 0,
          to: 1,
          steps: 16,
          rise: 0.2,
          run: 0.2,
          width: 1,
          x: -1.5,
          z: 0,
          yaw: 0,
          material: "wood",
          color: "#aabbcc",
        },
      ],
    }),
  ).not.toThrow();
});
class Speech implements Recognition {
  static last: Speech;
  continuous = false;
  interimResults = true;
  lang = "";
  maxAlternatives = 1;
  onstart: Recognition["onstart"] = null;
  onend: Recognition["onend"] = null;
  onerror: Recognition["onerror"] = null;
  onresult: Recognition["onresult"] = null;
  onnomatch: Recognition["onnomatch"] = null;
  constructor() {
    Speech.last = this;
  }
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}
const speechEvent = (text: string, final = true): SpeechResults => ({
  resultIndex: 0,
  results: [{ isFinal: final, 0: { transcript: text } }],
});
it("Stop finalizes pending speech; Cancel ignores late results and preserves finalized text", () => {
  const states: unknown[] = [],
    final = vi.fn(),
    c = new SpeechController(Speech, (s) => states.push(s), final);
  c.start();
  const r = Speech.last;
  r.onstart?.();
  r.onresult?.(speechEvent("add a window", false));
  c.stop();
  expect(r.stop).toHaveBeenCalledOnce();
  expect(r.abort).not.toHaveBeenCalled();
  r.onresult?.(speechEvent("Add a window to the selected wall"));
  expect(final).toHaveBeenCalledOnce();
  c.start();
  const late = Speech.last.onresult;
  c.cancel();
  late?.(speechEvent("Delete everything"));
  expect(final).toHaveBeenCalledOnce();
  expect(states.at(-1)).toMatchObject({
    transcript: "Add a window to the selected wall",
  });
});
it("intermittent speech failure permits a deliberate restart and catches an already-ended abort", () => {
  const change = vi.fn(),
    final = vi.fn(),
    c = new SpeechController(Speech, change, final);
  c.start();
  Speech.last.abort.mockImplementation(() => {
    throw Error("ended");
  });
  expect(() => Speech.last.onerror?.({ error: "network" })).not.toThrow();
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({
      status: "error",
      message: expect.stringContaining("network"),
    }),
  );
  c.start();
  Speech.last.onresult?.(speechEvent("Move this object right"));
  expect(final).toHaveBeenCalledOnce();
});
