import { execute, undo } from "../scene/commandManager";
import { useAdvancedStore } from "./advancedStore";
import { useSceneStore } from "../scene/sceneStore";
import type { Vec3 } from "../scene/objectTypes";
import { placement } from "./placement";
import { useInteractionStore, type MenuAction } from "./interactionStore";
export function placeObject(id: string, position: Vec3) {
  const s = useSceneStore.getState();
  const object = s.objects.find((o) => o.id === id);
  if (!object) return false;
  const result = placement(object, position, s.objects, s.snap);
  return (
    result.valid &&
    execute({ type: "update", id, patch: { position: result.position } })
  );
}
export function runMenuAction(action: MenuAction) {
  if (
    action === "move" ||
    action === "scale" ||
    action === "rotate" ||
    action === "navigate"
  )
    useAdvancedStore.setState({ mode: action });
  if (action === "create") execute({ type: "create" });
  if (action === "undo") undo();
  useInteractionStore.setState({ menuOpen: false });
}
