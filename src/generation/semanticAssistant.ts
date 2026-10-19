import { selectedParameterScope } from "./parameterScope";
import { balconyOperation } from "../scene/balconyTransform";
import { openingTarget, openingOperation } from "../scene/openingTransform";
import { staircaseOperation } from "../scene/staircaseTransform";
import { assistantPlanSchema } from "../../shared/assistantSchema.mjs";
import {
  plannerRequest,
  plannerStage,
  plannerFailure,
} from "./plannerTransport";
import { beginInterpretation } from "./interpretationRequest";
import { cancelGeneration, useGenerationStore } from "./generationStore";
import {
  cancelEdit,
  editContext,
  requestEdit,
  useEditStore,
  resolveStructure,
  prepareComponentCommand,
} from "./editStore";
import { useSceneStore } from "../scene/sceneStore";
import { offlinePlan, offlinePlanningHint } from "./offline";
import { preparePlan } from "./engine";
import { validateDesignAttributes } from "./designValidation";
import { useConversationStore } from "./conversationStore";
import { objectSchema, type Vec3 } from "../scene/objectTypes";
import { bounds, placement } from "../interaction/placement";
import { yawRotation } from "../interaction/twoHandMath";
import { colorPatch } from "../scene/colors";
import type { PlannerMode } from "./planner";
export async function interpretConversation(
  prompt: string,
  settings: { mode: PlannerMode; model?: string; timeoutMs?: number },
) {
  if (settings.mode === "offline")
    return {
      ok: false,
      message: offlinePlanningHint(prompt),
    };
  cancelGeneration("");
  cancelEdit();
  const controller = beginInterpretation();
  const scene = useSceneStore.getState(),
    base = scene.objects,
    context = editContext();
  let reference: string | undefined;
  useGenerationStore.setState({
    status: "planning",
    retryCount: 0,
    retryReason: null,
    prompt,
    message: "Preparing your request. Scene unchanged.",
  });
  try {
    if (scene.preview) throw Error("Finish the active manipulation first.");
    const data = await plannerRequest(
      "/api/planner/assistant",
      {
        prompt,
        context,
        ...(settings.model ? { model: settings.model } : {}),
        timeoutMs: settings.timeoutMs,
      },
      controller.signal,
    );
    reference = data.requestId;
    if (data.source !== "llm") throw Error("Invalid assistant source.");
    if (controller.signal.aborted) return { ok: false, message: "" };
    const current = useSceneStore.getState();
    if (
      base !== current.objects ||
      scene.selectedId !== current.selectedId ||
      scene.selectionMode !== current.selectionMode ||
      scene.selectedStructureId !== current.selectedStructureId
    )
      throw Error(
        "Scene or selection changed while interpreting. Submit again.",
      );
    const plan = assistantPlanSchema.parse(data.plan);
    plannerStage("Validating");
    if (plan.kind === "create" || plan.kind === "compose") {
      if (/\b(?:hinged|functional door)\b/i.test(prompt))
        throw Error(
          "This design needs unsupported animated or functional doors. I can prepare a supported fixed-panel design if you choose that alternative.",
        );
      const built =
        plan.kind === "compose"
          ? plan.plan
          : offlinePlan(plan.design.kind, plan.design);
      if (
        /\bstairs?\b|\bstaircases?\b/i.test(prompt) &&
        !(
          built.template?.stairs?.length &&
          built.objects.some((o) => o.role === "stair")
        )
      )
        throw Error(
          "No staircase was generated. Choose its destination floor and left/right location; scene unchanged.",
        );
      if (
        /\bbalcon(?:y|ies)\b/i.test(prompt) &&
        !(
          built.template?.balconies?.length &&
          built.objects.some((o) => o.role === "balcony")
        )
      )
        throw Error(
          "No balcony was generated. Specify its floor and facade; scene unchanged.",
        );
      validateDesignAttributes(prompt, built);
      const prepared = preparePlan(built, base);
      useGenerationStore.setState({
        prepared,
        status: "preview",
        source: "llm",
        notice: `${data.provider ?? "LLM"} · ${plan.kind === "compose" ? "validated generated geometry" : "interpreted design"} / ${String(data.model).slice(0, 120)} · validated construction primitives. Fixed panels in segmented openings; no hinges.`,
        message: "Review and confirm this design. Scene unchanged.",
      });
      useConversationStore.setState({ designRequest: prompt, finished: false });
      plannerStage("Preview Ready");
      return {
        ok: true,
        message:
          plan.message +
          " A validated design preview is ready. Confirm to create it; nothing has been applied.",
      };
    }
    useGenerationStore.setState({ status: "idle", message: "" });
    if (plan.kind === "edit") {
      if (plan.scope === "structure") {
        const expected = resolveStructure(undefined, context, prompt);
        if (expected !== plan.target)
          throw Error(
            "Interpreted target differs from the selected structure. Select the intended structure and submit again.",
          );
        if (
          scene.selectionMode === "component" &&
          scene.selectedId &&
          !/\b(?:all|every|whole|entire|structure)\b/i.test(prompt) &&
          !selectedParameterScope(base, scene.selectedId, plan.operation)
        )
          throw Error(
            "A Part is selected. Choose Structure for a group edit, or describe the selected part change.",
          );
        await requestEdit(prompt, settings, plan.operation);
        const result = useEditStore.getState();
        return {
          ok: result.status === "preview",
          message:
            result.status === "preview"
              ? plan.message +
                " A validated modification preview is ready. Confirm to apply."
              : result.message,
        };
      }
      const object = base.find((o) => o.id === scene.selectedId);
      if (scene.selectedStructureId || !object || object.id !== plan.target)
        throw Error(
          "Select the intended Part before requesting this component edit.",
        );
      if (/\b(?:all|every|whole|entire)\b/i.test(prompt))
        throw Error(
          "That request targets a group; choose Structure or clarify the intended component.",
        );
      const op = plan.operation;
      if (op.type === "design" || op.type === "batch") {
        if (!selectedParameterScope(base, object.id, op))
          throw Error(
            "The interpreted Part edit changes unrelated architectural recipes. Select Structure or clarify the selected part change.",
          );
        await requestEdit(prompt, settings, op);
        const result = useEditStore.getState();
        return {
          ok: result.status === "preview",
          message:
            result.status === "preview"
              ? plan.message +
                " Review the selected architectural change before confirming."
              : result.message,
        };
      }
      if (object.construction?.role === "balcony") {
        const operation = balconyOperation(base, object.id, op);
        await requestEdit(prompt, settings, operation);
        const result = useEditStore.getState();
        return {
          ok: result.status === "preview",
          message:
            result.status === "preview"
              ? plan.message +
                " Review the balcony and its access before confirming."
              : result.message,
        };
      }
      if (openingTarget(base, object.id)) {
        const operation = openingOperation(base, object.id, op);
        await requestEdit(prompt, settings, operation);
        const result = useEditStore.getState();
        return {
          ok: result.status === "preview",
          message:
            result.status === "preview"
              ? plan.message +
                " Review the opening and surrounding wall before confirming."
              : result.message,
        };
      }
      const architecturalTemplate =
        object.construction?.structure?.template ??
        object.construction?.structure?.architectureTemplate;
      if (object.construction?.assembly && architecturalTemplate?.stairs) {
        const stairs = architecturalTemplate.stairs;
        const assembly = object.construction.assembly;
        if (
          (op.type === "color" || op.type === "material") &&
          ((op.role && op.role !== "stair") ||
            (op.level !== undefined && op.level !== object.construction.level))
        )
          throw Error("That role/floor does not match the selected staircase.");
        let operation;
        if (op.type === "color" || op.type === "material")
          operation = {
            type: "design" as const,
            stairs: stairs.map((stair) =>
              stair.id === assembly
                ? {
                    ...stair,
                    ...(op.type === "color"
                      ? { color: op.color ?? "#ffffff" }
                      : { material: op.material }),
                  }
                : stair,
            ),
          };
        else operation = staircaseOperation(base, object.id, op);
        await requestEdit(prompt, settings, operation);
        const result = useEditStore.getState();
        return {
          ok: result.status === "preview",
          message:
            result.status === "preview"
              ? plan.message +
                " Review the complete staircase and floor opening before confirming."
              : result.message,
        };
      }

      if (
        (op.type === "color" || op.type === "material") &&
        ((op.role && op.role !== object.construction?.role) ||
          (op.level !== undefined && op.level !== object.construction?.level))
      )
        throw Error(
          "The interpreted role/floor differs from the selected Part. Select the intended component and submit again.",
        );
      const patch: Partial<typeof object> = {};
      if (op.type === "color")
        Object.assign(
          patch,
          colorPatch(object, op.color ?? "#ffffff", !!op.reset),
        );
      else if (op.type === "material") {
        patch.material = op.material;
        patch.surface = undefined;
        if (object.model)
          patch.model = { ...object.model, originalMaterials: false };
      } else if (op.type === "move")
        patch.position = object.position.map((v, i) => v + op.delta[i]) as Vec3;
      else if (op.type === "rotate")
        patch.rotation = yawRotation(object.rotation, op.angle);
      else if (op.type === "scale")
        patch.scale = object.scale.map((v, i) => v * op.factors[i]) as Vec3;
      else
        throw Error(
          "That component operation is not supported. Use a color, material or transform, or choose Structure.",
        );
      const candidate = objectSchema.parse({ ...object, ...patch });
      if (patch.rotation || patch.scale) {
        if (Math.abs(bounds(object).min.y) < 0.01) {
          candidate.position = [...candidate.position];
          candidate.position[1] -= bounds(candidate).min.y;
        }
      }
      if (patch.position || patch.rotation || patch.scale) {
        const result = placement(
          candidate,
          candidate.position,
          base,
          scene.snap,
        );
        if (!result.valid)
          throw Error(
            "That component transform collides or leaves the workspace. Scene unchanged.",
          );
        candidate.position = result.position;
        patch.position = result.position;
      }
      prepareComponentCommand(
        { type: "update", id: object.id, patch },
        base.map((o) => (o.id === object.id ? candidate : o)),
        [candidate],
        plan.message,
      );
      plannerStage("Preview Ready");
      return {
        ok: true,
        message:
          "A validated selected-part preview is ready. Confirm to apply. " +
          plan.message,
      };
    }
    plannerStage("Complete");
    if (plan.kind === "finish")
      useConversationStore.setState({ finished: true });
    return {
      ok: plan.kind !== "clarify",
      message: plan.message + " Your scene is unchanged.",
    };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, message: "" };
    const message =
      error instanceof Error
        ? error.message
        : "Interpretation failed; scene unchanged.";
    const safe =
      reference && !message.includes(reference)
        ? plannerFailure({ error: message, requestId: reference }).message
        : message;
    useGenerationStore.setState({
      status: "error",
      message: safe,
      prepared: null,
    });
    plannerStage("Error");
    return { ok: false, message: safe };
  }
}
