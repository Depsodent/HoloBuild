import { z } from "zod";
import { sceneSchema } from "./commandManager";
import type { SceneObject } from "./objectTypes";
const documentSchema = z.object({
  version: z.literal(1),
  objects: sceneSchema,
});
export function serialize(objects: SceneObject[]) {
  return JSON.stringify(documentSchema.parse({ version: 1, objects }), null, 2);
}
export function deserialize(json: string) {
  if (json.length > 1_000_000) throw new Error("Scene file too large.");
  return documentSchema.parse(JSON.parse(json)).objects;
}
