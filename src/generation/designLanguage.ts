import type { BuildingTemplate, PlanPart } from "../../shared/planSchema.mjs";
export function normalizeDesignRequest(input: string) {
  return input
    .trim()
    .replace(/[’]/g, "'")
    .replace(/[.!?]+$/g, "")
    .replace(/^(?:please\s+)?(?:can|could|would) you\s+(?:please\s+)?/i, "")
    .replace(/^please\s+/i, "")
    .replace(/^i(?:'d| would) like\s+/i, "Build ")
    .replace(/^i (?:want|need|would like)\s+(?:you to\s+)?/i, "Build ")
    .replace(/\b(?:make|build|create) me\b/i, "Build")
    .replace(/\b(?:home|cottage|residential building)\b/gi, "house")
    .replace(/\btwo[ -]floor\b/gi, "two-story");
}
export const DESIGN_COLORS: Record<string, string> = {
  yellow: "#f5d76e",
  purple: "#aa79df",
  pink: "#f18db5",
  blue: "#508ee8",
  red: "#e74c3c",
  green: "#4bbf83",
  white: "#ffffff",
  black: "#20252d",
  orange: "#ef9345",
  cyan: "#39dcca",
};
export function requestedAppearance(
  input: string,
): NonNullable<BuildingTemplate["appearance"]> {
  const text = input.toLowerCase(),
    out: NonNullable<BuildingTemplate["appearance"]> = {};
  for (const role of [
    "wall",
    "roof",
    "door",
    "window",
    "floor",
  ] as PlanPart["role"][]) {
    const color = Object.keys(DESIGN_COLORS).find(
      (c) =>
        new RegExp(
          "\\b" +
            c +
            "(?:[ -](?:colored|coloured|wooden|wood|exterior|front|glass))*[ -]+" +
            role +
            "s?\\b",
        ).test(text) ||
        new RegExp(
          "\\b" + role + "s?(?:[ ]+(?:to|are|in|is|a|the))*[ ]+" + c + "\\b",
        ).test(text),
    );
    const material = new RegExp(
      "\\bwood(?:en)?(?: front)?[ ]+" +
        role +
        "s?\\b|\\b" +
        role +
        "s?(?: to| is| in| of)* wood\\b",
    ).test(text)
      ? "wood"
      : undefined;
    if (color || material)
      out[role] = {
        ...(color ? { color: DESIGN_COLORS[color] } : {}),
        ...(material ? { material } : {}),
      };
  }
  return out;
}
