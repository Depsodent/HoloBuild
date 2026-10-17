import { materializePlan } from "../../src/generation/engine";
import { offlinePlan } from "../../src/generation/offline";
import { structureInfo } from "../../src/scene/structures";
import { beforeEach, expect, it } from "vitest";
import { AutoIntent, AUTO_THRESHOLDS } from "../../src/interaction/autoIntent";
import { AutoGestureController } from "../../src/interaction/autoGestureController";
import { GestureController } from "../../src/interaction/gestureController";
import { TwoHandController } from "../../src/interaction/twoHandController";
import { useAdvancedStore } from "../../src/interaction/advancedStore";
import { useSceneStore } from "../../src/scene/sceneStore";
import { useInteractionStore } from "../../src/interaction/interactionStore";
import { createCube } from "../../src/scene/objectFactory";
import { pair, recognized } from "../fixtures/advanced";
import { undo, redo } from "../../src/scene/commandManager";
const scene = () => useSceneStore.getState();
beforeEach(() => {
  const cube = createCube();
  useSceneStore.setState({
    objects: [cube],
    selectedId: cube.id,
    selectedStructureId: null,
    selectionMode: "component",
    past: [],
    future: [],
    preview: null,
    snap: false,
    tool: "select",
  });
  useAdvancedStore.setState({
    mode: "auto",
    active: false,
    intent: null,
    autoThresholds: { ...AUTO_THRESHOLDS },
  });
  useInteractionStore.setState({ menuOpen: false, phase: "idle" });
});
it("requires consistent radial/angular dominance, rejects ambiguity and brief noise", () => {
  for (const [r, a, want] of [
    [0.2, 0, "scale"],
    [0, 0.3, "rotate"],
  ] as const) {
    const arb = new AutoIntent();
    expect(arb.update(r, a, 0, AUTO_THRESHOLDS)).toBeNull();
    expect(arb.update(r, a, 60, AUTO_THRESHOLDS)).toBeNull();
    expect(arb.update(r, a, 140, AUTO_THRESHOLDS)).toBe(want);
  }
  const arb = new AutoIntent();
  for (let t = 0; t < 1000; t += 40)
    expect(arb.update(0.2, 0.35, t, AUTO_THRESHOLDS)).toBeNull();
});
it.each(["scale", "rotate"] as const)(
  "auto locks %s, commits once and reverses exactly",
  (mode) => {
    const c = new TwoHandController(),
      original = scene().objects;
    c.update(pair(0, 0.2, false));
    c.update(pair(100, 0.2, true));
    expect(useAdvancedStore.getState().intent).toBe("detect");
    for (let t = 140; t < 1000; t += 40) {
      const f = pair(t, mode === "scale" ? 0.3 : 0.2, true);
      if (mode === "rotate") {
        f.hands = [
          recognized(1, 0.4, true, 0.4),
          recognized(2, 0.6, true, 0.55),
        ];
      }
      c.update(f);
    }
    expect(useAdvancedStore.getState().intent).toBe(mode);
    expect(scene().past).toHaveLength(0);
    c.update(pair(1000, 0.3, false));
    expect(scene().past).toHaveLength(1);
    const after = scene().objects;
    undo();
    expect(scene().objects).toEqual(original);
    redo();
    expect(scene().objects).toEqual(after);
  },
);
it("ambiguous armed release and hand loss create no accidental commands", () => {
  const c = new TwoHandController();
  c.update(pair(0, 0.2, false));
  c.update(pair(100, 0.2, true));
  for (let t = 140; t < 500; t += 40) c.update(pair(t, 0.2, true));
  c.update(pair(500, 0.2, false));
  expect(scene().past).toHaveLength(0);
  c.update(pair(600, 0.2, false));
  c.update(pair(700, 0.2, true));
  const lost = pair(740, 0.2, true);
  lost.hands.pop();
  c.update(lost);
  expect(scene().preview).toBeNull();
  expect(c.active).toBe(false);
});
it("one-hand move transfers its uncommitted position into scaling with one history action", () => {
  const id = scene().selectedId!,
    one = new GestureController({
      pick: () => id,
      plane: (p, y) => [p.x * 10, y, 0],
      menuHit: () => null,
    }),
    c = new AutoGestureController(one);
  const feed = (
    t: number,
    x: number,
    pinch: boolean,
    second?: boolean,
    d = 0.2,
  ) => {
    const hands = [
      recognized(1, x, pinch),
      ...(second === undefined ? [] : [recognized(2, x + d, second)]),
    ];
    const frame = { hands, timestamp: t, aspectRatio: 1, ambiguous: false };
    hands.forEach((h) => (h.gesture.timestamp = t));
    c.update(frame, hands[0].gesture);
  };
  feed(0, 0.4, false);
  feed(100, 0.4, true);
  feed(140, 0.5, true);
  const moved = scene().preview!.position;
  expect(moved[0]).toBeCloseTo(1);
  feed(180, 0.5, true, false);
  feed(220, 0.5, true, true);
  expect(c.two.active).toBe(true);
  expect(scene().preview!.position).toEqual(moved);
  for (let t = 260; t < 1000; t += 40) feed(t, 0.5, true, true, 0.3);
  expect(useAdvancedStore.getState().intent).toBe("scale");
  feed(1000, 0.5, false, false, 0.3);
  expect(scene().past).toHaveLength(1);
  expect(scene().objects[0].position[0]).toBeCloseTo(1);
  undo();
  expect(scene().objects[0].position).toEqual([0, 0.5, 0]);
});

