import { FURNITURE_IDS } from "./furnitureCatalog.mjs";
import { standaloneStairSchema, nativeWallSchema } from "./nativeSchema.mjs";
import { z } from "zod";
import {
  materials,
  roles,
  templateSchema,
  staircaseSchema,
  openingSchema,
  balconySchema,
} from "./planSchema.mjs";
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
export const surfacePatchSchema = z
  .object({
    roughness: z.number().finite().min(0).max(1).optional(),
    metalness: z.number().finite().min(0).max(1).optional(),
    opacity: z.number().finite().min(0.05).max(1).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Specify a surface property.");
const atomicOperationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("design"),
      standaloneStairs: standaloneStairSchema.optional(),
      nativeWall: nativeWallSchema.optional(),
      balconies: z.array(balconySchema).max(6).optional(),
      openings: z.array(openingSchema).max(32).optional(),
      stairs: z.array(staircaseSchema).max(5).optional(),
      floors: z.number().int().min(1).max(6).optional(),
      windows: z.number().int().min(0).max(6).optional(),
      level: z.number().int().min(0).max(5).optional(),
      windowScale: z.number().min(0.5).max(1.4).optional(),
      doorOffset: z.number().min(-2).max(2).optional(),
      doors: z.number().int().min(0).max(2).optional(),
      roof: z.enum(["flat", "none"]).optional(),
    })
    .strict()
    .refine((o) => Object.keys(o).length > 1, "Choose a design change."),
  z
    .object({
      type: z.literal("surface"),
      values: surfacePatchSchema.optional(),
      reset: z.literal(true).optional(),
      role: z.enum(roles).optional(),
      level: z.number().int().min(0).max(5).optional(),
    })
    .strict()
    .refine(
      (o) => Boolean(o.values) !== Boolean(o.reset),
      "Choose values or reset.",
    ),
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
      opening: z
        .string()
        .regex(/^[a-zA-Z0-9_-]{1,24}$/)
        .optional(),
      role: z.enum(roles).optional(),
      level: z.number().int().min(0).max(5).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("color"),
      opening: z
        .string()
        .regex(/^[a-zA-Z0-9_-]{1,24}$/)
        .optional(),
      color: z
        .string()
        .regex(/^#[a-fA-F0-9]{6}$/)
        .optional(),
      reset: z.literal(true).optional(),
      role: z.enum(roles).optional(),
      level: z.number().int().min(0).max(5).optional(),
    })
    .strict()
    .refine(
      (o) => Boolean(o.color) !== Boolean(o.reset),
      "Choose color or reset, not both.",
    ),
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
export const operationSchema = z.union([
  atomicOperationSchema,
  z
    .object({
      type: z.literal("batch"),
      operations: z.array(atomicOperationSchema).min(2).max(4),
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
    creationRequest: z.string().min(1).max(1200).optional(),
    selected: z.string().uuid().nullable(),
    selection: z
      .object({
        mode: z.enum(["component", "structure", "none"]),
        id: z.string().uuid().optional(),
        type: z.string().max(20).optional(),
        name: z.string().max(60).optional(),
        furniture: z.enum(FURNITURE_IDS).optional(),
        role: z.enum(roles).optional(),
        assembly: z
          .string()
          .regex(/^[a-zA-Z0-9_-]{1,24}$/)
          .optional(),
        position: delta.optional(),
        scale: scale.optional(),
      })
      .strict()
      .optional(),
    conversation: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            text: z.string().max(160),
          })
          .strict(),
      )
      .max(6)
      .optional(),
    details: z
      .object({
        id: z.string().uuid(),
        dimensions: z.tuple([
          z.number().finite().min(0).max(200),
          z.number().finite().min(0).max(200),
          z.number().finite().min(0).max(200),
        ]),
        requestedDesign: z.string().max(400),
        template: templateSchema.optional(),
        templateIntact: z.boolean().optional(),
        roles: z
          .array(
            z
              .object({
                role: z.enum(roles),
                count: z.number().int().min(1).max(200),
                color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
                material: z.enum(materials),
              })
              .strict(),
          )
          .max(roles.length),
      })
      .strict()
      .optional(),
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
