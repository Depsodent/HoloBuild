import { z } from "zod";
import { sceneSchema } from "./commandManager";
import type { SceneObject } from "./objectTypes";
import {
  assetSchema,
  validateAsset,
  decodedSize,
  MAX_PROJECT_ASSET_BYTES,
  MAX_PROJECT_CHARS,
  type ModelAsset,
} from "../assets/assetTypes";
import { lightingSchema, type Lighting } from "./lightingStore";
const documentSchema = z.object({
  version: z.literal(1),
  objects: sceneSchema,
  assets: z.array(assetSchema).max(200).optional(),
  assetStorage: z.literal("indexedDB").optional(),
  lighting: lightingSchema.optional(),
});
function validateDocument(input: unknown) {
  const doc = documentSchema.parse(input);
  const assets = doc.assets ?? [];
  if (new Set(assets.map((a) => a.id)).size !== assets.length)
    throw Error("Duplicate asset IDs.");
  assets.forEach(validateAsset);
  if (
    assets.reduce(
      (n, a) => n + a.files.reduce((s, f) => s + decodedSize(f.data), 0),
      0,
    ) > MAX_PROJECT_ASSET_BYTES
  )
    throw Error("Project assets exceed 20 MiB.");
  if (
    !doc.assetStorage &&
    doc.objects.some(
      (o) => o.model && !assets.some((a) => a.id === o.model!.assetId),
    )
  )
    throw Error(
      "Project is missing model assets. Load the self-contained project export.",
    );
  return doc;
}
export function serialize(
  objects: SceneObject[],
  options: {
    assets?: ModelAsset[];
    lighting?: Lighting;
    assetStorage?: "indexedDB";
  } = {},
) {
  const json = JSON.stringify(
    validateDocument({ version: 1, objects, ...options }),
    null,
    2,
  );
  if (json.length > MAX_PROJECT_CHARS)
    throw Error("Project exceeds the 30 MiB JSON limit.");
  return json;
}
export function parseProject(json: string) {
  if (json.length > MAX_PROJECT_CHARS) throw Error("Scene file too large.");
  return validateDocument(JSON.parse(json));
}
export function deserialize(json: string) {
  return parseProject(json).objects;
}
