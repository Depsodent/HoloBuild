import type { z } from "zod";
import type { Vec3 } from "../src/scene/objectTypes";
import type { MaterialId } from "../src/scene/materialPresets";
import type { PlanPart, BuildingTemplate, Staircase } from "./planSchema.mjs";
export type AtomicStructureOperation =
  | {
      type: "design";
      stairs?: Staircase[];
      floors?: number;
      windows?: number;
      level?: number;
      windowScale?: number;
      doorOffset?: number;
      doors?: number;
      roof?: "flat" | "none";
    }
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
export type StructureOperation =
  | AtomicStructureOperation
  | { type: "batch"; operations: AtomicStructureOperation[] };
export interface EditPlan {
  version: 1;
  target?: string;
  operation: StructureOperation;
}
export interface EditContext {
  selection?: {
    mode: "component" | "structure" | "none";
    id?: string;
    type?: string;
    assembly?: string;
    role?: PlanPart["role"];
    position?: Vec3;
    scale?: Vec3;
  };
  conversation?: { role: "user" | "assistant"; text: string }[];
  details?: {
    id: string;
    dimensions: Vec3;
    requestedDesign: string;
    template?: BuildingTemplate;
    templateIntact?: boolean;
    roles: {
      role: PlanPart["role"];
      count: number;
      color: string;
      material: MaterialId;
    }[];
  };
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
