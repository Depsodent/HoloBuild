import { precisionIntent } from "./precisionIntent";
import { openingTarget } from "../scene/openingTransform";
import { refineGenerationPreview } from "./refinePreview";
import { interpretConversation } from "./semanticAssistant";
import { yawRotation } from "../interaction/twoHandMath";
import { colorPatch } from "../scene/colors";
import { conversationIntent, refinementOperation } from "./conversationIntent";
import {
  conversationMessage,
  useConversationStore,
  newConversation,
} from "./conversationStore";
import {
  useGenerationStore,
  planStructure,
  cancelGeneration,
  confirmStructure,
} from "./generationStore";
import {
  useEditStore,
  requestEdit,
  cancelEdit,
  confirmEdit,
  prepareComponentCommand,
} from "./editStore";
import { useSceneStore } from "../scene/sceneStore";
import { members, structureInfo, structureIds } from "../scene/structures";
import { parseCommand, type Intent } from "../commands/parser";
import { deterministicEdit } from "./editPlanner";
import { offlinePlan } from "./offline";
import { materializePlan } from "./engine";
import { DESIGN_COLORS, requestedAppearance } from "./designLanguage";
import { bounds, placement, findFreePosition } from "../interaction/placement";
import { createObject, SHAPES } from "../scene/objectFactory";
import {
  objectSchema,
  type SceneObject,
  type Vec3,
} from "../scene/objectTypes";
import { undo, redo, type Command } from "../scene/commandManager";
import type { PlannerMode } from "./planner";
import type {
  CommandInterpreter,
  CommandResult,
} from "../commands/interpreter";
let busy = false,
  version = 0;
