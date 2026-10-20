import { duplicateAssembly } from "../generation/libraryOperations";
import { protectConnectedPart } from "./precision";
import { balconyOperation } from "./balconyTransform";
import { openingTarget, openingOperation } from "./openingTransform";
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
        c.structure.floorLayouts.length !==
          (c.structure.template ?? c.structure.architectureTemplate)?.floors
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
      snap?: boolean;
    }
  | { type: "create"; objectType?: ObjectType; prepared?: SceneObject }
  | { type: "import"; object: SceneObject }
  | { type: "construct"; objects: SceneObject[]; contacts?: [string, string][] }
  | {
      type: "update";
      id: string;
      patch: Partial<Omit<SceneObject, "id" | "type">>;
      precise?: boolean;
    }
  | { type: "delete"; id: string }
  | { type: "duplicate"; id: string; preparedId?: string }
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
    if (command.type === "duplicate") {
      const operation = duplicateAssembly(s.objects, command.id);
      const id = s.objects.find((o) => o.id === command.id)?.construction
        ?.structureId;
      if (operation && id)
        return execute({
          type: "structure",
          structureId: id,
          operation,
          snap: false,
        });
    }
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
          command.snap ?? s.snap,
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
      const selectedAssembly = s.objects.find((o) => o.id === s.selectedId)
        ?.construction?.assembly;
      const selectedOpening = s.selectedId
        ? openingTarget(s.objects, s.selectedId)?.current.id
        : undefined;
      const selectedParameter = selectedAssembly || selectedOpening;
      const parameterOperation = (op: StructureOperation): boolean =>
        op.type === "batch"
          ? op.operations.every(parameterOperation)
          : (op.type === "design" &&
              (op.stairs !== undefined ||
                op.openings !== undefined ||
                op.balconies !== undefined)) ||
            ((op.type === "color" || op.type === "material") &&
              op.opening !== undefined);
      const parameterEdit = parameterOperation(command.operation);
      if (
        s.selectionMode === "component" &&
        selectedParameter &&
        parameterEdit
      ) {
        selectedId =
          result.parts.find((o) => o.id === s.selectedId)?.id ??
          result.parts.find((o) =>
            selectedAssembly
              ? o.construction?.assembly === selectedAssembly
              : o.construction?.opening === selectedOpening,
          )?.id ??
          null;
        selectedStructureId = null;
      }
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
      const cube = command.prepared
        ? objectSchema.parse(command.prepared)
        : createObject(kind, [
            (objects.length * 1.5) % 9,
            SHAPES[kind].size[1] / 2,
            0,
          ]);
      if (
        command.prepared &&
        (cube.type !== kind || cube.construction || cube.model)
      )
        throw Error("Invalid primitive preview.");
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
      const editableOpening = openingTarget(s.objects, command.id);
      if (editableOpening) {
        if (command.type === "duplicate")
          throw Error(
            "Add another window/door on a facade instead of duplicating a loose panel.",
          );
        if (command.type === "delete")
          return execute({
            type: "structure",
            structureId: objects[index].construction!.structureId,
            operation: openingOperation(s.objects, command.id, {
              type: "delete",
            }),
          });
        if (
          command.type === "update" &&
          (command.patch.position ||
            command.patch.rotation ||
            command.patch.scale)
        ) {
          const old = objects[index];
          if (
            command.patch.rotation &&
            [0, 2].some(
              (i) =>
                Math.abs(command.patch.rotation![i] - old.rotation[i]) > 1e-6,
            )
          )
            throw Error("Opening orientation follows its wall.");
          return execute({
            type: "structure",
            structureId: old.construction!.structureId,
            operation: openingOperation(s.objects, old.id, {
              type: "setTransform",
              position: command.patch.position ?? old.position,
              yaw: command.patch.rotation?.[1] ?? old.rotation[1],
              scale: command.patch.scale ?? old.scale,
            }),
          });
        }
      }
      const balconyPart = objects[index];
      if (
        balconyPart.construction?.role === "balcony" &&
        balconyPart.construction.assembly
      ) {
        if (command.type === "duplicate")
          throw Error(
            "Add another balcony with a validated access opening, or duplicate the whole building.",
          );
        if (command.type === "delete")
          return execute({
            type: "structure",
            structureId: balconyPart.construction.structureId,
            operation: balconyOperation(s.objects, command.id, {
              type: "delete",
            }),
          });
        if (command.type === "update") {
          if (command.patch.construction)
            throw Error("Balcony hierarchy is managed by its assembly.");
          const recipe =
            balconyPart.construction.structure?.template ??
            balconyPart.construction.structure?.architectureTemplate;
          const current = recipe?.balconies?.find(
            (b) => b.id === balconyPart.construction!.assembly,
          );
          if (!current) throw Error("Balcony recipe is unavailable.");
          if (
            command.patch.position ||
            command.patch.scale ||
            command.patch.rotation
          ) {
            if (
              command.patch.rotation &&
              [0, 2].some(
                (i) =>
                  Math.abs(
                    command.patch.rotation![i] - balconyPart.rotation[i],
                  ) > 1e-6,
              )
            )
              throw Error("Balcony orientation follows its facade.");
            return execute({
              type: "structure",
              structureId: balconyPart.construction.structureId,
              operation: balconyOperation(s.objects, command.id, {
                type: "setTransform",
                position: command.patch.position ?? balconyPart.position,
                scale: command.patch.scale ?? balconyPart.scale,
                yaw: command.patch.rotation?.[1] ?? balconyPart.rotation[1],
              }),
            });
          }
          if (command.patch.color || command.patch.material)
            return execute({
              type: "structure",
              structureId: balconyPart.construction.structureId,
              operation: {
                type: "design",
                balconies: recipe!.balconies!.map((b) =>
                  b.id === current.id
                    ? {
                        ...b,
                        ...(command.patch.color
                          ? { color: command.patch.color }
                          : {}),
                        ...(command.patch.material
                          ? { material: command.patch.material }
                          : {}),
                      }
                    : b,
                ),
              },
            });
        }
      }
      const assembly =
        objects[index].construction?.role === "balcony"
          ? undefined
          : objects[index].construction?.assembly;
      const stairRecipe =
        objects[index].construction?.structure?.template ??
        objects[index].construction?.structure?.architectureTemplate;
      const protectsFloor =
        objects[index].construction?.role === "floor" &&
        objects.some(
          (o) =>
            o.construction?.structureId ===
              objects[index].construction?.structureId &&
            ["stair", "balcony"].includes(o.construction?.role ?? ""),
        );
      if (
        protectsFloor &&
        (command.type === "delete" ||
          (command.type === "update" &&
            (command.patch.position ||
              command.patch.rotation ||
              command.patch.scale)))
      )
        throw Error(
          "This floor connects an architectural assembly. Edit the building/floor parameters or remove the staircase first.",
        );
      if (
        assembly &&
        !stairRecipe?.stairs?.some((stair) => stair.id === assembly)
      )
        throw Error(
          "Staircase recipe is unavailable. Undo the earlier manual change before editing its components.",
        );
      if (
        assembly &&
        stairRecipe?.stairs?.some((stair) => stair.id === assembly)
      ) {
        if (command.type === "duplicate")
          throw Error(
            "Add another staircase connection or duplicate the building; individual treads cannot be duplicated.",
          );
        if (command.type === "delete")
          return execute({
            type: "structure",
            structureId: objects[index].construction!.structureId,
            operation: {
              type: "design",
              stairs: stairRecipe.stairs.filter(
                (stair) => stair.id !== assembly,
              ),
            },
          });
        if (command.type === "update") {
          if (
            command.patch.position ||
            command.patch.rotation ||
            command.patch.scale ||
            command.patch.construction
          )
            throw Error(
              "Edit the staircase assembly so its steps and floor opening remain connected.",
            );
          if (command.patch.color || command.patch.material)
            return execute({
              type: "structure",
              structureId: objects[index].construction!.structureId,
              operation: {
                type: "design",
                stairs: stairRecipe.stairs.map((stair) =>
                  stair.id === assembly
                    ? {
                        ...stair,
                        ...(command.patch.color
                          ? { color: command.patch.color }
                          : {}),
                        ...(command.patch.material
                          ? { material: command.patch.material }
                          : {}),
                      }
                    : stair,
                ),
              },
            });
        }
      }
      if (command.type === "update") {
        const original = objects[index];
        if (
          command.patch.position ||
          command.patch.rotation ||
          command.patch.scale
        )
          protectConnectedPart(original);
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
            command.precise ? false : s.snap,
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
          id: command.preparedId ?? crypto.randomUUID(),
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
