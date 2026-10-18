import type { z } from "zod";
import type { BuildingTemplate, ConstructionPlan } from "./planSchema.mjs";
import type { StructureOperation } from "./editSchema.mjs";
export type AssistantPlan =
  | { kind: "compose"; plan: ConstructionPlan; message: string }
  | { kind: "create"; design: BuildingTemplate; message: string }
  | {
      kind: "edit";
      scope: "component" | "structure";
      target: string;
      operation: StructureOperation;
      message: string;
    }
  | { kind: "clarify" | "explain" | "finish"; message: string };
export const assistantPlanSchema: z.ZodType<AssistantPlan>;
export function parseModelAssistant(text: unknown): AssistantPlan;
export const assistantResponseSchema: z.ZodType;
