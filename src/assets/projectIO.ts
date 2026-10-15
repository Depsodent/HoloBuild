import { serialize, parseProject } from "../scene/sceneSerializer";
import {
  assetsFor,
  prepareAssets,
  modelResource,
  pruneModelResources,
} from "./modelRegistry";
import { useLightingStore } from "../scene/lightingStore";
import { execute } from "../scene/commandManager";
import type { SceneObject } from "../scene/objectTypes";
import { assetOperation } from "./assetOperation";
export async function exportProject(objects: SceneObject[]) {
  const assets = await assetsFor(
    objects.flatMap((o) => (o.model ? [o.model.assetId] : [])),
  );
  const lighting = useLightingStore.getState().lighting;
  return {
    json: serialize(objects, {
      assets: assets.length ? assets : undefined,
      lighting,
    }),
    local: serialize(objects, {
      lighting,
      assetStorage: assets.length ? "indexedDB" : undefined,
    }),
  };
}
export async function loadProject(json: string) {
  return assetOperation(() => performLoad(json));
}
async function performLoad(json: string) {
  const project = parseProject(json);
  const ids = [
    ...new Set(
      project.objects.flatMap((o) => (o.model ? [o.model.assetId] : [])),
    ),
  ];
  const embedded = project.assets ?? [];
  const missing = ids.filter((id) => !embedded.some((a) => a.id === id));
  const assets = [...embedded, ...(await assetsFor(missing))];
  try {
    await prepareAssets(assets);
    for (const object of project.objects)
      if (object.model) {
        const size = modelResource(object.model.assetId)?.size;
        if (
          !size ||
          size.some((v, i) => Math.abs(v - object.model!.size[i]) > 0.00001)
        )
          throw Error("Model bounds do not match the embedded asset.");
      }
    if (!execute({ type: "replace", objects: project.objects }))
      throw Error("Scene values were rejected.");
    if (project.lighting) useLightingStore.getState().update(project.lighting);
  } finally {
    pruneModelResources();
  }
}
