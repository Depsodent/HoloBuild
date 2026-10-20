import { z } from "zod";
import { materials, openingSchema } from "./planSchema.mjs";
export const standaloneStairSchema = z
  .object({
    steps: z.number().int().min(4).max(32),
    height: z.number().finite().min(0.4).max(6),
    run: z.number().finite().min(0.15).max(0.5),
    width: z.number().finite().min(0.6).max(3),
    material: z.enum(materials),
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  })
  .strict()
  .refine(
    (v) => v.height / v.steps >= 0.1 - 1e-8 && v.height / v.steps <= 0.4 + 1e-8,
    "Step rise must be 0.1–0.4m.",
  );
export const nativeWallSchema = z
  .object({
    width: z.number().finite().min(0.5).max(20),
    height: z.number().finite().min(1).max(10),
    thickness: z.number().finite().min(0.05).max(1),
    material: z.enum(materials),
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    openings: z.array(openingSchema).max(12),
  })
  .strict()
  .refine(
    (v) => v.openings.every((o) => o.level === 0 && o.facade === "front"),
    "Standalone wall openings belong to its one facade.",
  );
