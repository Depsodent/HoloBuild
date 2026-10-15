import {
  assetId,
  validateAsset,
  encodeBytes,
  MAX_ASSET_BYTES,
  MAX_PROJECT_ASSET_BYTES,
  decodedSize,
  type ModelAsset,
} from "./assetTypes";
import { loadModel, type ModelResource } from "./modelLoader";
import { storeAssets, readAsset } from "./assetStorage";
import { useSceneStore } from "../scene/sceneStore";
import { assetOperation } from "./assetOperation";
const records = new Map<string, ModelAsset>(),
  resources = new Map<string, ModelResource>();
export function modelResource(id: string) {
  return resources.get(id);
}
export async function prepareAssets(assets: ModelAsset[]) {
  const prepared = new Map<string, ModelResource>();
  try {
    const retained = new Map([
      ...records,
      ...assets.map((a) => [a.id, a] as const),
    ]);
    if (
      [...retained.values()].reduce(
        (n, a) => n + a.files.reduce((s, f) => s + decodedSize(f.data), 0),
        0,
      ) >
      50 * 1024 * 1024
    )
      throw Error(
        "Model cache retained for Undo exceeds 50 MiB. Save and reload the page before importing more.",
      );
    let total = 0;
    for (const input of assets) {
      const asset = validateAsset(input);
      total += asset.files.reduce((n, f) => n + decodedSize(f.data), 0);
      if (total > MAX_PROJECT_ASSET_BYTES)
        throw Error("Project assets exceed 20 MiB.");
      if ((await assetId(asset)) !== asset.id)
        throw Error("Model asset checksum does not match its contents.");
      if (!resources.has(asset.id))
        prepared.set(asset.id, await loadModel(asset));
      if (
        [...resources.values(), ...prepared.values()].reduce(
          (n, r) => n + r.estimatedBytes,
          0,
        ) >
        128 * 1024 * 1024
      )
        throw Error(
          "Estimated model GPU budget exceeds 128 MiB including Undo resources. Save and reload the page before importing more.",
        );
    }
    await storeAssets(assets);
    for (const asset of assets) records.set(asset.id, asset);
    prepared.forEach((resource, id) => resources.set(id, resource));
  } catch (error) {
    prepared.forEach((resource) => resource.dispose());
    throw error;
  }
}
export async function importFiles(files: File[]) {
  return assetOperation(() => performImport(files));
}
async function performImport(files: File[]) {
  const main = files.filter((f) => /\.(glb|gltf)$/i.test(f.name));
  if (main.length !== 1)
    throw Error(
      "Select one GLB or GLTF, together with any local BIN/image dependencies.",
    );
  if (
    files.reduce((n, f) => n + f.size, 0) > MAX_ASSET_BYTES ||
    files.length > 64
  )
    throw Error("Model bundle exceeds 10 MiB or 64 files.");
  const data = {
    main: main[0].name,
    files: await Promise.all(
      files.map(async (f) => ({
        name: f.name,
        data: encodeBytes(new Uint8Array(await f.arrayBuffer())),
      })),
    ),
  };
  const asset = validateAsset({ ...data, id: await assetId(data) });
  const referenced = new Set(
    useSceneStore
      .getState()
      .objects.flatMap((o) => (o.model ? [o.model.assetId] : [])),
  );
  referenced.add(asset.id);
  const all = await Promise.all(
    [...referenced].map((id) =>
      id === asset.id ? asset : (records.get(id) ?? readAsset(id)),
    ),
  );
  if (all.some((a) => !a))
    throw Error(
      "A scene model asset is unavailable. Reload its project export.",
    );
  await prepareAssets(all as ModelAsset[]);
  return { asset, resource: resources.get(asset.id)! };
}
export async function assetsFor(ids: string[]) {
  return Promise.all(
    [...new Set(ids)].map(async (id) => {
      const asset = records.get(id) ?? (await readAsset(id));
      if (!asset)
        throw Error(
          "Model asset missing. Reload the self-contained project export.",
        );
      return asset;
    }),
  );
}
export function pruneModelResources() {
  const s = useSceneStore.getState();
  const live = new Set(
    [...s.objects, ...s.past.flat(), ...s.future.flat()].flatMap((o) =>
      o.model ? [o.model.assetId] : [],
    ),
  );
  for (const [id, resource] of resources)
    if (!live.has(id)) {
      resource.dispose();
      resources.delete(id);
      records.delete(id);
    }
}
export function startModelCleanup() {
  return useSceneStore.subscribe(pruneModelResources);
}
