import { z } from "zod";
import { objectSchema, type SceneObject } from "./objectTypes";
import { createCube } from "./objectFactory";
import { useSceneStore } from "./sceneStore";
import { appendHistory } from "./historyManager";
const sceneSchema = z
  .array(objectSchema)
  .max(200)
  .refine(
    (objects) => new Set(objects.map((o) => o.id)).size === objects.length,
    "Duplicate object IDs",
  );
export type Command =
  | { type: "create" }
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
    let objects = structuredClone(s.objects);
    let selectedId = s.selectedId;
    if (command.type === "create") {
      const cube = createCube([(objects.length * 1.5) % 9, 0.5, 0]);
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
      if (command.type === "update")
        objects[index] = { ...objects[index], ...command.patch };
      if (command.type === "delete") {
        objects.splice(index, 1);
        if (selectedId === command.id) selectedId = null;
      }
      if (command.type === "duplicate") {
        const original = objects[index];
        const copy = {
          ...original,
          id: crypto.randomUUID(),
          name: original.name + " copy",
          position: [
            original.position[0] + 1.5,
            original.position[1],
            original.position[2],
          ] as SceneObject["position"],
        };
        objects.push(copy);
        selectedId = copy.id;
      }
    }
    objects = sceneSchema.parse(objects);
    if (JSON.stringify(objects) === JSON.stringify(s.objects)) return true;
    useSceneStore.setState({
      objects,
      selectedId,
      past: appendHistory(s.past, s.objects),
      future: [],
      preview: null,
      status: `${command.type[0].toUpperCase() + command.type.slice(1)} complete.`,
    });
    return true;
  } catch {
    useSceneStore.setState({
      status:
        "Action rejected: check selection, bounds (±100), scale (0.1–20), and object limit (200).",
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
      preview: null,
      status: "Redid action.",
    });
}
export { sceneSchema };
