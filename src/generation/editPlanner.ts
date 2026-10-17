import { usePlannerProgress } from "./plannerTransport";
import { recordClientValidation } from "./plannerTransport";
import { plannerRequest, plannerStage } from "./plannerTransport";
import { cleanPrompt } from "../../shared/planSchema.mjs";
import {
  editPlanSchema,
  type EditPlan,
  type EditContext,
} from "../../shared/editSchema.mjs";
import type { PlannerMode } from "./planner";
import { MATERIAL_IDS } from "../scene/materialPresets";
export function isStructureEdit(text: string, selectedGroup = false) {
  const t = text.toLowerCase();
  if (/^\s*(?:build|generate|create)\b/.test(t)) return false;
  if (
    /\b(?:add|remove|duplicate|change)\b.*\b(?:another|top|floor height|floor material|storey|story)\b/.test(
      t,
    )
  )
    return true;
  if (
    /\b(?:all|every) walls?\b|\broof\b/.test(t) &&
    /\b(?:change|make|replace|apply)\b/.test(t)
  )
    return true;
  if (
    /\b(?:move|rotate|scale|select|duplicate|ungroup|delete|rename|make|change|replace|add|remove)\b/.test(
      t,
    ) &&
    /\b(?:whole|entire|structure|building|house|tower|office|bridge|shed|warehouse)\b/.test(
      t,
    )
  )
    return true;
  return (
    selectedGroup &&
    /^(?:move|rotate|scale|make|change|apply|duplicate|delete|ungroup|rename|add|remove)\b/.test(
      t.trim(),
    )
  );
}
export function deterministicEdit(input: string): EditPlan {
  const t = cleanPrompt(input)
      .toLowerCase()
      .replace(/[.!?]+$/, ""),
    n = (re: RegExp, def: number) => Number(t.match(re)?.[1] ?? def);
  if (
    /\b(?:and|then|also)\s+(?:move|rotate|scale|delete|remove|duplicate|change|make|add|rename|ungroup)\b/.test(
      t,
    )
  )
    throw Error(
      "Use one structure operation per request; no partial edit was planned.",
    );
  if (!/^rotate\b/.test(t) && /-\d/.test(t))
    throw Error(
      "Use positive amounts and an explicit direction; negative edit parameters are unsupported offline.",
    );
  let operation: EditPlan["operation"];
  if (/^select\b/.test(t)) operation = { type: "select" };
  else if (/\b(?:windows?|doors?|openings?|stairs?|balcon)/.test(t))
    operation = {
      type: "unsupported",
      reason:
        "Opening/stair redesign is not supported by structure editing. Existing segmented openings are preserved; decorative inserts are not functional openings.",
    };
  else if (/\b(?:add|another)\b.*\bfloor\b/.test(t))
    operation = { type: "floors", action: "add" };
  else if (/\bremove\b.*\b(?:top|last) floor\b/.test(t))
    operation = { type: "floors", action: "remove" };
  else if (/\bduplicate\b.*\bfloor\b/.test(t))
    operation = {
      type: "floors",
      action: "duplicate",
      level: n(/floor\s+(\d+)/, 1) - 1,
    };
  else if (/\b(?:floor|storey|story) height\b/.test(t))
    operation = {
      type: "floors",
      action: "height",
      height: n(/(?:to|height)\s+(\d+(?:\.\d+)?)/, NaN),
    };
  else if (/^duplicate\b/.test(t)) operation = { type: "duplicate" };
  else if (/^ungroup\b/.test(t)) operation = { type: "ungroup" };
  else if (/^delete\b/.test(t)) operation = { type: "delete" };
  else if (/^rename\b/.test(t) && /\bto\b/.test(t))
    operation = {
      type: "rename",
      name: input
        .split(/\bto\s+/i)
        .slice(1)
        .join("to ")
        .trim(),
    };
  else if (/^move\b/.test(t)) {
    const words =
      t.match(/\b(left|right|up|down|forward|backward|back)\b/g) ?? [];
    if (words.length !== 1)
      throw Error("Specify one direction and a distance in meters.");
    const directions: Record<string, [number, number, number]> = {
      left: [-1, 0, 0],
      right: [1, 0, 0],
      up: [0, 1, 0],
      down: [0, -1, 0],
      forward: [0, 0, -1],
      backward: [0, 0, 1],
      back: [0, 0, 1],
    };
    operation = {
      type: "move",
      delta: directions[words[0]].map(
        (v) =>
          v *
          n(
            /(?:by|right|left|up|down|forward|backward|back)\s+(\d+(?:\.\d+)?)/,
            1,
          ),
      ) as [number, number, number],
    };
  } else if (/^rotate\b/.test(t)) {
    if (!/\d/.test(t))
      throw Error(
        "Specify a yaw angle in degrees, for example Rotate the house 90 degrees.",
      );
    operation = {
      type: "rotate",
      angle: (n(/(-?\d+(?:\.\d+)?)\s*(?:degrees?|°)/, NaN) * Math.PI) / 180,
    };
  } else if (/\b(?:larger|bigger|smaller|wider|scale)\b/.test(t)) {
    const percent = t.match(/(\d+(?:\.\d+)?)\s*%/),
      multiplier = t.match(/(?:by|factor|scale)\s+(\d+(?:\.\d+)?)/);
    if (!percent && !multiplier && !/wider/.test(t))
      throw Error("Specify a percentage or scale factor.");
    const factor = percent
      ? 1 + (Number(percent[1]) / 100) * (/smaller/.test(t) ? -1 : 1)
      : multiplier
        ? Number(multiplier[1])
        : 1.2;
    operation = {
      type: "scale",
      factors: /wider/.test(t) ? [factor, 1, 1] : [factor, factor, factor],
    };
  } else {
    const material =
      MATERIAL_IDS.find(
        (m) => t.includes(m.replaceAll("-", " ")) || t.includes(m),
      ) ?? (/\bmetal\b/.test(t) ? "polished-metal" : undefined);
    if (!material)
      throw Error(
        "Unsupported offline edit. Choose a supported operation or LLM mode for flexible wording.",
      );
    const role = /\bwall/.test(t)
      ? "wall"
      : /\broof/.test(t)
        ? "roof"
        : /\bfloor/.test(t)
          ? "floor"
          : undefined;
    const level = t.match(/floor\s+(\d+)/);
    operation = {
      type: "material",
      material,
      ...(role ? { role } : {}),
      ...(level ? { level: Number(level[1]) - 1 } : {}),
    };
  }
  return editPlanSchema.parse({ version: 1, operation });
}
export async function interpretEdit(
  input: string,
  context: EditContext,
  mode: PlannerMode,
  settings: { model?: string; timeoutMs?: number },
  signal: AbortSignal,
) {
  const prompt = cleanPrompt(input);
  if (mode === "offline") {
    plannerStage("Validating", "Offline deterministic edit");
    return {
      plan: deterministicEdit(prompt),
      source: "Offline deterministic edit",
    };
  }
  try {
    const data = await plannerRequest(
      "/api/planner/edit",
      { prompt, context, ...settings },
      signal,
    );
    if (data.source !== "llm") throw Error("Invalid edit source.");
    const validating = performance.now();
    const plan = editPlanSchema.parse(data.plan);
    recordClientValidation(validating);
    return {
      plan,
      source: `LLM edit / ${data.provider ?? "Compatible"} / ${String(data.model).slice(0, 120)}`,
    };
  } catch (error) {
    if (signal.aborted || mode === "llm") throw error;
    plannerStage("Validating", "Offline edit fallback");
    usePlannerProgress.setState({ timings: null });
    return {
      plan: deterministicEdit(prompt),
      source: `Offline edit fallback: ${error instanceof Error ? error.message : "LLM unavailable"}`,
    };
  }
}
