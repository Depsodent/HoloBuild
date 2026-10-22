import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { createFurniture } from "../../src/furniture/factory";
import { createCube } from "../../src/scene/objectFactory";
import { useSceneStore } from "../../src/scene/sceneStore";
import {
  useViewStore,
  publishCameraFeet,
} from "../../src/exploration/viewStore";
import {
  beginDirect,
  updateDirect,
  commitDirect,
  cancelDirect,
  rotateDirect,
} from "../../src/exploration/directManipulation";
import {
  executeWalkthroughTransform,
  execute,
  undo,
  redo,
} from "../../src/scene/commandManager";
import { materializePlan } from "../../src/generation/engine";
import { offlinePlan } from "../../src/generation/offline";
import {
  requestLook,
  releaseLook,
  syncLook,
  keyboardLook,
} from "../../src/exploration/pointerLock";
let el: {
  focus: ReturnType<typeof vi.fn>;
  requestPointerLock: ReturnType<typeof vi.fn>;
  tabIndex: number;
};
beforeEach(() => {
  cancelDirect();
  el = {
    focus: vi.fn(),
    requestPointerLock: vi.fn(() => Promise.resolve()),
    tabIndex: -1,
  };
  vi.stubGlobal("document", {
    querySelector: () => el,
    pointerLockElement: null,
    exitPointerLock: vi.fn(),
  });
  releaseLook();
  syncLook();
  useViewStore.setState({
    walking: true,
    manipulating: false,
    furnishing: false,
    looking: false,
    paused: false,
  });
  publishCameraFeet([0, 0, 0]);
  const sofa = createFurniture("sofa-two", [0, 0, -4]);
  useSceneStore.setState({
    objects: [sofa],
    selectedId: sofa.id,
    selectedStructureId: null,
    selectionMode: "component",
    past: [],
    future: [],
    preview: null,
    snap: false,
  });
});
afterEach(() => {
  cancelDirect();
  useViewStore.setState({ walking: false });
  vi.unstubAllGlobals();
});
it("direct movement previews inertly and commits exactly one reversible furniture operation", () => {
  const s = useSceneStore.getState(),
    o = s.objects[0];
  expect(beginDirect(o.id)).toBe(true);
  updateDirect([1, o.position[1], -4]);
  expect(useSceneStore.getState().objects).toBe(s.objects);
  expect(useSceneStore.getState().preview?.valid).toBe(true);
  expect(commitDirect()).toBe(true);
  const after = useSceneStore.getState().objects;
  expect(after[0].position[0]).toBe(1);
  expect(useSceneStore.getState().past).toHaveLength(1);
  useViewStore.setState({ walking: false });
  undo();
  expect(useSceneStore.getState().objects).toEqual(s.objects);
  redo();
  expect(useSceneStore.getState().objects).toEqual(after);
});
it("invalid collision and player overlap release without scene or history mutation", () => {
  const s = useSceneStore.getState(),
    o = s.objects[0],
    block = createCube([4, 0.5, -4]);
  useSceneStore.setState({ objects: [o, block] });
  const base = useSceneStore.getState().objects;
  for (const pos of [
    [4, o.position[1], -4],
    [0, o.position[1], 0],
  ]) {
    beginDirect(o.id);
    updateDirect(pos as [number, number, number]);
    expect(useSceneStore.getState().preview?.valid).toBe(false);
    expect(commitDirect()).toBe(false);
    expect(useSceneStore.getState().objects).toBe(base);
    expect(useSceneStore.getState().past).toHaveLength(0);
  }
});
it("rotation and movement during one drag share one history entry; stale selection cancels", () => {
  const o = useSceneStore.getState().objects[0];
  beginDirect(o.id);
  updateDirect([1, o.position[1], -4]);
  rotateDirect(1);
  rotateDirect(1);
  expect(useSceneStore.getState().past).toHaveLength(0);
  expect(commitDirect()).toBe(true);
  expect(useSceneStore.getState().past).toHaveLength(1);
  expect(useSceneStore.getState().objects[0].rotation[1]).toBeCloseTo(
    Math.PI / 6,
  );
  const base = useSceneStore.getState().objects;
  beginDirect(o.id);
  useSceneStore.getState().select(null);
  expect(commitDirect()).toBe(false);
  expect(useSceneStore.getState().objects).toBe(base);
});
it("selected rotation is one validated command; cancel/no movement creates no history", () => {
  expect(rotateDirect(1)).toBe(true);
  expect(useSceneStore.getState().past).toHaveLength(1);
  const o = useSceneStore.getState().objects[0],
    base = useSceneStore.getState().objects;
  beginDirect(o.id);
  cancelDirect();
  expect(useSceneStore.getState().objects).toBe(base);
  beginDirect(o.id);
  expect(commitDirect()).toBe(true);
  expect(useSceneStore.getState().past).toHaveLength(1);
});
it("support dependencies and whole Structure scope remain strict and atomic", () => {
  const table = createFurniture("coffee-table", [0, 0, -4]),
    lamp = createFurniture("table-lamp", [0, 0.48, -4]);
  useSceneStore.setState({ objects: [table, lamp], selectedId: table.id });
  beginDirect(table.id);
  updateDirect([3, table.position[1], -4]);
  expect(useSceneStore.getState().preview?.valid).toBe(false);
  cancelDirect();
  const parts = materializePlan(offlinePlan("Build a house")).objects,
    cube = createCube([15, 0.5, 15]);
  useSceneStore.setState({
    objects: [...parts, cube],
    selectedId: null,
    selectedStructureId: null,
  });
  publishCameraFeet([-20, 0, -20]);
  expect(beginDirect(parts[0].id)).toBe(false);
  useSceneStore.setState({ selectionMode: "structure" });
  expect(beginDirect(parts[0].id)).toBe(true);
  updateDirect([
    parts[0].position[0] + 2,
    parts[0].position[1],
    parts[0].position[2],
  ]);
  expect(commitDirect()).toBe(true);
  expect(
    useSceneStore.getState().objects.find((o) => o.id === cube.id),
  ).toEqual(cube);
  expect(useSceneStore.getState().selectedStructureId).toBe(
    parts[0].construction?.structureId,
  );
});
it("direct permission never enables arbitrary edits or normal walking commands", () => {
  const s = useSceneStore.getState(),
    o = s.objects[0];
  beginDirect(o.id);
  expect(execute({ type: "delete", id: o.id })).toBe(false);
  expect(
    executeWalkthroughTransform(
      { type: "update", id: o.id, patch: { color: "#ff0000" } },
      s.objects,
    ),
  ).toBe(false);
  expect(
    executeWalkthroughTransform(
      { type: "update", id: o.id, patch: { position: [1, 0.5, -4] } },
      [...s.objects],
    ),
  ).toBe(false);
  expect(useSceneStore.getState().objects).toBe(s.objects);
});
it("real lock state distinguishes native Escape loss from intentional catalog unlock", async () => {
  requestLook();
  expect(el.requestPointerLock).toHaveBeenCalledOnce();
  Object.assign(document, { pointerLockElement: el });
  await Promise.resolve();
  syncLook();
  expect(useViewStore.getState().looking).toBe(true);
  Object.assign(document, { pointerLockElement: null });
  expect(syncLook()).toBe(true);
  Object.assign(document, { pointerLockElement: el });
  syncLook();
  releaseLook();
  Object.assign(document, { pointerLockElement: null });
  expect(syncLook()).toBe(false);
});
it("lock refusal gives an explicit fallback without retry loops; stale completions cannot re-enter", async () => {
  el.requestPointerLock.mockRejectedValueOnce(new Error("denied"));
  requestLook();
  await Promise.resolve();
  await Promise.resolve();
  expect(useViewStore.getState().message).toMatch(/unavailable|declined/);
  expect(el.requestPointerLock).toHaveBeenCalledOnce();
  let done!: () => void;
  el.requestPointerLock.mockImplementation(
    () =>
      new Promise<void>((r) => {
        done = r;
      }),
  );
  requestLook();
  useViewStore.setState({ walking: false });
  releaseLook();
  Object.assign(document, { pointerLockElement: el });
  done();
  await Promise.resolve();
  expect(document.exitPointerLock).toHaveBeenCalled();
  expect(useViewStore.getState().walking).toBe(false);
});
it("intentional keyboard fallback survives its delayed unlock event", () => {
  Object.assign(document, { pointerLockElement: el });
  syncLook();
  keyboardLook();
  Object.assign(document, { pointerLockElement: null });
  expect(syncLook()).toBe(false);
  expect(useViewStore.getState().paused).toBe(false);
  expect(syncLook()).toBe(false);
  expect(useViewStore.getState().paused).toBe(false);
});

it("reacquisition after an exit whose unlock event arrived outside the walking listener releases again", async () => {
  requestLook();
  Object.assign(document, { pointerLockElement: el });
  await Promise.resolve();
  syncLook();
  releaseLook();
  Object.assign(document, { pointerLockElement: null });
  requestLook();
  Object.assign(document, { pointerLockElement: el });
  await Promise.resolve();
  syncLook();
  expect(useViewStore.getState().looking).toBe(true);
  releaseLook();
  expect(document.exitPointerLock).toHaveBeenCalledTimes(2);
});

it("a stationary grab of an off-grid half-turned object does not snap, normalize Euler angles or create history", () => {
  const o = createFurniture("wardrobe", [0.13, 0, -4.07]);
  o.rotation = [0, Math.PI, 0];
  useSceneStore.setState({ objects: [o], selectedId: o.id, snap: true });
  const base = useSceneStore.getState().objects;
  expect(beginDirect(o.id)).toBe(true);
  expect(commitDirect()).toBe(true);
  expect(useSceneStore.getState().objects).toBe(base);
  expect(useSceneStore.getState().past).toHaveLength(0);
});
