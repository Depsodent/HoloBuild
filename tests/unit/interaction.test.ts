import { beforeEach, it, expect } from "vitest";
import { GestureController } from "../../src/interaction/gestureController";
import { placement } from "../../src/interaction/placement";
import { toNdc, snapCoordinate } from "../../src/interaction/coordinateMapping";
import { useSceneStore } from "../../src/scene/sceneStore";
import { createCube } from "../../src/scene/objectFactory";
import { undo, redo } from "../../src/scene/commandManager";
import { useInteractionStore } from "../../src/interaction/interactionStore";
import type { Gesture, GestureFrame } from "../../src/vision/gestureTypes";
const cube = createCube();
const frame = (gesture: Gesture, x = 0.5): GestureFrame => ({
  gesture,
  candidate: gesture,
  stable: true,
  cursor: gesture === "none" ? null : { x, y: 0.5 },
  timestamp: 0,
  pinchRatio: gesture === "pinch" ? 0.2 : 1,
  pinchActive: gesture === "pinch",
  pinchCandidate: gesture === "pinch",
  pinchStable: true,
  recognitionMs: 0,
});
const controller = () =>
  new GestureController({
    pick: () => cube.id,
    plane: (p, y) => [p.x * 10, y, p.y * 10],
    menuHit: () => "create",
  });
