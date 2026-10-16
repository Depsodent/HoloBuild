import { z } from "zod";
import { materials, roles } from "./planSchema.mjs";
const delta = z.tuple([
  z.number().finite().min(-50).max(50),
  z.number().finite().min(-40).max(40),
  z.number().finite().min(-50).max(50),
]);
const scale = z.tuple([
  z.number().finite().min(0.1).max(20),
  z.number().finite().min(0.1).max(20),
  z.number().finite().min(0.1).max(20),
]);
export const operationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("select") }).strict(),
  z.object({ type: z.literal("move"), delta }).strict(),
  z
    .object({
      type: z.literal("rotate"),
      angle: z
        .number()
        .finite()
        .min(-Math.PI * 2)
        .max(Math.PI * 2),
    })
    .strict(),
  z.object({ type: z.literal("scale"), factors: scale }).strict(),
  z
    .object({
      type: z.literal("setTransform"),
      position: delta,
      yaw: z.number().finite().min(-Math.PI).max(Math.PI),
      scale,
    })
    .strict(),
  z
    .object({
      type: z.literal("material"),
      material: z.enum(materials),
      role: z.enum(roles).optional(),
      level: z.number().int().min(0).max(5).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("rename"),
      name: z.string().trim().min(1).max(60),
    })
    .strict(),
  ...["duplicate", "ungroup", "delete"].map((type) =>
    z.object({ type: z.literal(type) }).strict(),
  ),
  z
    .object({
      type: z.literal("floors"),
      action: z.enum(["add", "remove", "duplicate", "height"]),
      level: z.number().int().min(0).max(5).optional(),
      height: z.number().min(2.5).max(5).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("unsupported"),
      reason: z.string().min(1).max(240),
    })
    .strict(),
  z
    .object({
      type: z.literal("clarify"),
      question: z.string().min(1).max(240),
    })
    .strict(),
]);
export const editPlanSchema = z
  .object({
    version: z.literal(1),
    target: z.string().min(1).max(100).optional(),
    operation: operationSchema,
  })
  .strict();
export const editContextSchema = z
  .object({
    selected: z.string().uuid().nullable(),
    structures: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string().min(1).max(60),
            type: z.string().max(40),
            count: z.number().int().min(1).max(200),
            floors: z.number().int().min(1).max(6).optional(),
          })
          .strict(),
      )
      .max(200),
  })
  .strict();
export function parseModelEdit(text) {
  if (typeof text !== "string" || text.length > 8192)
    throw Error("Invalid edit response size.");
  return editPlanSchema.parse(
    JSON.parse(text.trim().replace(/^```(?:json)?\s*\n([\s\S]*)\n```$/, "$1")),
  );
}
