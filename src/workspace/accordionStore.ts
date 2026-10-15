import { create } from "zustand";
export const ACCORDION_DEFAULTS: Record<string, boolean> = {
  "tools.shapes": true,
  "tools.transform": false,
  "tools.gestures": true,
  "tools.gesture-settings": false,
  "tools.voice": false,
  "tools.voice-help": false,
  "tools.models": false,
  "tools.lighting": false,
  "inspector.transform": true,
  "inspector.materials": false,
  "inspector.appearance": false,
  "inspector.properties": false,
  "inspector.collection": true,
  "camera.settings": false,
  "camera.calibration": false,
  "diagnostics.tracking": true,
  "diagnostics.gesture": false,
  "diagnostics.pinch": true,
  "diagnostics.two-hand": false,
  "diagnostics.performance": true,
};
export function parseAccordions(value: string | null) {
  const result = { ...ACCORDION_DEFAULTS };
  try {
    const data = JSON.parse(value ?? "null");
    if (data && typeof data === "object" && !Array.isArray(data))
      for (const key of Object.keys(result))
        if (typeof data[key] === "boolean") result[key] = data[key];
  } catch {
    /* Defaults on corrupt/blocked storage. */
  }
  return result;
}
function initial() {
  try {
    return parseAccordions(localStorage.getItem("holobuild.accordions.v1"));
  } catch {
    return parseAccordions(null);
  }
}
export const useAccordionStore = create<{
  open: Record<string, boolean>;
  setOpen: (key: string, value: boolean) => void;
}>((set) => ({
  open: initial(),
  setOpen(key, value) {
    if (!Object.hasOwn(ACCORDION_DEFAULTS, key)) return;
    set((state) => {
      if (state.open[key] === value) return state;
      const open = { ...state.open, [key]: value };
      try {
        localStorage.setItem("holobuild.accordions.v1", JSON.stringify(open));
      } catch {
        /* Session state still works. */
      }
      return { open };
    });
  },
}));
