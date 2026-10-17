import type { MaterialId } from "./materialPresets";
import type { SceneObject } from "./objectTypes";
export const MATERIAL_DEFAULT_COLORS: Record<MaterialId, string> = {
  solid: "#39dcca",
  glass: "#d9f3ff",
  "matte-plastic": "#39dcca",
  "glossy-plastic": "#39dcca",
  "polished-metal": "#ffffff",
  holographic: "#39dcca",
  wood: "#ffffff",
  brick: "#ffffff",
  concrete: "#ffffff",
};
export const COLOR_SWATCHES = {
  White: "#ffffff",
  Black: "#20252d",
  Red: "#e74c3c",
  Orange: "#ef9345",
  Yellow: "#f5d76e",
  Green: "#4bbf83",
  Cyan: "#39dcca",
  Blue: "#508ee8",
  Purple: "#aa79df",
};
export function normalizeHex(input: string): string | null {
  const hex = input.trim();
  if (/^#[a-f\d]{6}$/i.test(hex)) return hex.toLowerCase();
  if (/^#[a-f\d]{3}$/i.test(hex))
    return (
      "#" +
      [...hex.slice(1)]
        .map((c) => c + c)
        .join("")
        .toLowerCase()
    );
  return null;
}
export function colorPatch(object: SceneObject, color: string, reset = false) {
  const valid = normalizeHex(color);
  if (!valid) throw Error("Enter a valid HEX color.");
  return {
    color: reset ? MATERIAL_DEFAULT_COLORS[object.material] : valid,
    ...(object.model ? { model: { ...object.model, tint: !reset } } : {}),
  };
}
