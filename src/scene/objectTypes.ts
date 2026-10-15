import { z } from "zod";
import { MATERIAL_IDS } from "./materialPresets";
export const vectorSchema = z.tuple([
  z.number().finite().min(-100).max(100),
  z.number().finite().min(-100).max(100),
  z.number().finite().min(-100).max(100),
]);
export type Vec3 = z.infer<typeof vectorSchema>;
export const objectSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(60),
    type: z.enum([
      "cube",
      "sphere",
      "cylinder",
      "cone",
      "wall",
      "floor",
      "model",
    ]),
    position: vectorSchema,
    rotation: vectorSchema,
    scale: z.tuple([
      z.number().min(0.1).max(20),
      z.number().min(0.1).max(20),
      z.number().min(0.1).max(20),
    ]),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    material: z.enum(MATERIAL_IDS),
    construction: z
      .object({
        structureId: z.string().uuid(),
        partId: z.string().regex(/^[a-zA-Z0-9_-]{1,48}$/),
        role: z.enum([
          "floor",
          "wall",
          "roof",
          "pillar",
          "door",
          "window",
          "beam",
        ]),
      })
      .strict()
      .optional(),
    model: z
      .object({
        assetId: z.string().regex(/^[a-f0-9]{64}$/),
        size: z.tuple([
          z.number().finite().min(0.001).max(2.001),
          z.number().finite().min(0.001).max(2.001),
          z.number().finite().min(0.001).max(2.001),
        ]),
        originalMaterials: z.boolean().default(true),
      })
      .optional(),
    surface: z
      .object({
        roughness: z.number().finite().min(0).max(1).optional(),
        metalness: z.number().finite().min(0).max(1).optional(),
        opacity: z.number().finite().min(0.05).max(1).optional(),
        emissiveIntensity: z.number().finite().min(0).max(3).optional(),
        textureScale: z.number().finite().min(0.25).max(8).optional(),
      })
      .optional(),
  })
  .refine(
    (o) => (o.type === "model") === !!o.model,
    "Model objects require model metadata; primitives cannot reference models.",
  );
export type SceneObject = z.infer<typeof objectSchema>;
export type Tool = "select" | "translate" | "rotate" | "scale";

export type ObjectType = Exclude<SceneObject["type"], "model">;
