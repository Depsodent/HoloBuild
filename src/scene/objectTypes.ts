import { z } from "zod";
import { MATERIAL_IDS } from "./materialPresets";
export const vectorSchema = z.tuple([
  z.number().finite().min(-100).max(100),
  z.number().finite().min(-100).max(100),
  z.number().finite().min(-100).max(100),
]);
export type Vec3 = z.infer<typeof vectorSchema>;
export const objectSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(60),
  type: z.enum(["cube", "sphere", "cylinder", "cone", "wall", "floor"]),
  position: vectorSchema,
  rotation: vectorSchema,
  scale: z.tuple([
    z.number().min(0.1).max(20),
    z.number().min(0.1).max(20),
    z.number().min(0.1).max(20),
  ]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  material: z.enum(MATERIAL_IDS),
});
export type SceneObject = z.infer<typeof objectSchema>;
export type Tool = "select" | "translate" | "rotate" | "scale";

export type ObjectType = SceneObject["type"];
