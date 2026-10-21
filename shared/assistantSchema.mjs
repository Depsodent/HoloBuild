import { z } from "zod";
import { FURNITURE_IDS } from "./furnitureCatalog.mjs";
import { templateSchema, planSchema } from "./planSchema.mjs";
import { operationSchema } from "./editSchema.mjs";
export const assistantPlanSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("furnish"),
      preset: z.enum(FURNITURE_IDS),
      position: z
        .tuple([
          z.number().finite().min(-49).max(49),
          z.number().finite().min(0).max(45),
          z.number().finite().min(-49).max(49),
        ])
        .optional(),
      message: z.string().min(1).max(240),
    })
    .strict(),
  z
    .object({
      kind: z.literal("compose"),
      plan: planSchema,
      message: z
        .string()
        .min(1)
        .max(240)
        .default(
          "Review the proposed changes and placement in the preview; nothing has been applied.",
        ),
    })
    .strict(),
  z
    .object({
      kind: z.literal("create"),
      design: templateSchema,
      message: z
        .string()
        .min(1)
        .max(240)
        .default(
          "Review the proposed changes and placement in the preview; nothing has been applied.",
        ),
    })
    .strict(),
  z
    .object({
      kind: z.literal("edit"),
      scope: z.enum(["component", "structure"]),
      target: z.string().uuid(),
      operation: operationSchema,
      message: z
        .string()
        .min(1)
        .max(240)
        .default(
          "Review the proposed changes and placement in the preview; nothing has been applied.",
        ),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["clarify", "explain", "finish"]),
      message: z.string().min(1).max(400),
    })
    .strict(),
]);
// Bound decoder complexity; the full discriminated schema validates the result.
export const assistantResponseSchema = z
  .object({
    response: z
      .string()
      .max(130000)
      .describe(
        "A JSON string containing the complete runtime assistant response, including kind, message, and fields required for that kind.",
      ),
  })
  .strict();
export function parseModelAssistant(text) {
  if (typeof text !== "string" || text.length > 262144)
    throw Error("Invalid assistant response size.");
  let data = JSON.parse(
    text.trim().replace(/^```(?:json)?\s*\n([\s\S]*)\n```$/, "$1"),
  );
  if (data && typeof data === "object" && "response" in data)
    data = JSON.parse(assistantResponseSchema.parse(data).response);
  return assistantPlanSchema.parse(data);
}
