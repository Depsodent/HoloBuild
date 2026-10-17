import { usePlannerProgress } from "./plannerTransport";
import { recordClientValidation } from "./plannerTransport";
import { plannerRequest, plannerStage } from "./plannerTransport";
import {
  cleanPrompt,
  planSchema,
  type ConstructionPlan,
} from "../../shared/planSchema.mjs";
import { offlinePlan, type OfflineOptions } from "./offline";
import { parseCommand } from "../commands/parser";
import { materializePlan } from "./engine";
export type PlannerMode = "auto" | "llm" | "offline";
export interface PlannerStatus {
  configured: boolean;
  models: string[];
  model: string;
  timeoutMs: number;
  provider: string;
  connection: string;
}
export interface PlannerResult {
  plan: ConstructionPlan;
  source: "llm" | "offline";
  notice: string;
}
export function routeInput(input: string): "quick" | "structure" | "clarify" {
  try {
    parseCommand(input);
    return "quick";
  } catch {
    /* Explicit construction verbs only. */
  }
  if (
    /^\s*(?:build|generate)\b/i.test(input) ||
    /^\s*(?:create|add|make)\b.*\b(?:house|room|tower|warehouse|bridge|shed|office|structure|building)\b/i.test(
      input,
    )
  )
    return "structure";
  return "clarify";
}
async function jsonResponse(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Error(
      typeof body.error === "string"
        ? body.error.slice(0, 240)
        : "Planner backend unavailable. Start it or choose Offline.",
    );
  }
  return response.json();
}
export async function plannerStatus(
  check = false,
  signal?: AbortSignal,
): Promise<PlannerStatus> {
  const r = await fetch(
    check ? "/api/planner/connection" : "/api/planner/status",
    {
      method: check ? "POST" : "GET",
      ...(check
        ? { headers: { "Content-Type": "application/json" }, body: "{}" }
        : {}),
      signal,
    },
  );
  const s = await jsonResponse(r);
  if (
    !s ||
    typeof s.configured !== "boolean" ||
    !Array.isArray(s.models) ||
    s.models.some((m: unknown) => typeof m !== "string") ||
    s.models.length > 8 ||
    !Number.isFinite(s.timeoutMs)
  )
    throw Error("Invalid planner status.");
  return s;
}
export async function generatePlan(
  input: string,
  mode: PlannerMode,
  options: OfflineOptions = {},
  settings: { model?: string; timeoutMs?: number } = {},
  signal?: AbortSignal,
): Promise<PlannerResult> {
  const prompt = cleanPrompt(input);
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  if (
    settings.timeoutMs !== undefined &&
    (!Number.isInteger(settings.timeoutMs) ||
      settings.timeoutMs < 1000 ||
      settings.timeoutMs > 120000)
  )
    throw Error("Planner timeout must be 1–120 seconds.");
  if (mode !== "offline") {
    try {
      const result = await plannerRequest(
        "/api/planner/plan",
        { prompt, ...settings },
        signal,
      );
      if (result.source !== "llm") throw Error("Invalid planner source.");
      const validating = performance.now();
      const plan = planSchema.parse(result.plan);
      materializePlan(plan);
      recordClientValidation(validating);
      return {
        plan,
        source: "llm",
        notice: `${result.provider ?? "LLM"} · LLM · ${String(result.model).slice(0, 120)}. Parameter controls apply to Offline only.`,
      };
    } catch (error) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      if (mode === "llm") throw error;
      plannerStage("Validating", "Offline fallback");
      usePlannerProgress.setState({ timings: null });
      const plan = offlinePlan(prompt, options);
      return {
        plan,
        source: "offline",
        notice: `Offline fallback: ${error instanceof Error ? error.message : "LLM unavailable"}. No LLM generated this plan.`,
      };
    }
  }
  plannerStage("Validating", "Offline template");
  return {
    plan: offlinePlan(prompt, options),
    source: "offline",
    notice: "Offline deterministic template. No LLM request made.",
  };
}
