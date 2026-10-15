import { beforeEach, expect, it, vi } from "vitest";
import { parseCommand, normalize, numeric } from "../../src/commands/parser";
import { CommandInterpreter } from "../../src/commands/interpreter";
import { useSceneStore } from "../../src/scene/sceneStore";
import { createCube } from "../../src/scene/objectFactory";
import {
  SpeechController,
  type Recognition,
  type SpeechState,
  type SpeechResults,
} from "../../src/commands/speech";
beforeEach(() => {
  const o = createCube();
  useSceneStore.setState({
    objects: [o],
    selectedId: o.id,
    past: [],
    future: [],
    preview: null,
    snap: false,
  });
});
it("normalizes case, spacing and sentence punctuation without evaluating input", () => {
  expect(normalize("  CREATE   A Cube! ")).toBe("create a cube");
  expect(parseCommand("CREATE a Cube.")).toEqual({
    type: "create",
    shape: "cube",
  });
});
it.each(["cube", "sphere", "cylinder", "cone", "wall", "floor"])(
  "recognizes creation: %s",
  (shape) => {
    expect(parseCommand(`Add a ${shape}`)).toEqual({ type: "create", shape });
  },
);
it.each([
  ["twenty-five", 25],
  ["one hundred and eighty", 180],
  ["one point five", 1.5],
  ["minus forty five", -45],
  ["-90", -90],
  ["two hundred", 200],
])("number grammar %s", (text, value) =>
  expect(numeric(text as string)).toBe(value),
);
it.each([
  "create a pyramid",
  "create a cube and delete it",
  "move right NaN",
  "move left -2",
  "move up 500 meters",
  "scale it 0",
  "scale it Infinity",
  "rotate it 4 times",
  "scale it 4 degrees",
  "make it ultraviolet",
  "apply lava material",
  "alert(1)",
  "create a cube; delete it",
  "move right 2+2",
  "move right one one",
  "rotate 9999 degrees",
])("rejects invalid/ambiguous request: %s", (text) =>
  expect(() => parseCommand(text)).toThrow(),
);
it("parses synonyms, units, reference words and existing material labels", () => {
  expect(parseCommand("Translate that right by fifty centimeters")).toEqual({
    type: "move",
    direction: "right",
    amount: 0.5,
  });
  expect(parseCommand("move it forward 2 feet")).toEqual({
    type: "move",
    direction: "forward",
    amount: 0.6096,
  });
  expect(
    parseCommand("Turn the selected object by minus ninety degrees"),
  ).toEqual({ type: "rotate", amount: -90 });
  expect(parseCommand("resize this by one point five times")).toEqual({
    type: "scale",
    amount: 1.5,
  });
  expect(parseCommand("Change its color to blue")).toEqual({
    type: "color",
    color: "#0000ff",
  });
  expect(parseCommand("Apply satin metal material")).toEqual({
    type: "material",
    material: "solid",
  });
  expect(parseCommand("change material to glass")).toEqual({
    type: "material",
    material: "glass",
  });
  expect(parseCommand("delete the selected object")).toEqual({
    type: "delete",
  });
});
it("creates/selects all shapes, transforms, colors and materials through one transaction each", async () => {
  const c = new CommandInterpreter(async () => {});
  for (const shape of ["cube", "sphere", "cylinder", "cone", "wall", "floor"])
    expect((await c.run(`create a ${shape}`)).ok).toBe(true);
  expect(useSceneStore.getState().objects.at(-1)?.type).toBe("floor");
  const id = useSceneStore.getState().objects[0].id;
  expect((await c.run(`select object with id ${id}`)).ok).toBe(true);
  for (const text of [
    "move it up 2",
    "rotate it 45 degrees",
    "scale it 1.2",
    "make it red",
    "apply wood material",
  ]) {
    const history = useSceneStore.getState().past.length;
    expect((await c.run(text)).ok).toBe(true);
    expect(useSceneStore.getState().past.length).toBe(history + 1);
  }
  expect(useSceneStore.getState().objects[0]).toMatchObject({
    color: "#ff0000",
    material: "wood",
  });
  expect((await c.run("undo")).ok).toBe(true);
  expect((await c.run("redo")).ok).toBe(true);
});
it("unique selection, newest selection, context, duplicate and no-op selection do not guess targets", async () => {
  const c = new CommandInterpreter(async () => {});
  await c.run("create a cube");
  expect((await c.run("select Cube")).message).toContain("Ambiguous");
  await c.run("clear selection");
  expect((await c.run("make it red")).message).toContain(
    "Selected object required",
  );
  expect((await c.run("select last created object")).ok).toBe(true);
  expect((await c.run("duplicate it")).ok).toBe(true);
  expect((await c.run("select missing")).ok).toBe(false);
});
it("confirms destructive commands, rejects stale targets, and undo restores deletion/clear", async () => {
  const c = new CommandInterpreter(async () => {}),
    id = useSceneStore.getState().selectedId;
  expect((await c.run("delete it")).confirmation).toBe(true);
  expect(useSceneStore.getState().objects).toHaveLength(1);
  expect((await c.run("create a wall")).confirmation).toBe(true);
  useSceneStore.getState().select(null);
  expect(c.confirm().ok).toBe(false);
  useSceneStore.getState().select(id);
  await c.run("delete it");
  expect(c.confirm().ok).toBe(true);
  expect(useSceneStore.getState().past).toHaveLength(1);
  await c.run("undo");
  await c.run("clear the scene");
  c.cancel();
  expect(useSceneStore.getState().objects).toHaveLength(1);
  await c.run("clear the scene");
  expect(c.confirm().ok).toBe(true);
  await c.run("undo");
  expect(useSceneStore.getState().objects).toHaveLength(1);
});
it("validates collision, resulting scale, active previews, save errors and busy commands", async () => {
  let finish: () => void = () => {};
  const c = new CommandInterpreter(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  expect((await c.run("move down 2")).ok).toBe(false);
  useSceneStore.setState({
    objects: [{ ...useSceneStore.getState().objects[0], scale: [10, 1, 1] }],
  });
  expect((await c.run("scale 3")).ok).toBe(false);
  const saving = c.run("save");
  expect((await c.run("create a sphere")).message).toContain("still running");
  finish();
  await saving;
  const failure = new CommandInterpreter(async () => {
    throw Error("Storage unavailable");
  });
  expect((await failure.run("save")).message).toBe("Storage unavailable");
  const o = useSceneStore.getState().objects[0];
  useSceneStore.setState({
    preview: { id: o.id, position: o.position, valid: true },
  });
  expect((await c.run("make it red")).ok).toBe(false);
});
it("imported model transforms and appearance preserve metadata and shared history", async () => {
  const original = createCube();
  const model = {
    ...original,
    type: "model" as const,
    model: {
      assetId: "a".repeat(64),
      size: [1, 1, 1] as [number, number, number],
      originalMaterials: true,
    },
  };
  useSceneStore.setState({ objects: [model], selectedId: model.id });
  const c = new CommandInterpreter(async () => {});
  for (const command of [
    "move it right 2",
    "rotate 90",
    "scale 2",
    "make it blue",
    "apply concrete material",
  ])
    expect((await c.run(command)).ok).toBe(true);
  expect(useSceneStore.getState().objects[0].model).toEqual({
    ...model.model,
    originalMaterials: false,
  });
  expect(useSceneStore.getState().past).toHaveLength(5);
});
class FakeRecognition implements Recognition {
  static latest: FakeRecognition;
  continuous = false;
  interimResults = false;
  lang = "";
  maxAlternatives = 0;
  onstart: Recognition["onstart"] = null;
  onend: Recognition["onend"] = null;
  onerror: Recognition["onerror"] = null;
  onresult: Recognition["onresult"] = null;
  onnomatch: Recognition["onnomatch"] = null;
  constructor() {
    FakeRecognition.latest = this;
  }
  start = vi.fn();
  abort = vi.fn();
}
it("speech executes only final result indices once, allows deliberate repetition and ignores stopped callbacks", () => {
  const states: SpeechState[] = [],
    run = vi.fn(),
    c = new SpeechController(FakeRecognition, (s) => states.push(s), run);
  c.start();
  const r = FakeRecognition.latest;
  r.onstart?.();
  const event: SpeechResults = {
    resultIndex: 0,
    results: [{ isFinal: false, 0: { transcript: "create a cube" } }],
  };
  r.onresult?.(event);
  expect(run).not.toHaveBeenCalled();
  event.results[0].isFinal = true;
  r.onresult?.(event);
  r.onresult?.(event);
  expect(run).toHaveBeenCalledTimes(1);
  const repeated: SpeechResults = {
    resultIndex: 1,
    results: [event.results[0], event.results[0]],
  };
  r.onresult?.(repeated);
  expect(run).toHaveBeenCalledTimes(2);
  const late = r.onresult;
  c.stop();
  late?.({
    resultIndex: 2,
    results: [...Array.from(repeated.results), event.results[0]],
  });
  expect(run).toHaveBeenCalledTimes(2);
  expect(r.abort).toHaveBeenCalled();
  expect(states.at(-1)?.status).toBe("idle");
});
it.each([
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
  "network",
  "no-speech",
  "aborted",
])("speech error %s ends recognition without auto-restarting", (error) => {
  const states: SpeechState[] = [],
    c = new SpeechController(FakeRecognition, (s) => states.push(s), vi.fn());
  c.start();
  const r = FakeRecognition.latest;
  r.onerror?.({ error });
  r.onend?.();
  expect(states.at(-1)?.status).toBe("error");
  expect(r.start).toHaveBeenCalledTimes(1);
});
it("handles unsupported and normally ended recognition", () => {
  const change = vi.fn();
  new SpeechController(undefined, change, vi.fn()).start();
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: "unsupported" }),
  );
  const c = new SpeechController(FakeRecognition, change, vi.fn());
  c.start();
  FakeRecognition.latest.onend?.();
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: "idle" }),
  );
});
