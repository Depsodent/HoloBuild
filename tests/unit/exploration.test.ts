import { it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  useViewStore,
  cameraViewSchema,
  viewPreferences,
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
    presentation: false,
    paused: true,
    views: [],
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
  vi.stubGlobal("document", { exitPointerLock: vi.fn() });
  vi.stubGlobal("localStorage", { setItem: vi.fn() });
});
afterEach(() => {
  useViewStore.setState({ walking: false, presentation: false });
  vi.unstubAllGlobals();
});
it("walkthrough and presentation reject edits and undo/redo while preserving exact scene and history", () => {
  execute({ type: "create" });
  const state = useSceneStore.getState();
  useViewStore.setState({ walking: true });
  expect(execute({ type: "delete", id: state.objects[0].id })).toBe(false);
  undo();
  redo();
  expect(useSceneStore.getState().objects).toBe(state.objects);
  expect(useSceneStore.getState().past).toBe(state.past);
  useViewStore.setState({ walking: false, presentation: true });
  expect(execute({ type: "reset" })).toBe(false);
  exitExploration();
  expect(execute({ type: "create" })).toBe(true);
});
it("pending AI edits prevent entry and remain unchanged instead of being discarded", () => {
  const s = useSceneStore.getState(),
    next = [...s.objects, createCube([3, 0.5, 0])];
  prepareComponentCommand(
    { type: "replace", objects: next },
    next,
    [next[1]],
    "preview",
  );
  const p = useEditStore.getState().prepared;
  expect(enterExploration(true)).toBe(false);
  expect(useEditStore.getState().prepared).toBe(p);
  expect(useSceneStore.getState().objects).toBe(s.objects);
  expect(useViewStore.getState().walking).toBe(false);
});
it("view modes are independent from tool selection and scene geometry", () => {
  const s = useSceneStore.getState();
  expect(enterExploration(false)).toBe(true);
  expect(useViewStore.getState().presentation).toBe(true);
  expect(enterExploration(true)).toBe(true);
  expect(useSceneStore.getState().tool).toBe("translate");
  exitExploration();
  expect(useSceneStore.getState().objects).toBe(s.objects);
  expect(useSceneStore.getState().selectedId).toBe(s.selectedId);
  expect(window.dispatchEvent).toHaveBeenCalledTimes(2);
});
it("saved views and preferences are bounded and do not enter scene history", () => {
  const s = useSceneStore.getState();
  expect(() => viewPreferences({ speed: NaN })).toThrow();
  expect(() =>
    cameraViewSchema.parse({
      id: "bad",
      name: "Bad",
      position: [0, 0, 0],
      target: [0, 0, 0],
      quaternion: [0, 0, 0, 0],
      walking: true,
      eyeHeight: 1.6,
    }),
  ).toThrow();
  viewPreferences({ speed: 1.8, eyeHeight: 1.7 });
  expect(localStorage.setItem).toHaveBeenCalledOnce();
  expect(useSceneStore.getState().objects).toBe(s.objects);
  expect(useSceneStore.getState().past).toHaveLength(0);
});
