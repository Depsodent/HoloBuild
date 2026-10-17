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
  mode: "offline" as PlannerMode,
  options: {} as OfflineOptions,
  model: "",
  timeoutMs: plannerPreferences().timeoutMs,
  prepared: null as PreparedPlan | null,
  source: "",
  notice: "",
  status: "idle" as "idle" | "planning" | "preview" | "error" | "complete",
  message: "Generate a plan, review it, then confirm construction.",
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
) {
  if (useGenerationStore.getState().status === "planning") return;
  cancelEdit();
  cancelGeneration();
  const version = ++request,
    abort = new AbortController();
  controller = abort;
  useGenerationStore.setState({
    prompt,
    status: "planning",
    message: "Planning… No scene changes yet.",
  });
  const { mode, options, model, timeoutMs } = useGenerationStore.getState();
  try {
    const result = await generatePlan(
      prompt,
      mode,
      options,
      { ...(model ? { model } : {}), timeoutMs },
      abort.signal,
    );
    if (version !== request || abort.signal.aborted) return;
    const prepared = preparePlan(result.plan, useSceneStore.getState().objects);
    plannerStage("Preview Ready");
    useGenerationStore.setState({
      prepared,
      status: "preview",
      source: result.source,
      notice: result.notice,
      message:
        "Review the preview. Confirm construction adds one undoable batch.",
    });
  } catch (error) {
    if (version === request && !abort.signal.aborted) {
      plannerStage("Error");
      useGenerationStore.setState({
        prepared: null,
        status: "error",
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
