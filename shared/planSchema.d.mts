import type { z } from "zod";
import type { ObjectType, Vec3 } from "../src/scene/objectTypes";
import type { MaterialId } from "../src/scene/materialPresets";
export interface PlanPart {
  id: string;
  name: string;
  role:
    "floor" | "wall" | "roof" | "pillar" | "door" | "window" | "beam" | "stair";
  level?: number;
  assembly?: string;
  opening?: string;
  facade?: Opening["facade"];
  type: ObjectType;
  position: Vec3;
  rotation: Vec3;
  dimensions: Vec3;
  material: MaterialId;
  color: string;
}
export interface Opening {
  id: string;
  kind: "door" | "window";
  level: number;
  facade: "front" | "back" | "left" | "right";
  offset: number;
  bottom: number;
  width: number;
  height: number;
  panel: boolean;
}
export const openingSchema: z.ZodType<Opening>;
export interface Staircase {
  id: string;
  from: number;
  to: number;
  steps: number;
  rise: number;
  run: number;
  width: number;
  x: number;
  z: number;
  yaw: 0 | 90 | 180 | 270;
  material: MaterialId;
  color: string;
}
export const staircaseSchema: z.ZodType<Staircase>;
export interface BuildingTemplate {
  openings?: Opening[];
  stairs?: Staircase[];
  appearance?: Partial<
    Record<PlanPart["role"], { color?: string; material?: MaterialId }>
  >;
  kind: "house" | "room" | "tower" | "office" | "warehouse" | "shed" | "bridge";
  width: number;
  depth: number;
  height: number;
  floors: number;
  thickness: number;
  doors: number;
  windows: number;
  windowWidth?: number;
  windowHeight?: number;
  windowCounts?: number[];
  doorOffset?: number;
  material: MaterialId;
  roof: "flat" | "none";
}
export const templateSchema: z.ZodType<BuildingTemplate>;
export interface ConstructionPlan {
  version: 1;
  name: string;
  units: "meters";
  template?: BuildingTemplate;
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
