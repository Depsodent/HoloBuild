import { create } from "zustand";
export const MAJOR_GROUPS = [
  "tools.shapes",
  "tools.transform",
  "tools.voice",
  "tools.scene",
];
export const ACCORDION_DEFAULTS: Record<string, boolean> = {
  "tools.shapes": true,
  "tools.transform": false,
  "tools.gestures": false,
  "tools.scene": false,
  "tools.gesture-settings": false,
  "tools.voice": false,
  "tools.voice-help": false,
  "tools.quick": true,
  "tools.generator": false,
  "tools.generator-parameters": false,
  "tools.ai-settings": false,
  "tools.ai-examples": false,
  "tools.models": false,
  "tools.lighting": false,
  "inspector.transform": true,
  "inspector.materials": false,
  "inspector.appearance": false,
  "inspector.properties": false,
  "inspector.collection": false,
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
function initialPins(): Record<string, boolean> {
  try {
    const value = JSON.parse(localStorage.getItem("holobuild.pins.v1") ?? "{}");
    return Object.fromEntries(
      MAJOR_GROUPS.map((key) => [key, value?.[key] === true]),
    );
  } catch {
    return {};
  }
}
function persist(key: string, value: Record<string, boolean>) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Session still works. */
  }
}
export const useAccordionStore = create<{
  open: Record<string, boolean>;
  pinned: Record<string, boolean>;
  togglePin: (key: string) => void;
  setOpen: (key: string, value: boolean) => void;
}>((set) => ({
  open: initial(),
  pinned: initialPins(),
  togglePin(key) {
    if (!MAJOR_GROUPS.includes(key)) return;
    set((state) => {
      const pinned = { ...state.pinned, [key]: !state.pinned[key] };
      persist("holobuild.pins.v1", pinned);
      return { pinned };
    });
  },
  setOpen(key, value) {
    if (!Object.hasOwn(ACCORDION_DEFAULTS, key)) return;
    set((state) => {
      if (state.open[key] === value) return state;
      const open = { ...state.open, [key]: value };
      if (value && MAJOR_GROUPS.includes(key)) {
        for (const other of MAJOR_GROUPS)
          if (other !== key && !state.pinned[other]) open[other] = false;
      }
      try {
        localStorage.setItem("holobuild.accordions.v1", JSON.stringify(open));
      } catch {
        /* Session state still works. */
      }
      return { open };
    });
  },
}));
