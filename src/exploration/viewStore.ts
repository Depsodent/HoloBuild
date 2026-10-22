import { releaseLook } from "./pointerLock";
import { create } from "zustand";
export const SPRINT_SPEED = 4.4,
  WALK_SPEED = 2.2,
  EYE_HEIGHT = 1.6;
// Retire only the removed view preferences. Portable scenes and workspace layout are untouched.
try {
  localStorage.removeItem("holobuild.exploration.v1");
} catch {
  /* Private browsing may deny storage. */
}
export const useViewStore = create(() => ({
  walking: false,
  furnishing: false,
  manipulating: false,
  paused: true,
  looking: false,
  guide: false,
  message: "",
  approximate: 0,
  doors: 0,
  feet: [0, 0, 0] as [number, number, number],
  resetSeq: 0,
  virtual: { forward: 0, right: 0, turn: 0 },
}));
export const exploring = () => useViewStore.getState().walking;
export function resetWalkthrough() {
  if (!exploring()) return;
  releaseLook();
  useViewStore.setState((s) => ({
    resetSeq: s.resetSeq + 1,
    furnishing: false,
    manipulating: false,
    paused: true,
    looking: false,
    virtual: { forward: 0, right: 0, turn: 0 },
  }));
}

// Exact transient camera feet for placement safety; React telemetry stays throttled.
let currentFeet: [number, number, number] | null = null;
export function publishCameraFeet(feet: [number, number, number] | null) {
  currentFeet = feet;
}
export function walkingFeet() {
  return currentFeet;
}
