import { it, expect } from "vitest";
import { Box3, Vector3 } from "three";
import { modelFixture } from "../fixtures/models";
import { modelManifest, loadModel } from "../../src/assets/modelLoader";
import {
  assetId,
  validateAsset,
  type ModelAsset,
} from "../../src/assets/assetTypes";
import { createCube } from "../../src/scene/objectFactory";
import { objectSchema, type SceneObject } from "../../src/scene/objectTypes";
import { useSceneStore } from "../../src/scene/sceneStore";
import { execute, undo, redo } from "../../src/scene/commandManager";
import { bounds, placement } from "../../src/interaction/placement";
import {
  serialize,
  deserialize,
  parseProject,
} from "../../src/scene/sceneSerializer";
import { TwoHandController } from "../../src/interaction/twoHandController";
import { useAdvancedStore } from "../../src/interaction/advancedStore";
import { useInteractionStore } from "../../src/interaction/interactionStore";
import { pair } from "../fixtures/advanced";
import { prepareAssets } from "../../src/assets/modelRegistry";
import { assetOperation } from "../../src/assets/assetOperation";
const fixture = modelFixture();
async function asset(): Promise<ModelAsset> {
  const source = {
    main: "box.glb",
    files: [{ name: "box.glb", data: fixture.glb.toString("base64") }],
  };
  return { ...source, id: await assetId(source) };
}
const model = (): SceneObject => ({
  ...createCube(),
  type: "model",
  position: [0, 1, 0],
  model: { assetId: "a".repeat(64), size: [1, 2, 1], originalMaterials: true },
});
it("loads GLB through GLTFLoader, normalizes bounds, shares resources and disposes geometry/material once", async () => {
  const a = await asset();
  const resource = await loadModel(a);
  expect(resource.triangles).toBe(12);
  expect(resource.size[1]).toBeCloseTo(2);
  const box = new Box3().setFromObject(resource.group);
  expect(box.getCenter(new Vector3()).length()).toBeLessThan(0.00001);
  let disposed = 0;
  resource.group.traverse((n) => {
    if ("geometry" in n)
      (
        n.geometry as { addEventListener: (t: string, cb: () => void) => void }
      ).addEventListener("dispose", () => disposed++);
  });
  resource.dispose();
  expect(disposed).toBe(1);
});
it("bakes translated, rotated and mirrored GLTF nodes into centered model bounds", async () => {
  const f = modelFixture({
    translation: [5, 3, -2],
    scale: [-2, 1, 1],
    rotation: [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)],
  });
  const data = {
    main: "mirrored.glb",
    files: [{ name: "mirrored.glb", data: f.glb.toString("base64") }],
  };
  const resource = await loadModel({ ...data, id: await assetId(data) });
  const box = new Box3().setFromObject(resource.group),
    size = box.getSize(new Vector3());
  expect(box.getCenter(new Vector3()).length()).toBeLessThan(0.00001);
  expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(2);
  expect(resource.estimatedBytes).toBeGreaterThan(0);
  resource.dispose();
});
it("rejects checksum mismatches and simultaneous import/load transactions without touching the scene", async () => {
  const a = await asset();
  await expect(prepareAssets([{ ...a, id: "0".repeat(64) }])).rejects.toThrow(
    /checksum/,
  );
  let finish!: () => void;
  const first = assetOperation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await expect(assetOperation(async () => {})).rejects.toThrow(/running/);
  finish();
  await first;
  await expect(assetOperation(async () => true)).resolves.toBe(true);
});
it("rejects malformed GLB, missing/external GLTF assets, bad names and altered bundles", async () => {
  expect(() => modelManifest(new Uint8Array([1, 2, 3]))).toThrow();
  const a = await asset();
  expect(() =>
    validateAsset({ ...a, files: [...a.files, ...a.files] }),
  ).toThrow();
  expect(() => validateAsset({ ...a, main: "foo.obj" })).toThrow();
  for (const uri of [
    "mesh.bin",
    "https://example.com/mesh.bin",
    "../mesh.bin",
  ]) {
    const data = fixture.dependent.replace("mesh.bin", uri);
    await expect(
      loadModel({
        ...a,
        main: "box.gltf",
        files: [
          { name: "box.gltf", data: Buffer.from(data).toString("base64") },
        ],
      }),
    ).rejects.toThrow();
  }
  expect(await assetId({ ...a, main: "changed.glb" })).not.toBe(a.id);
});
it("model bounds rotate/scale and shared import, update, duplicate, delete commands remain undoable", () => {
  const o = model();
  useSceneStore.setState({ objects: [], past: [], future: [], snap: true });
  expect(execute({ type: "import", object: o })).toBe(true);
  expect(
    execute({
      type: "update",
      id: o.id,
      patch: { scale: [2, 1, 1], rotation: [0, Math.PI / 2, 0] },
    }),
  ).toBe(true);
  const changed = useSceneStore.getState().objects[0];
  expect(bounds(changed).getSize(new Vector3()).z).toBeCloseTo(2);
  expect(
    placement(changed, changed.position, [createCube()], false).valid,
  ).toBe(false);
  expect(execute({ type: "duplicate", id: o.id })).toBe(true);
  expect(useSceneStore.getState().objects[1].model).toEqual(o.model);
  expect(execute({ type: "delete", id: o.id })).toBe(true);
  undo();
  expect(useSceneStore.getState().objects).toHaveLength(2);
  redo();
  expect(useSceneStore.getState().objects).toHaveLength(1);
});
it("legacy scenes remain compatible; model scenes require embedded assets or explicit local references", async () => {
  const o = model(),
    a = await asset();
  o.model!.assetId = a.id;
  expect(deserialize(serialize([createCube()]))[0].type).toBe("cube");
  expect(() => serialize([o])).toThrow(/missing model assets/);
  const json = serialize([o], { assets: [a] });
  expect(deserialize(json)).toEqual([o]);
  expect(parseProject(json).assets).toHaveLength(1);
  expect(deserialize(serialize([o], { assetStorage: "indexedDB" }))).toEqual([
    o,
  ]);
  expect(objectSchema.safeParse({ ...o, model: undefined }).success).toBe(
    false,
  );
  expect(() =>
    parseProject(JSON.stringify({ version: 1, objects: [o], assets: [a, a] })),
  ).toThrow();
});
it("two-hand scaling uses the same imported model transaction and one history entry", () => {
  const o = model();
  useSceneStore.setState({
    objects: [o],
    past: [],
    future: [],
    selectedId: o.id,
    preview: null,
    snap: true,
  });
  useAdvancedStore.setState({ mode: "scale", active: false });
  useInteractionStore.setState({ menuOpen: false, phase: "idle" });
  const c = new TwoHandController();
  c.update(pair(0, 0.2, false));
  c.update(pair(100, 0.2, true));
  for (let t = 140; t < 1000; t += 40) c.update(pair(t, 0.3, true));
  c.update(pair(1000, 0.3, false));
  expect(useSceneStore.getState().past).toHaveLength(1);
  expect(useSceneStore.getState().objects[0].scale[0]).toBeGreaterThan(1.4);
  undo();
  expect(useSceneStore.getState().objects[0]).toEqual(o);
});