it("locked radial intent does not become yaw when the hand line later rotates", () => {
  const c = new TwoHandController();
  c.update(pair(0, 0.2, false));
  c.update(pair(100, 0.2, true));
  for (let t = 140; t < 600; t += 40) c.update(pair(t, 0.3, true));
  expect(useAdvancedStore.getState().intent).toBe("scale");
  const initialRotation = scene().preview!.rotation;
  for (let t = 600; t < 900; t += 40) {
    const f = pair(t, 0.2, true);
    f.hands = [recognized(1, 0.4, true, 0.3), recognized(2, 0.6, true, 0.6)];
    c.update(f);
  }
  expect(useAdvancedStore.getState().intent).toBe("scale");
  expect(scene().preview!.rotation).toEqual(initialRotation);
  c.cancel();
  expect(scene().past).toHaveLength(0);
});

it("an uncommitted whole-structure move transfers its frame to Auto scale and undoes as one command", () => {
  const parts = materializePlan(offlinePlan("house without doors")).objects;
  useSceneStore.setState({
    objects: parts,
    selectedId: parts[0].id,
    selectedStructureId: parts[0].construction!.structureId,
    selectionMode: "structure",
  });
  const one = new GestureController({
      pick: () => parts[0].id,
      plane: (p, y) => [p.x * 10, y, 0],
      menuHit: () => null,
    }),
    controller = new AutoGestureController(one);
  const feed = (
    t: number,
    x: number,
    pinch: boolean,
    second?: boolean,
    d = 0.2,
  ) => {
    const hands = [
      recognized(1, x, pinch),
      ...(second === undefined ? [] : [recognized(2, x + d, second)]),
    ];
    hands.forEach((h) => (h.gesture.timestamp = t));
    controller.update(
      { hands, timestamp: t, aspectRatio: 1, ambiguous: false },
      hands[0].gesture,
    );
  };
  feed(0, 0.4, false);
  feed(100, 0.4, true);
  feed(140, 0.5, true);
  const moved = structureInfo(scene().preview!.structure!.objects).position;
  feed(180, 0.5, true, false);
  feed(220, 0.5, true, true);
  expect(scene().preview!.structure!.objects).toHaveLength(parts.length);
  for (let t = 260; t < 1000; t += 40) feed(t, 0.5, true, true, 0.28);
  expect(scene().preview!.valid).toBe(true);
  feed(1000, 0.5, false, false, 0.28);
  expect(scene().past).toHaveLength(1);
  expect(structureInfo(scene().objects).position).toEqual(moved);
  undo();
  expect(scene().objects).toEqual(parts);
});
