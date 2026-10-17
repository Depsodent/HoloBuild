import {
  applyStructure,
  invalidateTemplate,
  validateStructure,
  type StructureResult,
} from "./structures";
import type { StructureOperation } from "../../shared/editSchema.mjs";
import { z } from "zod";
import { objectSchema, type SceneObject, type ObjectType } from "./objectTypes";
import { createObject, SHAPES } from "./objectFactory";
import { useSceneStore } from "./sceneStore";
import { appendHistory } from "./historyManager";
import { bounds, placement, findFreePosition } from "../interaction/placement";
import { validateBatch } from "../generation/engine";
const sceneSchema = z
  .array(objectSchema)
  .max(200)
  .refine(
    (objects) => new Set(objects.map((o) => o.id)).size === objects.length,
    "Duplicate object IDs",
  )
  .superRefine((objects, ctx) => {
    const groups = new Map<string, { parts: Set<string>; metadata: string }>();
    for (const o of objects) {
      const c = o.construction;
      if (!c) continue;
      const metadata = JSON.stringify(c.structure),
        group = groups.get(c.structureId);
      if (group && (group.parts.has(c.partId) || group.metadata !== metadata))
        ctx.addIssue({
          code: "custom",
          message:
            "Duplicate part identity or inconsistent structure metadata.",
        });
      if (
        c.structure?.floorLayouts &&
        c.structure.floorLayouts.length !== c.structure.template?.floors
      )
        ctx.addIssue({
          code: "custom",
          message: "Floor relationship metadata is inconsistent.",
        });
      if (group) group.parts.add(c.partId);
      else groups.set(c.structureId, { parts: new Set([c.partId]), metadata });
    }
  });
export type Command =
  | {
      type: "structure";
      structureId: string;
      operation: StructureOperation;
      base?: SceneObject[];
      prepared?: StructureResult;
    }
  | { type: "create"; objectType?: ObjectType }
  | { type: "import"; object: SceneObject }
  | { type: "construct"; objects: SceneObject[]; contacts?: [string, string][] }
  | {
      type: "update";
      id: string;
      patch: Partial<Omit<SceneObject, "id" | "type">>;
    }
  | { type: "delete" | "duplicate"; id: string }
  | { type: "reset" }
  | { type: "replace"; objects: SceneObject[] };
