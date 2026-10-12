import type { SceneObject } from "./objectTypes";
export const HISTORY_LIMIT = 80;
export function appendHistory(
  history: SceneObject[][],
  objects: SceneObject[],
) {
  return [...history.slice(-(HISTORY_LIMIT - 1)), structuredClone(objects)];
}
