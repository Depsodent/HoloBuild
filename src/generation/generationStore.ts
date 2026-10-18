import { confirmedDesign } from "./conversationStore";
import { plannerPreferences, persistPlanner } from "./plannerPreferences";
import { plannerStage } from "./plannerTransport";
import { cancelEdit, useEditStore } from "./editStore";
import { create } from "zustand";
import { preparePlan, type PreparedPlan } from "./engine";
import { generatePlan, type PlannerMode } from "./planner";
import type { OfflineOptions } from "./offline";
import { execute } from "../scene/commandManager";
import { useSceneStore } from "../scene/sceneStore";
export const useGenerationStore = create(() => ({
  prompt: "",
  mode: "auto" as PlannerMode,
  options: {} as OfflineOptions,
  model: "",
  timeoutMs: plannerPreferences().timeoutMs,
  prepared: null as PreparedPlan | null,
  source: "",
  notice: "",
  status: "idle" as "idle" | "planning" | "preview" | "error" | "complete",
  message: "Generate a plan, review it, then confirm construction.",
  retryCount: 0,
  retryReason: null as "overlap" | "grounding" | "bounds" | null,
  ghost: true,
  lastStructureId: "",
}));
let controller: AbortController | null = null,
  request = 0;
export function cancelGeneration(message = "Plan cancelled. Scene unchanged.") {
  plannerStage("Idle");
  request++;
  controller?.abort();
  controller = null;
  useGenerationStore.setState({
    prepared: null,
    status: "idle",
    message,
    source: "",
    notice: "",
  });
}
export function updateGeneration(patch: {
  prompt?: string;
  mode?: PlannerMode;
  options?: OfflineOptions;
  model?: string;
  timeoutMs?: number;
}) {
  if (patch.timeoutMs !== undefined) {
    if (
      !Number.isInteger(patch.timeoutMs) ||
      patch.timeoutMs < 1000 ||
      patch.timeoutMs > 120000
    )
      return;
    persistPlanner(patch.timeoutMs);
  }
  cancelEdit();
  cancelGeneration("Settings changed. Generate a new preview.");
  useGenerationStore.setState(patch);
}
export function cancelUnconfirmedGeneration() {
  if (
    useEditStore.getState().prepared ||
    useEditStore.getState().status === "planning"
  )
    cancelEdit();
  const s = useGenerationStore.getState();
  if (s.prepared || s.status === "planning") cancelGeneration();
}
export async function planStructure(
  prompt = useGenerationStore.getState().prompt,
  options: {
    retry?: boolean;
    strategy?: "procedural";
    defaults?: OfflineOptions;
  } = {},
) {
  if (useGenerationStore.getState().status === "planning") return;
  const previous = useGenerationStore.getState();
  if (options.retry && (!previous.retryReason || previous.retryCount >= 1))
    return;
  cancelEdit();
  cancelGeneration();
  const version = ++request,
    abort = new AbortController();
  controller = abort;
  useGenerationStore.setState({
    prompt,
    retryCount: options.retry ? previous.retryCount + 1 : 0,
    retryReason: null,
    status: "planning",
    message: "Planning… No scene changes yet.",
  });
  const {
    mode,
    options: offlineOptions,
    model,
    timeoutMs,
  } = useGenerationStore.getState();
  try {
    const result = await generatePlan(
      prompt,
      options.strategy ? "offline" : mode,
      { ...options.defaults, ...offlineOptions },
      {
        ...(model ? { model } : {}),
        timeoutMs,
        ...(options.retry && previous.retryReason
          ? {
              validationFeedback: {
                reason: previous.retryReason,
                attempt: 1 as const,
              },
            }
          : {}),
      },
      abort.signal,
    );
    if (version !== request || abort.signal.aborted) return;
    const prepared = preparePlan(result.plan, useSceneStore.getState().objects);
    plannerStage("Preview Ready");
    useGenerationStore.setState({
      prepared,
      status: "preview",
      source: options.strategy ? "procedural" : result.source,
      notice: options.strategy
        ? "Validated construction primitives. Flat roof and segmented openings; fixed door panel, no hinges or engineering simulation. No provider call."
        : result.notice,
      retryReason: geometryReason(result.notice),
      message:
        "Review the preview. Confirm construction adds one undoable batch.",
    });
  } catch (error) {
    if (version === request && !abort.signal.aborted) {
      plannerStage("Error");
      useGenerationStore.setState({
        prepared: null,
        status: "error",
        retryReason: geometryReason(
          error instanceof Error ? error.message : "",
        ),
        message:
          error instanceof Error
            ? error.message
            : "Planning failed. Scene unchanged.",
      });
    }
  } finally {
    if (version === request) controller = null;
  }
}
export function confirmStructure() {
  const { prepared } = useGenerationStore.getState(),
    s = useSceneStore.getState();
  if (!prepared) return;
  if (s.preview || s.objects !== prepared.base) {
    useGenerationStore.setState({
      message:
        "Scene changed or an object is being manipulated. Regenerate before confirming.",
    });
    return;
  }
  if (
    execute({
      type: "construct",
      objects: prepared.objects,
      contacts: prepared.plan.contacts,
    })
  ) {
    s.setSelectionMode("structure");
    s.select(prepared.objects[0].id);
    confirmedDesign(
      prepared.objects[0].construction!.structureId,
      "Your " + prepared.plan.name + " is ready.",
    );
    plannerStage("Complete");
    useGenerationStore.setState({
      prepared: null,
      status: "complete",
      lastStructureId: prepared.objects[0].construction!.structureId,
      message: `Constructed ${prepared.plan.name} (${prepared.objects.length} parts). One Undo removes the batch.`,
    });
  } else
    useGenerationStore.setState({
      message:
        s.status === "idle"
          ? "Construction rejected. Scene unchanged."
          : useSceneStore.getState().status,
    });
}

function geometryReason(
  message: string,
): "overlap" | "grounding" | "bounds" | null {
  return /Excessive component overlap/.test(message)
    ? "overlap"
    : /below ground|grounded assembly/.test(message)
      ? "grounding"
      : /exceeds 32/.test(message)
        ? "bounds"
        : null;
}
