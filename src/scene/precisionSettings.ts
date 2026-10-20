import { create } from "zustand";
const defaults = { gridStep: 0.5, measurements: false, guides: true };
function saved() {
  try {
    const v = JSON.parse(
      localStorage.getItem("holobuild.precision.v1") || "{}",
    );
    return {
      gridStep: [0.05, 0.1, 0.25, 0.5, 1].includes(v.gridStep)
        ? v.gridStep
        : 0.5,
      measurements:
        typeof v.measurements === "boolean" ? v.measurements : false,
      guides: typeof v.guides === "boolean" ? v.guides : true,
    };
  } catch {
    return defaults;
  }
}
export const usePrecisionSettings = create(() => saved());
export function precisionSettings(patch: Partial<typeof defaults>) {
  const next = { ...usePrecisionSettings.getState(), ...patch };
  if (![0.05, 0.1, 0.25, 0.5, 1].includes(next.gridStep)) return;
  usePrecisionSettings.setState(next);
  try {
    localStorage.setItem("holobuild.precision.v1", JSON.stringify(next));
  } catch {
    /* Optional preference. */
  }
}
