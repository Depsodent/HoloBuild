import { z } from "zod";
export const MAX_ASSET_BYTES = 10 * 1024 * 1024;
export const MAX_PROJECT_ASSET_BYTES = 20 * 1024 * 1024;
export const MAX_PROJECT_CHARS = 30 * 1024 * 1024;
export const assetSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/),
  main: z.string().min(1).max(200),
  files: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        data: z
          .string()
          .max(Math.ceil(MAX_ASSET_BYTES / 3) * 4)
          .regex(/^[A-Za-z0-9+/]*={0,2}$/)
          .refine((s) => s.length % 4 === 0, "Invalid base64 length"),
      }),
    )
    .min(1)
    .max(64),
});
export type ModelAsset = z.infer<typeof assetSchema>;
export function decodedSize(data: string) {
  return (
    (data.length / 4) * 3 -
    (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0)
  );
}
export function validateAsset(input: unknown): ModelAsset {
  const asset = assetSchema.parse(input);
  if (!/\.(glb|gltf)$/i.test(asset.main))
    throw Error("Choose a GLB or GLTF model.");
  if (
    asset.files.some((f) => /[\\/]/.test(f.name)) ||
    new Set(asset.files.map((f) => f.name)).size !== asset.files.length ||
    !asset.files.some((f) => f.name === asset.main)
  )
    throw Error("Asset filenames must be unique; include the model file.");
  if (
    asset.files.reduce((n, f) => n + decodedSize(f.data), 0) > MAX_ASSET_BYTES
  )
    throw Error("Model and dependencies exceed 10 MiB.");
  return asset;
}
export function encodeBytes(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
export function decodeBytes(data: string) {
  return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
}
export async function assetId(asset: Pick<ModelAsset, "main" | "files">) {
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      main: asset.main,
      files: [...asset.files].sort((a, b) =>
        a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
      ),
    }),
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
