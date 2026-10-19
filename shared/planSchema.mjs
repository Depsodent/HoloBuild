import { z } from "zod";
export const MAX_PARTS = 120;
export const shapes = ["cube", "sphere", "cylinder", "cone", "wall", "floor"];
export const materials = [
  "solid",
  "glass",
  "matte-plastic",
  "glossy-plastic",
  "polished-metal",
  "holographic",
  "wood",
  "brick",
  "concrete",
];
export const roles = [
  "floor",
  "wall",
  "roof",
  "pillar",
  "door",
  "window",
  "beam",
  "stair",
];
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,48}$/);
export const contactsSchema = z.array(z.tuple([id, id])).max(240);
export const staircaseSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,24}$/),
    from: z.number().int().min(0).max(4),
    to: z.number().int().min(1).max(5),
    steps: z.number().int().min(4).max(32),
    rise: z.number().finite().min(0.1).max(0.4),
    run: z.number().finite().min(0.15).max(0.5),
    width: z.number().finite().min(0.6).max(3),
    x: z.number().finite().min(-15).max(15),
    z: z.number().finite().min(-15).max(15),
    yaw: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    material: z.enum(materials),
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  })
  .strict();
export const templateSchema = z
  .object({
    stairs: z.array(staircaseSchema).max(5).optional(),
    appearance: z
      .object(
        Object.fromEntries(
          roles.map((role) => [
            role,
            z
              .object({
                color: z
                  .string()
                  .regex(/^#[a-fA-F0-9]{6}$/)
                  .optional(),
                material: z.enum(materials).optional(),
              })
              .strict()
              .optional(),
          ]),
        ),
      )
      .strict()
      .optional(),
    kind: z.enum([
      "house",
      "room",
      "tower",
      "office",
      "warehouse",
      "shed",
      "bridge",
    ]),
    width: z.number().min(3).max(20),
    depth: z.number().min(2).max(20),
    height: z.number().min(2.5).max(5),
    floors: z.number().int().min(1).max(6),
    thickness: z.number().min(0.1).max(0.4),
    doors: z.number().int().min(0).max(2),
    windows: z.number().int().min(0).max(6),
    windowWidth: z.number().min(0.5).max(1.4).optional(),
    windowHeight: z.number().min(0.5).max(1.5).optional(),
    windowCounts: z.array(z.number().int().min(0).max(6)).max(6).optional(),
    doorOffset: z.number().min(-2).max(2).optional(),
    material: z.enum(materials),
    roof: z.enum(["flat", "none"]),
  })
  .strict();
export const planSchema = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1).max(80),
    units: z.literal("meters"),
    template: templateSchema.optional(),
    objects: z
      .array(
        z
          .object({
            id,
            name: z.string().trim().min(1).max(60),
            role: z.enum(roles),
            assembly: z
              .string()
              .regex(/^[a-zA-Z0-9_-]{1,24}$/)
              .optional(),
            level: z.number().int().min(0).max(5).optional(),
            type: z.enum(shapes),
            position: z.tuple([
              z.number().finite().min(-30).max(30),
              z.number().finite().min(0).max(40),
              z.number().finite().min(-30).max(30),
            ]),
            rotation: z.tuple([
              z.number().finite().min(-Math.PI).max(Math.PI),
              z.number().finite().min(-Math.PI).max(Math.PI),
              z.number().finite().min(-Math.PI).max(Math.PI),
            ]),
            dimensions: z.tuple([
              z.number().finite().min(0.05).max(30),
              z.number().finite().min(0.05).max(30),
              z.number().finite().min(0.05).max(30),
            ]),
            material: z.enum(materials),
            color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_PARTS),
    contacts: contactsSchema.default([]),
    warnings: z.array(z.string().max(200)).max(16),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const ids = new Set(plan.objects.map((o) => o.id));
    if (ids.size !== plan.objects.length)
      ctx.addIssue({ code: "custom", message: "Duplicate component IDs." });
    for (const [a, b] of plan.contacts)
      if (a === b || !ids.has(a) || !ids.has(b))
        ctx.addIssue({ code: "custom", message: "Invalid contact reference." });
  });
export function cleanPrompt(input) {
  if (
    typeof input !== "string" ||
    input.trim().length < 3 ||
    input.length > 1200 ||
    [...input].some((c) => {
      const n = c.charCodeAt(0);
      return n === 127 || (n < 32 && ![9, 10, 13].includes(n));
    })
  )
    throw Error(
      "Use a text prompt of 3–1200 characters without control characters.",
    );
  return input.trim();
}
export function parseModelPlan(text) {
  if (typeof text !== "string" || text.length > 131072)
    throw Error("Model plan exceeds the 128 KiB limit.");
  const json = text.trim().replace(/^```(?:json)?\s*\n([\s\S]*)\n```$/, "$1");
  return planSchema.parse(JSON.parse(json));
}