beforeEach(() => {
  useSceneStore.setState({
    objects: [structuredClone(cube)],
    selectedId: cube.id,
    preview: null,
    past: [],
    future: [],
    snap: true,
  });
  useInteractionStore.setState({
    phase: "idle",
    menuOpen: false,
    hoveredId: null,
  });
});
it("maps mirrored screen coordinates to Three.js NDC", () => {
  expect(toNdc({ x: 0, y: 0 }).toArray()).toEqual([-1, 1]);
  expect(toNdc({ x: 1, y: 1 }).toArray()).toEqual([1, -1]);
  expect(snapCoordinate(1.26)).toBe(1.5);
});
it("requires an open pinch before grabbing and records just one command per drag", () => {
  const c = controller();
  c.update(frame("pinch"));
  expect(c.dragging).toBe(false);
  c.update(frame("pointing"));
  c.update(frame("pinch"));
  expect(c.dragging).toBe(true);
  for (let x = 0.51; x <= 0.7; x += 0.01) c.update(frame("pinch", x));
  expect(useSceneStore.getState().past).toHaveLength(0);
  expect(useSceneStore.getState().objects[0].position).toEqual(cube.position);
  c.update(frame("pointing", 0.7));
  expect(useSceneStore.getState().objects[0].position).toEqual([2, 0.5, 0]);
  expect(useSceneStore.getState().past).toHaveLength(1);
  undo();
  expect(useSceneStore.getState().objects[0].position).toEqual(cube.position);
  redo();
  expect(useSceneStore.getState().objects[0].position[0]).toBe(2);
});
it("hand loss and fist cancel uncommitted movement", () => {
  for (const end of ["none", "fist"] as const) {
    const c = controller();
    c.update(frame("pointing"));
    c.update(frame("pinch"));
    c.update(frame("pinch", 0.7));
    c.update(frame(end));
    expect(useSceneStore.getState().preview).toBeNull();
    expect(useSceneStore.getState().objects[0].position).toEqual(cube.position);
    expect(useSceneStore.getState().past).toHaveLength(0);
  }
});
it("rejects overlaps, below-ground and out-of-bounds placement but allows touching", () => {
  const other = createCube([2, 0.5, 0]);
  expect(placement(cube, [2, 0.5, 0], [cube, other], true).valid).toBe(false);
  expect(placement(cube, [1, 0.5, 0], [cube, other], true).valid).toBe(true);
  expect(placement(cube, [0, -1, 0], [cube], true).valid).toBe(false);
  expect(placement(cube, [51, 0.5, 0], [cube], true).valid).toBe(false);
});
it("invalid release preserves scene and history", () => {
  useSceneStore.setState({ objects: [cube, createCube([2, 0.5, 0])] });
  const c = controller();
  c.update(frame("pointing"));
  c.update(frame("pinch"));
  c.update(frame("pinch", 0.7));
  expect(useSceneStore.getState().preview?.valid).toBe(false);
  c.update(frame("pointing", 0.7));
  expect(useSceneStore.getState().objects[0].position).toEqual(cube.position);
  expect(useSceneStore.getState().past).toHaveLength(0);
});
it("open palm never opens a menu; explicit menu allows one action per pinch", () => {
  const c = controller();
  c.update(frame("open-palm"));
  expect(useInteractionStore.getState().menuOpen).toBe(false);
  useInteractionStore.setState({ menuOpen: true });
  c.update(frame("pointing"));
  c.update(frame("pinch"));
  c.update(frame("pinch"));
  expect(useSceneStore.getState().objects).toHaveLength(2);
  expect(useSceneStore.getState().past).toHaveLength(1);
});
it("relaxed fingers and bounded closure drift retain a recent actual ray hit", () => {
  const c = new GestureController({
    pick: (p) => (p.x === 0.5 ? cube.id : undefined),
    plane: (p, y) => [p.x * 10, y, 0],
    menuHit: () => null,
  });
  c.update({ ...frame("unknown"), timestamp: 100 });
  c.update({
    ...frame("unknown", 0.54),
    timestamp: 150,
    pinchCandidate: true,
    pinchStable: false,
  });
  c.update({ ...frame("pinch", 0.56), timestamp: 260 });
  expect(c.dragging).toBe(true);
  expect(useInteractionStore.getState().rayTarget).toBeNull();
  c.update({ ...frame("pinch", 0.76), timestamp: 320 });
  c.update({ ...frame("unknown", 0.76), timestamp: 440 });
  expect(useSceneStore.getState().past).toHaveLength(1);
  expect(useInteractionStore.getState().menuOpen).toBe(false);
});
it("never grabs a stale or distant remembered target and reports the rejection", () => {
  for (const [time, x] of [
    [700, 0.54],
    [200, 0.7],
  ]) {
    const c = new GestureController({
      pick: (p) => (p.x === 0.5 ? cube.id : undefined),
      plane: (p, y) => [p.x, y, 0],
      menuHit: () => null,
    });
    c.update({ ...frame("pointing"), timestamp: 100 });
    c.update({ ...frame("pinch", x), timestamp: time });
    expect(c.dragging).toBe(false);
    expect(useInteractionStore.getState().rejection).toContain("Ray missed");
  }
});
it("UI overlays block ray selection and cancel active previews", () => {
  let blocked = true;
  const c = new GestureController({
    pick: () => cube.id,
    plane: (p, y) => [p.x, y, 0],
    menuHit: () => null,
    blocked: () => blocked,
  });
  c.update(frame("pointing"));
  c.update(frame("pinch"));
  expect(c.dragging).toBe(false);
  blocked = false;
  c.update(frame("pointing"));
  c.update(frame("pinch"));
  expect(c.dragging).toBe(true);
  blocked = true;
  c.update(frame("pinch"));
  expect(c.dragging).toBe(false);
  expect(useSceneStore.getState().past).toHaveLength(0);
});
it("a stationary grab/release is a no-op, not a misleading undo entry", () => {
  const c = controller();
  c.update(frame("pointing"));
  c.update(frame("pinch"));
  c.update(frame("pointing"));
  expect(useSceneStore.getState().past).toHaveLength(0);
  expect(useSceneStore.getState().preview).toBeNull();
});
it("leaving the viewport and large tracking jumps cancel safely", () => {
  for (const x of [-0.1, 0.99]) {
    const c = controller();
    c.update(frame("pointing"));
    c.update(frame("pinch"));
    c.update(frame("pinch", x));
    expect(c.dragging).toBe(false);
    expect(useSceneStore.getState().preview).toBeNull();
    expect(useSceneStore.getState().past).toHaveLength(0);
  }
});
