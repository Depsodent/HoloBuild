import { beforeEach, it, expect } from "vitest";
import { TwoHandController } from "../../src/interaction/twoHandController";
import { boundedFactor } from "../../src/interaction/twoHandMath";
import { useAdvancedStore } from "../../src/interaction/advancedStore";
import { useInteractionStore } from "../../src/interaction/interactionStore";
import { useSceneStore } from "../../src/scene/sceneStore";
import { createCube } from "../../src/scene/objectFactory";
import { undo, redo } from "../../src/scene/commandManager";

import type { HandsFrame } from "../../src/vision/handRecognizer";
import { recognized, pair } from "../fixtures/advanced";
beforeEach(() => {
  const cube = createCube();
  useSceneStore.setState({
    objects: [cube],
    selectedId: cube.id,
    preview: null,
    past: [],
    future: [],
    snap: true,
  });
  useInteractionStore.setState({ menuOpen: false, phase: "idle" });
  useAdvancedStore.setState({ mode: "scale", active: false });
});
it("uniform factor limits respect every component of the original nonuniform scale", () => {
  expect(boundedFactor([1, 2, 4], 100)).toBe(5);
  expect(boundedFactor([1, 2, 4], 0)).toBe(0.1);
});
it("two pinches preview scale without editing objects; release commits once and undo/redo restores it", () => {
  const c = new TwoHandController(),
    original = structuredClone(useSceneStore.getState().objects[0]);
  c.update(pair(0, 0.2, false));
  c.update(pair(100, 0.2, true));
  expect(c.active).toBe(true);
  for (let t = 140; t < 1000; t += 40) c.update(pair(t, 0.4, true));
  expect(useSceneStore.getState().objects[0]).toEqual(original);
  expect(useSceneStore.getState().preview?.scale![0]).toBeCloseTo(2, 2);
  expect(useSceneStore.getState().past).toHaveLength(0);
  c.update(pair(1000, 0.4, false));
  expect(useSceneStore.getState().past).toHaveLength(1);
  expect(useSceneStore.getState().objects[0].scale[0]).toBeCloseTo(2, 2);
  undo();
  expect(useSceneStore.getState().objects[0]).toEqual(original);
  redo();
  expect(useSceneStore.getState().objects[0].scale[0]).toBeCloseTo(2, 2);
});
it("missing, ambiguous or changed-ID hands cancel; held pinches cannot restart", () => {
  for (const loss of ["missing", "ambiguous", "identity", "stalled"] as const) {
    const c = new TwoHandController();
    c.update(pair(0, 0.2, false));
    c.update(pair(100, 0.2, true));
    const frame = pair(loss === "stalled" ? 500 : 150, 0.2, true);
    if (loss === "missing") frame.hands.pop();
    if (loss === "ambiguous") frame.ambiguous = true;
    if (loss === "identity") frame.hands[0].id = 3;
    c.update(frame);
    expect(c.active).toBe(false);
    expect(useSceneStore.getState().preview).toBeNull();
    c.update(pair(200, 0.2, true));
    expect(c.active).toBe(false);
    expect(useSceneStore.getState().past).toHaveLength(0);
  }
});
it("overlapping scale release rejects the whole operation without history", () => {
  useSceneStore.setState({
    objects: [...useSceneStore.getState().objects, createCube([1.5, 0.5, 0])],
  });
  const c = new TwoHandController();
  c.update(pair(0, 0.2, false));
  c.update(pair(100, 0.2, true));
  for (let t = 140; t < 1000; t += 40) c.update(pair(t, 0.6, true));
  expect(useSceneStore.getState().preview?.valid).toBe(false);
  c.update(pair(1000, 0.6, false));
  expect(useSceneStore.getState().past).toHaveLength(0);
  expect(useSceneStore.getState().objects[0].scale).toEqual([1, 1, 1]);
});
it("move mode cannot initiate scaling and mode change cancels previews", () => {
  const c = new TwoHandController();
  c.update(pair(0, 0.2, false));
  c.update(pair(100, 0.2, true));
  useAdvancedStore.setState({ mode: "move" });
  c.update(pair(150, 0.2, true));
  expect(c.active).toBe(false);
  expect(useSceneStore.getState().preview).toBeNull();
});

