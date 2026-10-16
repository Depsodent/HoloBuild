import { create } from "zustand";
import {
  applyStructure,
  members,
  structureIds,
  structureInfo,
  type StructureResult,
} from "../scene/structures";
import { useSceneStore } from "../scene/sceneStore";
import { execute } from "../scene/commandManager";
import { interpretEdit } from "./editPlanner";
import type { PlannerMode } from "./planner";
import type {
  EditContext,
  StructureOperation,
} from "../../shared/editSchema.mjs";
import type { SceneObject } from "../scene/objectTypes";
interface PreparedEdit {
  result: StructureResult;
  operation: StructureOperation;
  base: SceneObject[];
  selected: string | null;
  selectionMode: "component" | "structure";
  selectedGroup: string | null;
  target: string;
  affected: string[];
}
export const useEditStore = create(() => ({
  prepared: null as PreparedEdit | null,
  status: "idle" as "idle" | "planning" | "preview" | "error" | "complete",
  message: "",
  source: "",
}));
let request = 0,
  controller: AbortController | null = null;
export function cancelEdit() {
  request++;
  controller?.abort();
  controller = null;
  useEditStore.setState({
    prepared: null,
    status: "idle",
    message: "",
    source: "",
  });
}
export function editContext(): EditContext {
  const s = useSceneStore.getState();
  return {
    selected:
      s.selectedStructureId ??
      s.objects.find((o) => o.id === s.selectedId)?.construction?.structureId ??
      null,
    structures: structureIds(s.objects).map((id) => {
      const p = members(s.objects, id),
        info = structureInfo(p);
      return {
        id,
        name: info.name,
        type: info.type,
        count: p.length,
        ...(info.template ? { floors: info.template.floors } : {}),
      };
    }),
  };
}
export function resolveStructure(
  target: string | undefined,
  context: EditContext,
  prompt = "",
) {
  if (target) {
    const matches = context.structures.filter(
      (s) =>
        s.id === target ||
        s.name.toLowerCase() === target.toLowerCase() ||
        s.type.toLowerCase() === target.toLowerCase(),
    );
    if (matches.length === 1) return matches[0].id;
    throw Error(
      "Target is missing or ambiguous. Select the intended structure first.",
    );
  }
  const words = (value: string) =>
    " " +
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim() +
    " ";
  const text = words(prompt);
  const named = context.structures.filter((s) =>
    [s.id, s.name, s.type].some((value) => text.includes(words(value))),
  );
  if (named.length === 1) return named[0].id;
  if (
    context.selected &&
    (!named.length || named.some((s) => s.id === context.selected))
  )
    return context.selected;
  if (context.structures.length === 1) return context.structures[0].id;
  throw Error(
    context.structures.length
      ? "Which structure? Select one or use its unique name/ID."
      : "No generated structure exists. Build one first.",
  );
}
export async function requestEdit(
  prompt: string,
  settings: { mode: PlannerMode; model?: string; timeoutMs?: number },
) {
  cancelEdit();
  const version = ++request,
    abort = new AbortController();
  controller = abort;
  const s = useSceneStore.getState(),
    base = s.objects,
    selected = s.selectedId,
    context = editContext();
  useEditStore.setState({
    status: "planning",
    message: "Interpreting edit. Scene unchanged.",
  });
  try {
    if (s.preview)
      throw Error("Finish the active manipulation before planning an edit.");
    const expectedTarget = resolveStructure(undefined, context, prompt);
    const { plan, source } = await interpretEdit(
      prompt,
      context,
      settings.mode,
      {
        ...(settings.model ? { model: settings.model } : {}),
        timeoutMs: settings.timeoutMs,
      },
      abort.signal,
    );
    if (version !== request || abort.signal.aborted) return;
    if (plan.operation.type === "clarify") throw Error(plan.operation.question);
    if (plan.operation.type === "unsupported")
      throw Error(plan.operation.reason);
    const target = resolveStructure(plan.target, context, prompt);
    if (target !== expectedTarget)
      throw Error(
        "Interpreted target differs from the selected/named structure. Select the intended structure and submit again.",
      );
    if (
      base !== useSceneStore.getState().objects ||
      selected !== useSceneStore.getState().selectedId ||
      s.selectionMode !== useSceneStore.getState().selectionMode ||
      s.selectedStructureId !== useSceneStore.getState().selectedStructureId
    )
      throw Error("Scene/selection changed while interpreting. Submit again.");
    if (plan.operation.type === "select") {
      execute({
        type: "structure",
        structureId: target,
        operation: plan.operation,
      });
      useEditStore.setState({
        status: "complete",
        message: `Selected ${structureInfo(members(base, target)).name}.`,
        source,
      });
      return;
    }
    const result = applyStructure(base, target, plan.operation, s.snap),
      changes = new Map(result.objects.map((o) => [o.id, o]));
    const affected = [
      ...new Set([
        ...base
          .filter(
            (o) =>
              o.construction?.structureId === target &&
              JSON.stringify(o) !== JSON.stringify(changes.get(o.id)),
          )
          .map((o) => o.id),
        ...result.parts
          .filter((o) => !base.some((p) => p.id === o.id))
          .map((o) => o.id),
      ]),
    ];
    useEditStore.setState({
      status: "preview",
      source,
      message: result.summary,
      prepared: {
        result,
        operation: plan.operation,
        base,
        selected,
        selectionMode: s.selectionMode,
        selectedGroup: s.selectedStructureId,
        target,
        affected,
      },
    });
  } catch (error) {
    if (version === request && !abort.signal.aborted)
      useEditStore.setState({
        prepared: null,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Edit failed; scene unchanged.",
      });
  } finally {
    if (version === request) controller = null;
  }
}
export function confirmEdit() {
  const p = useEditStore.getState().prepared,
    s = useSceneStore.getState();
  if (!p) return false;
  if (
    s.preview ||
    s.objects !== p.base ||
    s.selectedId !== p.selected ||
    s.selectionMode !== p.selectionMode ||
    s.selectedStructureId !== p.selectedGroup
  ) {
    useEditStore.setState({
      message: "Scene or selection changed. Request a fresh preview.",
    });
    return false;
  }
  // Reuse the validated exact preview, including freshly allocated duplicate IDs.
  const ok = execute({
    type: "structure",
    structureId: p.target,
    operation: p.operation,
    base: p.base,
    prepared: p.result,
  });
  if (ok)
    useEditStore.setState({
      prepared: null,
      status: "complete",
      message: "Structure edit confirmed. One Undo restores it.",
    });
  return ok;
}
