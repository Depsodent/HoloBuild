import { beforeEach, it, expect } from "vitest";
import { TwoHandController } from "../../src/interaction/twoHandController";
import { GestureController } from "../../src/interaction/gestureController";
import { useAdvancedStore } from "../../src/interaction/advancedStore";
import { useInteractionStore } from "../../src/interaction/interactionStore";
import { useSceneStore } from "../../src/scene/sceneStore";
import { createCube } from "../../src/scene/objectFactory";
import { undo, redo } from "../../src/scene/commandManager";
import { recognized } from "../fixtures/advanced";
beforeEach(() => {
  const o = createCube();
  useSceneStore.setState({
    objects: [o],
    selectedId: o.id,
    past: [],
    future: [],
    preview: null,
    snap: true,
    tool: "select",
  });
  useAdvancedStore.setState({ mode: "scale", active: false, readyHands: 0 });
  useInteractionStore.setState({ menuOpen: false, phase: "idle" });
});
it("staggered hand readiness retains selection, captures a fresh baseline and commits once", () => {
  const c = new TwoHandController(),
    original = useSceneStore.getState().objects[0];
  const feed = (t: number, a: boolean, b?: boolean, x = 0.3) =>
    c.update({
      hands: [
        recognized(1, x, a),
        ...(b === undefined ? [] : [recognized(2, 0.75, b)]),
      ],
      timestamp: t,
      aspectRatio: 1,
      ambiguous: false,
    });
  feed(0, false);
  expect(useAdvancedStore.getState().message).toContain(
    "Waiting for second hand",
  );
  feed(100, true);
  feed(200, true, false, 0.35);
  feed(300, true, true, 0.4);
  expect(c.active).toBe(true);
  expect(useSceneStore.getState().selectedId).toBe(original.id);
  expect(useSceneStore.getState().preview?.scale).toEqual(original.scale);
  for (let t = 340; t < 1000; t += 40) feed(t, true, true, 0.25);
  feed(1000, false, false, 0.25);
  expect(useSceneStore.getState().past).toHaveLength(1);
  undo();
  expect(useSceneStore.getState().objects[0]).toEqual(original);
  redo();
  expect(useSceneStore.getState().objects[0].scale[0]).toBeGreaterThan(1);
});
it("a new hand stabilizing does not erase the first prepared pinch", () => {
  const c = new TwoHandController(),
    first = recognized(1, 0.3, false);
  c.update({ hands: [first], timestamp: 0, aspectRatio: 1, ambiguous: false });
  const closed = recognized(1, 0.3, true),
    incoming = recognized(2, 0.7, false);
  incoming.gesture = {
    ...incoming.gesture,
    gesture: "none",
    pinchStable: false,
  };
  c.update({
    hands: [closed, incoming],
    timestamp: 100,
    aspectRatio: 1,
    ambiguous: false,
  });
  c.update({
    hands: [closed, recognized(2, 0.7, false)],
    timestamp: 200,
    aspectRatio: 1,
    ambiguous: false,
  });
  c.update({
    hands: [closed, recognized(2, 0.7, true)],
    timestamp: 300,
    aspectRatio: 1,
    ambiguous: false,
  });
  expect(c.active).toBe(true);
  expect(useSceneStore.getState().preview?.scale).toEqual([1, 1, 1]);
});
it("closed hands expire after the readiness window and cannot accidentally rearm", () => {
  const c = new TwoHandController();
  const feed = (t: number, a: boolean, b?: boolean) =>
    c.update({
      hands: [
        recognized(1, 0.3, a),
        ...(b === undefined ? [] : [recognized(2, 0.7, b)]),
      ],
      timestamp: t,
      aspectRatio: 1,
      ambiguous: false,
    });
  feed(0, false);
  for (let t = 40; t <= 4200; t += 40) feed(t, true);
  feed(4240, true, false);
  feed(4280, true, true);
  expect(c.active).toBe(false);
  feed(4320, false, false);
  feed(4360, true, true);
  expect(c.active).toBe(true);
  feed(4400, true);
  expect(c.active).toBe(false);
  expect(useSceneStore.getState().past).toHaveLength(0);
});
it("selection-only pinch reuses real ray targeting without moving or creating history", () => {
  const o = useSceneStore.getState().objects[0];
  useSceneStore.setState({ selectedId: null });
  const c = new GestureController({
    pick: () => o.id,
    plane: () => [0, 0.5, 0],
    menuHit: () => null,
  });
  c.update(recognized(1, 0.5, false).gesture, true);
  c.update(recognized(1, 0.5, true).gesture, true);
  expect(useSceneStore.getState().selectedId).toBe(o.id);
  expect(useSceneStore.getState().preview).toBeNull();
  expect(useSceneStore.getState().past).toHaveLength(0);
  useAdvancedStore.setState({ mode: "rotate" });
  expect(useSceneStore.getState().selectedId).toBe(o.id);
});
