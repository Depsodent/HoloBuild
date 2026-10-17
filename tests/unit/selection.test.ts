import { beforeEach, it, expect } from "vitest";
import { selectionForHit } from "../../src/scene/selection";
import { useSceneStore } from "../../src/scene/sceneStore";
import { materializePlan } from "../../src/generation/engine";
import { offlinePlan } from "../../src/generation/offline";
import { GestureController } from "../../src/interaction/gestureController";
import { execute, undo, redo } from "../../src/scene/commandManager";
import { createCube } from "../../src/scene/objectFactory";
import type { GestureFrame } from "../../src/vision/gestureTypes";
const parts = materializePlan(offlinePlan("house without doors")).objects,
  hit = parts.find((o) => o.construction?.role === "roof")!,
  group = hit.construction!.structureId;
beforeEach(() =>
  useSceneStore.setState({
    objects: structuredClone(parts),
    selectionMode: "component",
    selectedId: null,
    selectedStructureId: null,
    preview: null,
    past: [],
    future: [],
    snap: false,
  }),
);
it("Part resolves the hit only; Structure resolves its real parent; invalid/stale hits clear", () => {
  expect(selectionForHit(parts, hit.id, "component")).toEqual({
    selectedId: hit.id,
    selectedStructureId: null,
  });
  expect(selectionForHit(parts, hit.id, "structure")).toEqual({
    selectedId: hit.id,
    selectedStructureId: group,
  });
  expect(selectionForHit(parts, "missing", "structure")).toEqual({
    selectedId: null,
    selectedStructureId: null,
  });
  const cube = createCube();
  expect(
    selectionForHit([cube], cube.id, "structure").selectedStructureId,
  ).toBeNull();
});
it("selection and mode switches are read-only and retain the hit anchor", () => {
  const s = useSceneStore.getState();
  s.setSelectionMode("structure");
  s.select(hit.id);
  expect(useSceneStore.getState().selectedStructureId).toBe(group);
  s.setSelectionMode("component");
  expect(useSceneStore.getState().selectedId).toBe(hit.id);
  expect(useSceneStore.getState().selectedStructureId).toBeNull();
  expect(useSceneStore.getState().past).toHaveLength(0);
});
it("pinch immediately previews the whole selected structure, moves once, and Undo/Redo are atomic", () => {
  const s = useSceneStore.getState();
  s.setSelectionMode("structure");
  const c = new GestureController({
    pick: () => hit.id,
    plane: (p, y) => [p.x * 10, y, 0],
    menuHit: () => null,
  });
  const frame = (pinch: boolean, x = 0.5): GestureFrame => ({
    gesture: pinch ? "pinch" : "pointing",
    candidate: pinch ? "pinch" : "pointing",
    stable: true,
    cursor: { x, y: 0.5 },
    timestamp: 0,
    pinchRatio: pinch ? 0.2 : 1,
    pinchActive: pinch,
    pinchCandidate: pinch,
    pinchStable: true,
    recognitionMs: 0,
  });
  c.update(frame(false));
  c.update(frame(true));
  expect(useSceneStore.getState().preview?.structure?.objects).toHaveLength(
    parts.length,
  );
  expect(useSceneStore.getState().selectedStructureId).toBe(group);
  c.update(frame(true, 0.6));
  c.update(frame(false, 0.6));
  const moved = useSceneStore.getState().objects;
  expect(useSceneStore.getState().past).toHaveLength(1);
  moved.forEach((o, i) =>
    expect(o.position[0] - parts[i].position[0]).toBeCloseTo(1),
  );
  undo();
  expect(useSceneStore.getState().objects).toEqual(parts);
  redo();
  expect(useSceneStore.getState().objects).toEqual(moved);
});
it("selected group transform commands preserve membership and one entry per transform", () => {
  useSceneStore.getState().setSelectionMode("structure");
  useSceneStore.getState().select(hit.id);
  for (const operation of [
    { type: "move" as const, delta: [2, 0, 0] as [number, number, number] },
    { type: "rotate" as const, angle: 0.2 },
    {
      type: "scale" as const,
      factors: [1.1, 1.1, 1.1] as [number, number, number],
    },
  ]) {
    const before = useSceneStore.getState().objects;
    expect(execute({ type: "structure", structureId: group, operation })).toBe(
      true,
    );
    expect(useSceneStore.getState().selectedStructureId).toBe(group);
    undo();
    expect(useSceneStore.getState().objects).toEqual(before);
    redo();
  }
  expect(useSceneStore.getState().past).toHaveLength(3);
});