export function execute(command: Command): boolean {
  const s = useSceneStore.getState();
  try {
    if (
      (command.type === "delete" || command.type === "duplicate") &&
      s.selectedStructureId &&
      s.objects.find((o) => o.id === command.id)?.construction?.structureId ===
        s.selectedStructureId
    )
      return execute({
        type: "structure",
        structureId: s.selectedStructureId,
        operation: { type: command.type },
      });
    let objects = structuredClone(s.objects);
    let selectedId = s.selectedId;
    let selectedStructureId = s.selectedStructureId;
    if (command.type === "structure") {
      if (command.base && command.base !== s.objects)
        throw Error("Scene changed. Review a new preview.");
      const result =
        command.prepared ??
        applyStructure(
          s.objects,
          command.structureId,
          command.operation,
          s.snap,
        );
      if (command.prepared) {
        if (!command.base || command.base !== s.objects)
          throw Error("Stale structure preview.");
        const originalIds = new Set(
          s.objects
            .filter((o) => o.construction?.structureId === command.structureId)
            .map((o) => o.id),
        );
        const untouched = s.objects.filter((o) => !originalIds.has(o.id));
        if (
          command.operation.type !== "delete" &&
          command.operation.type !== "ungroup"
        )
          validateStructure(
            result.parts,
            command.operation.type === "duplicate" ? s.objects : untouched,
          );
        if (
          untouched.some(
            (o) =>
              JSON.stringify(result.objects.find((p) => p.id === o.id)) !==
              JSON.stringify(o),
          )
        )
          throw Error("Edit touches unrelated objects.");
      }
      objects = result.objects;
      selectedId = result.parts[0]?.id ?? null;
      selectedStructureId =
        command.operation.type === "ungroup" ||
        command.operation.type === "delete"
          ? null
          : result.structureId;
      if (command.operation.type === "select") {
        useSceneStore.setState({
          selectedId,
          selectedStructureId,
          selectionMode: "structure",
          preview: null,
        });
        return true;
      }
    } else if (command.type === "construct") {
      if (s.preview) throw Error("Finish the active manipulation first.");
      const batch = validateBatch(command.objects, objects, command.contacts);
      objects.push(...batch);
      selectedId = batch[0].id;
    } else if (command.type === "import") {
      const model = objectSchema.parse(command.object);
      if (model.type !== "model") throw Error("Expected model");
      const free = findFreePosition(model, objects);
      if (!free) throw Error("No free placement");
      model.position = free;
      objects.push(model);
      selectedId = model.id;
    } else if (command.type === "create") {
      const kind = command.objectType ?? "cube";
      const cube = createObject(kind, [
        (objects.length * 1.5) % 9,
        SHAPES[kind].size[1] / 2,
        0,
      ]);
      const free = findFreePosition(cube, objects);
      if (!free) throw Error("No free placement");
      cube.position = free;
      objects.push(cube);
      selectedId = cube.id;
    } else if (command.type === "reset") {
      objects = [];
      selectedId = null;
    } else if (command.type === "replace") {
      objects = command.objects;
      selectedId = null;
    } else {
      const index = objects.findIndex((o) => o.id === command.id);
      if (index < 0) throw new Error("Select an existing object first.");
      if (command.type === "update") {
        const original = objects[index];
        const candidate = objectSchema.parse({ ...original, ...command.patch });
        if (
          command.patch.position ||
          command.patch.rotation ||
          command.patch.scale
        ) {
          // Keep grounded objects grounded when rotating/scaling in place.
          if (
            (command.patch.rotation || command.patch.scale) &&
            candidate.position[1] === original.position[1] &&
            Math.abs(bounds(original).min.y) < 0.01
          ) {
            candidate.position = [...candidate.position];
            candidate.position[1] -= bounds(candidate).min.y;
          }
          const result = placement(
            candidate,
            candidate.position,
            objects,
            s.snap,
          );
          if (!result.valid) throw Error("Invalid placement");
          candidate.position = result.position;
        }
        objects[index] = candidate;
        if (
          command.patch.position ||
          command.patch.rotation ||
          command.patch.scale ||
          command.patch.construction
        )
          objects = invalidateTemplate(
            objects,
            original.construction?.structureId,
          );
      }
      if (command.type === "delete") {
        const group = objects[index].construction?.structureId;
        objects.splice(index, 1);
        objects = invalidateTemplate(objects, group);
        if (selectedId === command.id) selectedId = null;
      }
      if (command.type === "duplicate") {
        const original = objects[index];
        const copy = {
          ...original,
          id: crypto.randomUUID(),
          name: original.name.slice(0, 55) + " copy",
          position: [
            original.position[0] + 1.5,
            original.position[1],
            original.position[2],
          ] as SceneObject["position"],
        };
        const free = findFreePosition(copy, objects);
        if (!free) throw Error("No free placement");
        copy.position = free;
        delete copy.construction;
        objects.push(copy);
        selectedId = copy.id;
      }
    }
    objects = sceneSchema.parse(objects);
    const originals = new Map(s.objects.map((o) => [o.id, o]));
    objects = objects.map((o) => {
      const old = originals.get(o.id);
      return old && JSON.stringify(old) === JSON.stringify(o) ? old : o;
    });
    if (command.type !== "structure") selectedStructureId = null;
    if (JSON.stringify(objects) === JSON.stringify(s.objects)) return true;
    useSceneStore.setState({
      objects,
      selectedId,
      selectedStructureId,
      selectionMode: selectedStructureId ? "structure" : s.selectionMode,
      past: appendHistory(s.past, s.objects),
      future: [],
      preview: null,
      status: `${command.type[0].toUpperCase() + command.type.slice(1)} complete.`,
    });
    return true;
  } catch (error) {
    useSceneStore.setState({
      status:
        error instanceof Error
          ? `Action rejected: ${error.message.slice(0, 240)}`
          : "Action rejected: invalid placement or scene limits.",
    });
    return false;
  }
}
export function undo() {
  const s = useSceneStore.getState();
  const objects = s.past.at(-1);
  if (objects)
    useSceneStore.setState({
      objects,
      past: s.past.slice(0, -1),
      future: [s.objects, ...s.future],
      selectedId: null,
      selectedStructureId: null,
      preview: null,
      status: "Undid last action.",
    });
}
export function redo() {
  const s = useSceneStore.getState();
  const objects = s.future[0];
  if (objects)
    useSceneStore.setState({
      objects,
      past: appendHistory(s.past, s.objects),
      future: s.future.slice(1),
      selectedId: null,
      selectedStructureId: null,
      preview: null,
      status: "Redid action.",
    });
}
export { sceneSchema };
