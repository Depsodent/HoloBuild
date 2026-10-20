import type { z } from "zod";
import type { MaterialId } from "../src/scene/materialPresets";
import type { Opening } from "./planSchema.mjs";
export interface StandaloneStair {
  steps: number;
  height: number;
  run: number;
  width: number;
  material: MaterialId;
  color: string;
}
export interface NativeWall {
  width: number;
  height: number;
  thickness: number;
  material: MaterialId;
  color: string;
  openings: Opening[];
}
export const standaloneStairSchema: z.ZodType<StandaloneStair>;
export const nativeWallSchema: z.ZodType<NativeWall>;
