import { it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  useViewStore,
  resetWalkthrough,
  WALK_SPEED,
  EYE_HEIGHT,
} from "../../src/exploration/viewStore";
import { useSceneStore } from "../../src/scene/sceneStore";
import { execute, undo, redo } from "../../src/scene/commandManager";
import {
  enterExploration,
  exitExploration,
} from "../../src/exploration/actions";
import {
  prepareComponentCommand,
  cancelEdit,
  useEditStore,
} from "../../src/generation/editStore";
import { useGenerationStore } from "../../src/generation/generationStore";
import { createCube } from "../../src/scene/objectFactory";
beforeEach(() => {
  useViewStore.setState({
    walking: false,
    paused: true,
    looking: false,
    guide: false,
    resetSeq: 0,
  });
  cancelEdit();
  useGenerationStore.setState({ prepared: null, status: "idle" });
  const cube = createCube();
  useSceneStore.setState({
    objects: [cube],
    selectedId: cube.id,
    selectedStructureId: null,
    past: [],
    future: [],
    preview: null,
    tool: "translate",
  });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubGlobal("document", {
    exitPointerLock: vi.fn(),
    pointerLockElement: {},
  });
});
afterEach(() => {
  useViewStore.setState({ walking: false });
  vi.unstubAllGlobals();
});
it("walkthrough rejects commands and history while preserving exact scene snapshots", () => {
  execute({ type: "create" });
  const s = useSceneStore.getState();
  enterExploration();
  expect(execute({ type: "delete", id: s.objects[0].id })).toBe(false);
  undo();
  redo();
  expect(useSceneStore.getState().objects).toBe(s.objects);
  expect(useSceneStore.getState().past).toBe(s.past);
  exitExploration();
  expect(execute({ type: "create" })).toBe(true);
});
it("pending previews prevent entry without discarding geometry or proposal", () => {
  const s = useSceneStore.getState(),
    next = [...s.objects, createCube([3, 0.5, 0])];
  prepareComponentCommand(
    { type: "replace", objects: next },
    next,
    [next[1]],
    "preview",
  );
  const p = useEditStore.getState().prepared;
  expect(enterExploration()).toBe(false);
  expect(useEditStore.getState().prepared).toBe(p);
  expect(useSceneStore.getState().objects).toBe(s.objects);
  expect(useViewStore.getState().walking).toBe(false);
});
it("entry is idempotent and preserves tool and selection context", () => {
  const s = useSceneStore.getState();
  expect(enterExploration()).toBe(true);
  expect(enterExploration()).toBe(true);
  expect(window.dispatchEvent).toHaveBeenCalledOnce();
  exitExploration();
  expect(useSceneStore.getState().objects).toBe(s.objects);
  expect(useSceneStore.getState().selectedId).toBe(s.selectedId);
  expect(useSceneStore.getState().tool).toBe("translate");
  expect(document.exitPointerLock).toHaveBeenCalledOnce();
});
it("reset is view-only, clears held input and does not issue scene history", () => {
  const s = useSceneStore.getState();
  resetWalkthrough();
  expect(useViewStore.getState().resetSeq).toBe(0);
  enterExploration();
  useViewStore.setState({
    paused: false,
    looking: true,
    virtual: { forward: 1, right: 1, turn: 1 },
  });
  resetWalkthrough();
  expect(useViewStore.getState()).toMatchObject({
    resetSeq: 1,
    paused: true,
    looking: false,
    virtual: { forward: 0, right: 0, turn: 0 },
  });
  expect(useSceneStore.getState().objects).toBe(s.objects);
  expect(useSceneStore.getState().past).toBe(s.past);
});
it("walk settings are fixed and removed preferences are absent from view state", () => {
  expect(WALK_SPEED).toBe(2.2);
  expect(EYE_HEIGHT).toBe(1.6);
  for (const k of ["presentation", "views", "speed", "eyeHeight", "request"])
    expect(useViewStore.getState()).not.toHaveProperty(k);
});
