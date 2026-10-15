import { parseCommand, normalize } from "./parser";
import { execute, undo, redo, type Command } from "../scene/commandManager";
import { useSceneStore } from "../scene/sceneStore";
import type { Vec3 } from "../scene/objectTypes";
import { yawRotation } from "../interaction/twoHandMath";
export interface CommandResult {
  ok: boolean;
  message: string;
  confirmation?: boolean;
}
export class CommandInterpreter {
  get awaitingConfirmation() {
    return this.pending !== null;
  }
  private pending: {
    command: Command;
    objects: ReturnType<typeof useSceneStore.getState>["objects"];
    selected: string | null;
    label: string;
  } | null = null;
  private busy = false;
  constructor(private save: () => Promise<void>) {}
  cancel(): CommandResult {
    this.pending = null;
    return { ok: true, message: "Confirmation cancelled. Scene unchanged." };
  }
  confirm(): CommandResult {
    const p = this.pending;
    this.pending = null;
    if (!p) return { ok: false, message: "No command awaiting confirmation." };
    const s = useSceneStore.getState();
    if (s.objects !== p.objects || s.selectedId !== p.selected || s.preview)
      return {
        ok: false,
        message: "Scene or selection changed. Submit the command again.",
      };
    return this.commit(p.command, p.label);
  }
  private commit(command: Command, message: string): CommandResult {
    return execute(command)
      ? { ok: true, message }
      : { ok: false, message: useSceneStore.getState().status };
  }
  async run(text: string): Promise<CommandResult> {
    if (this.busy)
      return { ok: false, message: "A command is still running. Please wait." };
    if (this.pending)
      return {
        ok: false,
        confirmation: true,
        message:
          "Confirmation required. Confirm or cancel the pending command first.",
      };
    this.busy = true;
    try {
      const intent = parseCommand(text),
        s = useSceneStore.getState();
      if (s.preview)
        throw Error(
          "Release or cancel the active object manipulation before executing a command.",
        );
      switch (intent.type) {
        case "create":
          return this.commit(
            { type: "create", objectType: intent.shape },
            `Created ${intent.shape}.`,
          );
        case "select": {
          const matches =
            intent.target === "last"
              ? s.objects.slice(-1)
              : s.objects.filter(
                  (o) =>
                    normalize(o.name) === intent.target ||
                    o.id.toLowerCase() === intent.target,
                );
          if (matches.length !== 1)
            throw Error(
              matches.length
                ? "Ambiguous object name. Use its exact unique ID from Object Properties."
                : "Object not found. Use its exact name or ID.",
            );
          s.select(matches[0].id);
          return { ok: true, message: `Selected ${matches[0].name}.` };
        }
        case "deselect":
          s.select(null);
          return { ok: true, message: "Selection cleared." };
        case "undo":
          if (!s.past.length) throw Error("Nothing to undo.");
          undo();
          return { ok: true, message: "Undid last action." };
        case "redo":
          if (!s.future.length) throw Error("Nothing to redo.");
          redo();
          return { ok: true, message: "Redid action." };
        case "save":
          await this.save();
          return { ok: true, message: useSceneStore.getState().status };
        case "clear":
          this.pending = {
            command: { type: "reset" },
            objects: s.objects,
            selected: s.selectedId,
            label: "Scene cleared. Undo restores it.",
          };
          return {
            ok: true,
            confirmation: true,
            message: "Confirmation required: clear the entire scene?",
          };
      }
      const o = s.objects.find((o) => o.id === s.selectedId);
      if (!o) throw Error("Selected object required. Select an object first.");
      if (intent.type === "delete") {
        this.pending = {
          command: { type: "delete", id: o.id },
          objects: s.objects,
          selected: s.selectedId,
          label: `Deleted ${o.name}. Undo restores it.`,
        };
        return {
          ok: true,
          confirmation: true,
          message: `Confirmation required: delete ${o.name}?`,
        };
      }
      if (intent.type === "duplicate")
        return this.commit(
          { type: "duplicate", id: o.id },
          `Duplicated ${o.name}.`,
        );
      const patch: Extract<Command, { type: "update" }>["patch"] = {};
      if (intent.type === "move") {
        const delta: Record<string, Vec3> = {
          left: [-1, 0, 0],
          right: [1, 0, 0],
          up: [0, 1, 0],
          down: [0, -1, 0],
          forward: [0, 0, -1],
          forwards: [0, 0, -1],
          back: [0, 0, 1],
          backward: [0, 0, 1],
          backwards: [0, 0, 1],
        };
        patch.position = o.position.map(
          (v, i) => v + delta[intent.direction][i] * intent.amount,
        ) as Vec3;
      } else if (intent.type === "rotate")
        patch.rotation = yawRotation(
          o.rotation,
          (intent.amount * Math.PI) / 180,
        );
      else if (intent.type === "scale") {
        patch.scale = o.scale.map((v) => v * intent.amount) as Vec3;
        if (patch.scale.some((v) => v < 0.1 || v > 20))
          throw Error("Resulting scale must be 0.1–20 on every axis.");
      } else if (intent.type === "color") {
        patch.color = intent.color;
        if (o.model) patch.model = { ...o.model, originalMaterials: false };
      } else if (intent.type === "material") {
        patch.material = intent.material;
        patch.surface = undefined;
        if (o.model) patch.model = { ...o.model, originalMaterials: false };
      } else throw Error("Unsupported command.");
      return this.commit(
        { type: "update", id: o.id, patch },
        `Updated ${o.name}: ${intent.type}.`,
      );
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Command could not complete.",
      };
    } finally {
      this.busy = false;
    }
  }
}
