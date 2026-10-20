import { create } from "zustand";
export const WALK_SPEED = 2.2,
  EYE_HEIGHT = 1.6;
// Retire only the removed view preferences. Portable scenes and workspace layout are untouched.
try {
  localStorage.removeItem("holobuild.exploration.v1");
} catch {
  /* Private browsing may deny storage. */
}
export const useViewStore = create(() => ({
  walking: false,
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
  if (document.pointerLockElement) document.exitPointerLock?.();
  useViewStore.setState((s) => ({
    resetSeq: s.resetSeq + 1,
    paused: true,
    looking: false,
    virtual: { forward: 0, right: 0, turn: 0 },
  }));
}