export function cancelAssistantPreview() {
  useConversationStore.setState({
    pendingCreation: false,
    pendingCreationRequest: "",
  });
  version++;
  cancelGeneration();
  cancelEdit();
  conversationMessage(
    "assistant",
    "Preview cancelled. Your existing scene is unchanged.",
  );
}
function activeStructure(input: string) {
  const s = useSceneStore.getState(),
    part = s.objects.find((o) => o.id === s.selectedId);
  const opening = part ? openingTarget(s.objects, part.id) : null;
  const selected =
    s.selectedStructureId ??
    (opening &&
    /^(?:make|move|resize|scale|rotate|remove|delete|change|paint|color|duplicate|put)|\b(?:windows?|doors?|entrance)\b/i.test(
      input,
    )
      ? part?.construction?.structureId
      : null) ??
    (part?.construction?.assembly &&
    (/\bstair|\bbalcon/i.test(input) ||
      /^(?:make|change|move|resize|scale|rotate|remove|delete|paint)\b/i.test(
        input,
      ))
      ? part.construction.structureId
      : null) ??
    (/\b(?:all|every|whole|entire|structure|house|building)\b/i.test(input)
      ? part?.construction?.structureId
      : null);
  if (selected) return selected;
  const current = useConversationStore.getState().target;
  return !s.selectedId &&
    structureIds(s.objects).length === 1 &&
    current &&
    members(s.objects, current).length
    ? current
    : null;
}
export async function dispatchAssistant(
  raw: string,
  settings: { mode: PlannerMode; model?: string; timeoutMs?: number },
  interpreter: CommandInterpreter,
): Promise<CommandResult> {
  if (busy)
    return {
      ok: false,
      message: "A request is running. Wait or cancel it first.",
    };
  busy = true;
  const token = ++version;
  conversationMessage("user", raw);
  const respond = (text: string, ok = true) => {
    if (token === version) conversationMessage("assistant", text);
    return { ok, message: "" };
  };
  try {
    const pendingArchitecture =
      useConversationStore.getState().pendingArchitecture;
    const draftId =
      useGenerationStore.getState().prepared?.objects[0].construction
        ?.structureId;
    if (
      pendingArchitecture &&
      pendingArchitecture.target === (draftId ?? activeStructure(raw)) &&
      /^(?:on |to |the |floor )*(?:left|right|front|back|first|second|third|fourth|fifth|sixth|[1-6])(?:\b|$)/i.test(
        raw,
      )
    )
      raw =
        pendingArchitecture.text +
        " " +
        (/^(first|second|third|fourth|fifth|sixth|[1-6])$/i.test(raw)
          ? raw + " floor"
          : raw);
    else useConversationStore.setState({ pendingArchitecture: null });
    const scene = useSceneStore.getState(),
      group = activeStructure(raw),
      intent = conversationIntent(raw, !!group);
    const primitiveRequest =
      /^(?:create|add|insert|make) (?:a |an )?(?:cube|sphere|cylinder|cone|wall|floor)$/i.test(
        intent.text,
      );
    if (intent.kind === "restart") {
      cancelGeneration();
      cancelEdit();
      newConversation();
      return { ok: true, message: "" };
    }
    if (intent.kind === "cancel") {
      cancelAssistantPreview();
      return { ok: true, message: "" };
    }
    if (intent.kind === "confirm") {
      if (useEditStore.getState().prepared) {
        const ok = confirmEdit();
        return ok
          ? { ok: true, message: "" }
          : respond(useEditStore.getState().message, false);
      }
      if (useGenerationStore.getState().prepared) {
        confirmStructure();
        return useGenerationStore.getState().status === "complete"
          ? { ok: true, message: "" }
          : respond(useGenerationStore.getState().message, false);
      }
      return respond(
        "There is no pending preview. Describe a design or a change.",
        false,
      );
    }
    if (intent.kind === "undo" || intent.kind === "redo") {
      cancelGeneration();
      cancelEdit();
      if (!(intent.kind === "undo" ? scene.past : scene.future).length)
        return respond("Nothing to " + intent.kind + ".", false);
      (intent.kind === "undo" ? undo : redo)();
      return respond(
        intent.kind === "undo"
          ? "Undid the last action. Your other changes are preserved."
          : "Redid the action.",
      );
    }
    const precise = await precisionIntent(raw, settings);
    if (precise) return respond(precise);
    if (intent.kind === "finish") {
      if (
        useGenerationStore.getState().prepared ||
        useEditStore.getState().prepared
      )
        return respond(
          "A preview is still pending. Confirm it or cancel it before finishing.",
          false,
        );
      useConversationStore.setState({ finished: true });
      return respond(
        "Your design is complete. Save your project, or start a new conversation whenever you are ready.",
      );
    }
    if (intent.kind === "explain") {
      if (group) {
        const p = members(scene.objects, group),
          info = structureInfo(p);
        return respond(
          info.name +
            ": " +
            p.length +
            " components" +
            (info.template
              ? ", " +
                info.template.floors +
                " floors, " +
                info.template.windows +
                " windows per floor by default"
              : "") +
            ". This is a visual construction model, not an engineering design.",
        );
      }
      const part = scene.objects.find((o) => o.id === scene.selectedId);
      return respond(
        part
          ? part.name +
              " (" +
              part.type +
              "), color " +
              part.color +
              ", material " +
              part.material +
              ". Select a whole structure for floor and window-layout changes."
          : "Select an object or structure to describe.",
      );
    }
    if (
      intent.kind === "create" &&
      group &&
      settings.mode !== "offline" &&
      /\b(?:same|this|selected|existing) (?:house|building|structure)\b/i.test(
        raw,
      ) &&
      !/^(?:please\s+)?(?:build|create|generate)\b/i.test(raw.trim())
    ) {
      const result = await interpretConversation(raw, settings);
      return respond(result.message, result.ok);
    }
    if (intent.kind === "create") {
      if (/\bbridge support\b/i.test(raw))
        return respond(
          "Would you like one cylinder support, or a complete bridge with a deck and four supports?",
          false,
        );
      cancelEdit();
      let procedural = false;
      const defaults =
        !/\bwindows?\b/i.test(raw) &&
        /\b(?:house|home|cottage|residential)\b/i.test(raw)
          ? { windows: 2 }
          : {};
      if (settings.mode === "auto") {
        try {
          const plan = offlinePlan(raw, {
            ...defaults,
            ...useGenerationStore.getState().options,
          });
          materializePlan(plan);
          procedural = !plan.warnings.some((w) =>
            /unsupported details|pitched|gable/i.test(w),
          );
        } catch {
          /* Flexible requests use the configured planner, never a guessed template. */
        }
      }
      if (
        (settings.mode === "auto" ||
          (settings.mode === "llm" &&
            /\bstairs?\b|\bstaircases?\b|\bbalcon(?:y|ies)\b/i.test(raw))) &&
        !procedural
      ) {
        const result = await interpretConversation(raw, settings);
        return respond(result.message, result.ok);
      }
      useConversationStore.setState({ designRequest: raw, finished: false });
      await planStructure(
        raw,
        procedural ? { strategy: "procedural", defaults } : {},
      );
      const state = useGenerationStore.getState();
      return respond(
        state.prepared
          ? "I have prepared " +
              state.prepared.plan.name +
              " (" +
              state.prepared.objects.length +
              " parts). " +
              (state.source === "procedural"
                ? "Built with validated construction primitives. " +
                  (defaults.windows ? "Default: two windows per floor. " : "")
                : state.source === "offline"
                  ? "This is an Offline template, not a Gemini design. "
                  : "AI-generated and validated. ") +
              "Review the preview, then confirm or request changes."
          : state.message,
        state.status === "preview",
      );
    }
    const draft = useGenerationStore.getState().prepared;
    if (draft) {
      const proposal = refinementOperation(
        intent.text,
        draft.plan.template,
        undefined,
        { layouts: draft.objects[0].construction?.structure?.floorLayouts },
      );
      if (!proposal.operation) {
        if (
          proposal.message &&
          proposal.message.includes("?") &&
          /stair|window|door|entrance|balcony/i.test(raw)
        )
          useConversationStore.setState({
            pendingArchitecture: {
              text: raw,
              target: draft.objects[0].construction!.structureId,
            },
          });
        return respond(
          proposal.message ??
            "Which change should I make to this draft? Specify a floor, opening, material or staircase location.",
          false,
        );
      }
      refineGenerationPreview(proposal.operation);
      useConversationStore.setState({ pendingArchitecture: null });
      return respond(
        "The draft geometry is updated. Review the preview; confirming creates the complete design as one Undo step. " +
          (proposal.message ?? ""),
      );
    }
    if (
      !group &&
      !scene.selectedId &&
      structureIds(scene.objects).length > 0 &&
      /\b(?:whole|entire|structure|house|building|walls|roof|windows|floors)\b/i.test(
        intent.text,
      ) &&
      /^(?:move|change|make|give|add|remove|resize|scale|rotate|delete|replace)\b/i.test(
        intent.text,
      )
    ) {
      let operation;
      try {
        operation = deterministicEdit(intent.text).operation;
      } catch {
        /* Flexible wording is interpreted only after target resolution. */
      }
      await requestEdit(raw, settings, operation);
      const result = useEditStore.getState();
      return respond(
        result.message,
        result.status === "preview" || result.status === "complete",
      );
    }
    if (
      scene.selectedStructureId &&
      /\b(?:this|that|(?:the )?selected) (?:wall|door|window|roof|floor|component)\b/i.test(
        intent.text,
      ) &&
      !/\b(?:all|every|whole|entire)\b/i.test(intent.text)
    )
      return respond(
        "A whole structure is selected. Choose Part and select the intended component, or explicitly ask to change all matching components.",
        false,
      );
    if (
      group &&
      /^resize\b/i.test(intent.text) &&
      !/\d|larger|smaller|wider|narrower/i.test(intent.text)
    )
      return respond(
        "What scale factor or dimensions should I use for this structure? For example, make the entire house 20% larger.",
        false,
      );
    if (
      group &&
      !primitiveRequest &&
      (intent.kind === "refine" ||
        /\broof|walls?|windows?|floors?|entrance\b/i.test(raw))
    ) {
      const selectedOpening = scene.selectedId
        ? openingTarget(scene.objects, scene.selectedId)
        : null;
      const selectedAssembly = scene.objects.find(
        (o) => o.id === scene.selectedId,
      )?.construction?.assembly;
      const whole =
        /\b(?:all|every|whole|entire)\b|\b(?:each|per) floor\b/i.test(raw) ||
        (/\b(?:house|building|structure)\b/i.test(raw) &&
          !/\b(?:window|door|entrance|stair|balcon)/i.test(raw));
      if (
        scene.selectedStructureId !== group &&
        !(selectedOpening && !whole) &&
        !(selectedAssembly && !whole)
      ) {
        scene.setSelectionMode("structure");
        scene.select(members(scene.objects, group)[0].id);
      }
      const info = structureInfo(members(scene.objects, group)),
        proposal = refinementOperation(
          intent.text,
          info.template ?? info.architectureTemplate,
          scene.objects.find((o) => o.id === scene.selectedId)?.construction
            ?.assembly,
          {
            selected: whole ? undefined : selectedOpening?.current.id,
            layouts: info.floorLayouts,
          },
        );
      if (proposal.message && !proposal.operation) {
        if (
          proposal.message.includes("?") &&
          /stair|window|door|entrance|balcony/i.test(raw)
        )
          useConversationStore.setState({
            pendingArchitecture: { text: raw, target: group },
          });
        return respond(proposal.message, false);
      }
      useConversationStore.setState({ pendingArchitecture: null });
      let operation = proposal.operation;
      if (!operation) {
        try {
          operation = deterministicEdit(intent.text).operation;
        } catch {
          /* The configured LLM may interpret flexible supported requests. */
        }
      }
      cancelGeneration("");
      await requestEdit(raw, settings, operation);
      const state = useEditStore.getState();
      return respond(
        state.status === "preview"
          ? "I have prepared changes to " +
              info.name +
              ". " +
              (proposal.message ?? state.message) +
              " Confirm to apply them as one undoable action."
          : state.message,
        state.status === "preview" || state.status === "complete",
      );
    }
    if (
      useConversationStore.getState().pendingCreation &&
      !primitiveRequest &&
      /\b(?:left|right|front|back|facade|offset|floor|stairs?|balcony|width|depth|height|entry|door|roof|material|concrete|wood|flat|defaults|yes)\b/i.test(
        intent.text,
      )
    ) {
      const result = await interpretConversation(raw, settings);
      return respond(result.message, result.ok);
    }
    let quick: Intent;
    const selectedPart = scene.objects.find((o) => o.id === scene.selectedId);
    const requestedRole = intent.text
      .match(/\b(wall|door|window|roof|floor)s?\b/i)?.[1]
      .toLowerCase();
    if (
      selectedPart &&
      !primitiveRequest &&
      requestedRole &&
      !group &&
      selectedPart.construction?.role !== requestedRole &&
      selectedPart.type !== requestedRole
    )
      return respond(
        "The selected part is not that " +
          requestedRole +
          ". Select the intended component or choose Structure for a group change.",
        false,
      );
    const componentText = intent.text.replace(
      /\b(?:(?:the )?selected|this|that|the) (?:wall|door|window|roof|floor|component)\b/gi,
      "the selected object",
    );
    const wider = /\b(?:wider|narrower)\b/i.test(componentText);
    if (
      /^resize\b/i.test(intent.text) &&
      group &&
      !/\d|larger|smaller|wider|narrower/i.test(intent.text)
    )
      return respond(
        "What scale factor or dimension should I use for the selected structure? For example, make the entire house 20% larger.",
        false,
      );
    if (wider && selectedPart && !group) {
      quick = {
        type: "scale",
        amount: /narrower/i.test(componentText) ? 0.8 : 1.2,
      };
    } else
      try {
        quick = parseCommand(componentText);
      } catch {
        const move = componentText.match(
          /^move (?:the selected object|it)(?: to)? (?:the )?(left|right|up|down|forward|backward)$/i,
        );
        if (move && selectedPart)
          quick = {
            type: "move",
            direction: move[1].toLowerCase(),
            amount: 0.25,
          };
        else {
          const color = Object.entries(DESIGN_COLORS).find(([name]) =>
            new RegExp("\\b" + name + "\\b").test(intent.text.toLowerCase()),
          );
          const appearance = selectedPart?.construction?.role
            ? requestedAppearance(intent.text)[selectedPart.construction.role]
            : undefined;
          if (appearance?.material && !color)
            quick = { type: "material", material: appearance.material };
          else if (
            color &&
            scene.selectedId &&
            /^(?:make|change|set|paint|give|apply)\b/i.test(intent.text)
          )
            quick = { type: "color", color: color[1] };
          else {
            const result = await interpretConversation(raw, settings);
            return respond(result.message, result.ok);
          }
        }
      }
    if (["select", "deselect", "save"].includes(quick.type)) {
      const result = await interpreter.run(intent.text);
      return respond(result.message, result.ok);
    }
    if (quick.type === "undo" || quick.type === "redo")
      return respond("Use Undo or Redo to change history.", false);
    cancelGeneration("");
    cancelEdit();
    const fresh = useSceneStore.getState();
    let command: Command,
      parts: SceneObject[],
      objects = fresh.objects;
    if (quick.type === "create") {
      const object = createObject(quick.shape, [
          (objects.length * 1.5) % 9,
          SHAPES[quick.shape].size[1] / 2,
          0,
        ]),
        position = findFreePosition(object, objects);
      if (!position) throw Error("There is no free placement for that shape.");
      object.position = position;
      command = { type: "create", objectType: quick.shape, prepared: object };
      parts = [object];
      objects = [...objects, object];
    } else if (quick.type === "clear") {
      command = { type: "reset" };
      parts = [];
      objects = [];
    } else {
      const original = objects.find((o) => o.id === fresh.selectedId);
      if (!original) throw Error("Select the object to change first.");
      if (quick.type === "delete") {
        command = { type: "delete", id: original.id };
        parts = [];
        objects = objects.filter((o) => o.id !== original.id);
      } else if (quick.type === "duplicate") {
        const copy = {
          ...structuredClone(original),
          id: crypto.randomUUID(),
          name: original.name.slice(0, 55) + " copy",
          position: [
            original.position[0] + 1.5,
            original.position[1],
            original.position[2],
          ] as Vec3,
        };
        delete copy.construction;
        const position = findFreePosition(copy, objects);
        if (!position) throw Error("No free placement for the duplicate.");
        copy.position = position;
        command = { type: "duplicate", id: original.id, preparedId: copy.id };
        parts = [copy];
        objects = [...objects, copy];
      } else {
        const patch: Partial<SceneObject> = {};
        if (quick.type === "color")
          Object.assign(patch, colorPatch(original, quick.color));
        if (quick.type === "material") {
          patch.material = quick.material;
          patch.surface = undefined;
          if (original.model)
            patch.model = { ...original.model, originalMaterials: false };
        }
        if (quick.type === "move") {
          const directions: Record<string, Vec3> = {
            right: [1, 0, 0],
            left: [-1, 0, 0],
            up: [0, 1, 0],
            down: [0, -1, 0],
            forward: [0, 0, -1],
            backward: [0, 0, 1],
            back: [0, 0, 1],
          };
          const delta = directions[quick.direction];
          if (!delta) throw Error("Specify a direction.");
          patch.position = original.position.map(
            (v, i) => v + delta[i] * quick.amount,
          ) as Vec3;
        }
        if (quick.type === "rotate")
          patch.rotation = [
            ...yawRotation(original.rotation, (quick.amount * Math.PI) / 180),
          ];
        if (quick.type === "scale")
          patch.scale = original.scale.map(
            (v, i) => v * (wider && i !== 0 ? 1 : quick.amount),
          ) as Vec3;
        const candidate = objectSchema.parse({ ...original, ...patch });
        if (patch.rotation || patch.scale) {
          if (Math.abs(bounds(original).min.y) < 0.01) {
            candidate.position = [...candidate.position];
            candidate.position[1] -= bounds(candidate).min.y;
          }
        }
        if (patch.position || patch.rotation || patch.scale) {
          const valid = placement(
            candidate,
            candidate.position,
            objects,
            fresh.snap,
          );
          if (!valid.valid)
            throw Error(
              "That transform would collide or leave the workspace. Scene unchanged. For a door/window in a segmented opening, select Structure and request an entrance or window-layout change so its opening is rebuilt safely.",
            );
          candidate.position = valid.position;
        }
        command = {
          type: "update",
          id: original.id,
          patch: {
            ...patch,
            ...(patch.position || patch.rotation || patch.scale
              ? { position: candidate.position }
              : {}),
          },
        };
        parts = [candidate];
        objects = objects.map((o) => (o.id === candidate.id ? candidate : o));
      }
    }
    prepareComponentCommand(
      command,
      objects,
      parts,
      "Preview selected component changes. Confirm to apply; Cancel leaves your scene unchanged.",
    );
    return respond(
      "I have prepared the selected component change. Review and confirm it." +
        (quick.type === "move" && !/\d/.test(intent.text)
          ? " Default move: 0.25m."
          : wider
            ? " Default width change: 20% on its local X axis."
            : ""),
    );
  } catch (error) {
    return respond(
      error instanceof Error
        ? error.message
        : "The request could not be completed; your scene is unchanged.",
      false,
    );
  } finally {
    busy = false;
  }
}
