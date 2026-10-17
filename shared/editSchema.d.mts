import type { z } from "zod";
import type { Vec3 } from "../src/scene/objectTypes";
import type { MaterialId } from "../src/scene/materialPresets";
import type { PlanPart } from "./planSchema.mjs";
export type StructureOperation =
  | { type: "select" | "duplicate" | "ungroup" | "delete" }
  | { type: "move"; delta: Vec3 }
  | { type: "rotate"; angle: number }
  | { type: "scale"; factors: Vec3 }
  | { type: "setTransform"; position: Vec3; yaw: number; scale: Vec3 }
  | {
      type: "material";
      material: MaterialId;
      role?: PlanPart["role"];
      level?: number;
    }
  | {
      type: "color";
      color?: string;
      reset?: true;
      role?: PlanPart["role"];
      level?: number;
    }
  | { type: "rename"; name: string }
  | {
      type: "floors";
      action: "add" | "remove" | "duplicate" | "height";
      level?: number;
      height?: number;
    }
  | { type: "unsupported"; reason: string }
  | { type: "clarify"; question: string };
export interface EditPlan {
  version: 1;
  target?: string;
  operation: StructureOperation;
}
export interface EditContext {
  selected: string | null;
  structures: {
    id: string;
    name: string;
    type: string;
    count: number;
    floors?: number;
  }[];
}
export const operationSchema: z.ZodType<StructureOperation>;
export const editPlanSchema: z.ZodType<EditPlan>;
export const editContextSchema: z.ZodType<EditContext>;
export function parseModelEdit(text: unknown): EditPlan;
