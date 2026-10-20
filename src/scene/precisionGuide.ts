import { create } from "zustand";
import { usePrecisionSettings } from "./precisionSettings";
import { objectSchema, type SceneObject } from "./objectTypes";
import { placement } from "../interaction/placement";
import { protectConnectedPart } from "./precision";
interface MouseGuide {
  object: SceneObject;
  valid: boolean;
}
export const useMouseGuide = create(() => ({
  sample: null as MouseGuide | null,
}));
let last = -Infinity;
export function clearMouseGuide(id?: string) {
  if (!id || useMouseGuide.getState().sample?.object.id === id) {
    useMouseGuide.setState({ sample: null });
    last = -Infinity;
  }
}
/** Transient visual state only; validation is throttled to 30 Hz and never commits. */
export function updateMouseGuide(
  object: SceneObject,
  objects: SceneObject[],
  snap: boolean,
  now = performance.now(),
) {
  const p = usePrecisionSettings.getState();
  if (!p.measurements && !p.guides) {
    clearMouseGuide();
    return;
  }
  if (now - last < 1000 / 30) return;
  last = now;
  let valid = objectSchema.safeParse(object).success;
  try {
    protectConnectedPart(object);
  } catch {
    valid = false;
  }
  if (valid) valid = placement(object, object.position, objects, snap).valid;
  useMouseGuide.setState({ sample: { object, valid } });
}
