import type { z } from "zod";
import type { ObjectType, Vec3 } from "../src/scene/objectTypes";
import type { MaterialId } from "../src/scene/materialPresets";
export interface PlanPart {
  id: string;
  name: string;
  role: "floor" | "wall" | "roof" | "pillar" | "door" | "window" | "beam";
  type: ObjectType;
  position: Vec3;
  rotation: Vec3;
  dimensions: Vec3;
  material: MaterialId;
  color: string;
}
export interface ConstructionPlan {
  version: 1;
  name: string;
  units: "meters";
  objects: PlanPart[];
  contacts: [string, string][];
  warnings: string[];
}
export const MAX_PARTS: number;
export const shapes: ObjectType[];
export const materials: MaterialId[];
export const roles: PlanPart["role"][];
export const contactsSchema: z.ZodType<[string, string][]>;
export const planSchema: z.ZodType<ConstructionPlan>;
export function cleanPrompt(input: unknown): string;
export function parseModelPlan(text: string): ConstructionPlan;