it("angle unwrapping crosses ±180° continuously", async () => {
  const { angleDelta } = await import("../../src/interaction/twoHandMath");
  expect(angleDelta((-179 * Math.PI) / 180, (179 * Math.PI) / 180)).toBeCloseTo(
    (2 * Math.PI) / 180,
  );
  expect(angleDelta((179 * Math.PI) / 180, (-179 * Math.PI) / 180)).toBeCloseTo(
    (-2 * Math.PI) / 180,
  );
});
function angled(timestamp: number, angle: number, pinch: boolean): HandsFrame {
  const radius = 0.15,
    x = Math.cos(angle) * radius,
    y = Math.sin(angle) * radius;
  return {
    hands: [
      recognized(1, 0.5 - x, pinch, 0.45 - y),
      recognized(2, 0.5 + x, pinch, 0.45 + y),
    ],
    timestamp,
    aspectRatio: 1,
    ambiguous: false,
  };
}
it("rotation mode changes yaw only and records one reversible command", () => {
  useAdvancedStore.setState({ mode: "rotate", rotationSensitivity: 1 });
  const c = new TwoHandController();
  c.update(angled(0, 0, false));
  c.update(angled(100, 0, true));
  for (let t = 140; t < 1000; t += 40) c.update(angled(t, Math.PI / 3, true));
  expect(useSceneStore.getState().preview?.rotation![1]).toBeCloseTo(
    Math.PI / 3,
    2,
  );
  expect(useSceneStore.getState().preview?.scale).toEqual([1, 1, 1]);
  c.update(angled(1000, Math.PI / 3, false));
  expect(useSceneStore.getState().past).toHaveLength(1);
  undo();
  expect(useSceneStore.getState().objects[0].rotation).toEqual([0, 0, 0]);
  redo();
  expect(useSceneStore.getState().objects[0].rotation[1]).toBeCloseTo(
    Math.PI / 3,
    2,
  );
});
it("switching between scale and rotation cancels, not commits or repurposes a session", () => {
  const c = new TwoHandController();
  c.update(pair(0, 0.25, false));
  c.update(pair(100, 0.25, true));
  useAdvancedStore.setState({ mode: "rotate" });
  c.update(pair(150, 0.3, true));
  expect(c.active).toBe(false);
  expect(useSceneStore.getState().preview).toBeNull();
  expect(useSceneStore.getState().past).toHaveLength(0);
});

it("world-Y rotation respects an already tilted object's orientation", async () => {
  const { yawRotation } = await import("../../src/interaction/twoHandMath");
  const { Quaternion, Euler, Vector3 } = await import("three");
  const initial: [number, number, number] = [0.4, 0.2, -0.3];
  const q = new Quaternion().setFromEuler(new Euler(...initial));
  const expected = new Quaternion()
    .setFromAxisAngle(new Vector3(0, 1, 0), 0.7)
    .multiply(q);
  const actual = new Quaternion().setFromEuler(
    new Euler(...yawRotation(initial, 0.7)),
  );
  expect(actual.angleTo(expected)).toBeCloseTo(0);
});
it("a wall's rotated collision rejects release atomically", async () => {
  const { createObject } = await import("../../src/scene/objectFactory");
  const wall = createObject("wall");
  useSceneStore.setState({
    objects: [wall, createCube([0, 0.5, 1.5])],
    selectedId: wall.id,
  });
  useAdvancedStore.setState({ mode: "rotate", rotationSensitivity: 1 });
  const c = new TwoHandController();
  c.update(angled(0, 0, false));
  c.update(angled(100, 0, true));
  for (let t = 140; t < 1000; t += 40) c.update(angled(t, Math.PI / 2, true));
  expect(useSceneStore.getState().preview?.valid).toBe(false);
  c.update(angled(1000, Math.PI / 2, false));
  expect(useSceneStore.getState().past).toHaveLength(0);
  expect(useSceneStore.getState().objects[0].rotation).toEqual([0, 0, 0]);
});
it("off-screen hand inputs cancel an advanced session even without a large jump", () => {
  const c = new TwoHandController();
  const start = {
    ...pair(0, 0.15, false),
    hands: [recognized(1, 0.82, false), recognized(2, 0.97, false)],
  };
  c.update(start);
  c.update({
    ...start,
    timestamp: 100,
    hands: [recognized(1, 0.82, true), recognized(2, 0.97, true)],
  });
  expect(c.active).toBe(true);
  c.update({
    ...start,
    timestamp: 150,
    hands: [recognized(1, 0.82, true), recognized(2, 1.02, true)],
  });
  expect(c.active).toBe(false);
  expect(useSceneStore.getState().past).toHaveLength(0);
});

it.each(["sphere", "cylinder", "cone", "wall", "floor"] as const)(
  "two-hand scaling preserves %s geometry, grounding, history and scene JSON",
  async (type) => {
    const { createObject } = await import("../../src/scene/objectFactory");
    const { bounds } = await import("../../src/interaction/placement");
    const { serialize, deserialize } =
      await import("../../src/scene/sceneSerializer");
    const object = createObject(type);
    useSceneStore.setState({ objects: [object], selectedId: object.id });
    const c = new TwoHandController();
    c.update(pair(0, 0.2, false));
    c.update(pair(100, 0.2, true));
    for (let t = 140; t < 1000; t += 40) c.update(pair(t, 0.4, true));
    c.update(pair(1000, 0.4, false));
    const s = useSceneStore.getState();
    expect(s.past).toHaveLength(1);
    expect(s.objects[0].type).toBe(type);
    expect(bounds(s.objects[0]).min.y).toBeCloseTo(0);
    expect(deserialize(serialize(s.objects))).toEqual(s.objects);
    undo();
    expect(useSceneStore.getState().objects[0]).toEqual(object);
  },
);

it("off-grid transform previews match the shared snapped commit exactly", () => {
  const object = createCube([0.26, 0.5, 0]);
  useSceneStore.setState({ objects: [object], selectedId: object.id });
  const c = new TwoHandController();
  c.update(pair(0, 0.25, false));
  c.update(pair(100, 0.25, true));
  c.update(pair(150, 0.3, true));
  const preview = structuredClone(useSceneStore.getState().preview)!;
  expect(preview.position[0]).toBe(0.5);
  c.update(pair(200, 0.3, false));
  expect(useSceneStore.getState().objects[0].position).toEqual(
    preview.position,
  );
  expect(useSceneStore.getState().past).toHaveLength(1);
});
