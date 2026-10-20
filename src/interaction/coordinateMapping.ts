import { usePrecisionSettings } from "../scene/precisionSettings";
import { Vector2 } from "three";
export interface Cursor {
  x: number;
  y: number;
}
export const isOnViewport = (p: Cursor) =>
  Number.isFinite(p.x) &&
  Number.isFinite(p.y) &&
  p.x >= 0 &&
  p.x <= 1 &&
  p.y >= 0 &&
  p.y <= 1;
export const toNdc = (p: Cursor) => new Vector2(p.x * 2 - 1, 1 - p.y * 2);
export const snapCoordinate = (
  value: number,
  step = usePrecisionSettings.getState().gridStep,
) =>
  Number.isFinite(value) && Number.isFinite(step) && step > 0
    ? Math.round(value / step) * step
    : NaN;
