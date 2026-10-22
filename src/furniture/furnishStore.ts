import { releaseLook, requestLook } from "../exploration/pointerLock";
import { cancelDirect } from "../exploration/directManipulation";
import { create } from "zustand";
import { FURNITURE } from "../../shared/furnitureCatalog.mjs";
import { useSceneStore } from "../scene/sceneStore";
import { useViewStore, walkingFeet } from "../exploration/viewStore";
import { createFurniture } from "./factory";
import { furniturePlacement } from "./placement";
import {
  execute,
  executeFurnishing,
  type Command,
} from "../scene/commandManager";
import { navigationWorld, bodyClear } from "../exploration/navigation";
import { useGenerationStore } from "../generation/generationStore";
import { useEditStore } from "../generation/editStore";
import type { SceneObject } from "../scene/objectTypes";
export const useFurnishStore = create(() => ({
  draft: null as SceneObject | null,
  base: null as SceneObject[] | null,
  reposition: false,
  valid: false,
  reason: "Choose furniture, then aim at a support surface.",
  catalog: false,
  selected: null as string | null,
}));
export function beginFurniture(preset: string, existing?: SceneObject) {
  if (
    useGenerationStore.getState().prepared ||
    useEditStore.getState().prepared ||
    useGenerationStore.getState().status === "planning" ||
    useEditStore.getState().status === "planning"
  ) {
    useFurnishStore.setState({
      reason: "Confirm or cancel the pending AI request before furnishing.",
    });
    return false;
  }
  useSceneStore.setState({ preview: null });
  useFurnishStore.setState({
    draft: existing ? structuredClone(existing) : createFurniture(preset),
    base: useSceneStore.getState().objects,
    reposition: !!existing,
    valid: false,
    reason: "Aim at a valid support surface.",
    catalog: false,
  });
  return true;
}
export function updateFurniture(candidate: SceneObject | null) {
  const s = useFurnishStore.getState(),
    objects = useSceneStore.getState().objects;
  if (!s.draft) return;
  if (objects !== s.base) {
    useFurnishStore.setState({
      valid: false,
      reason: "Scene changed; cancel and start a fresh placement.",
    });
    return;
  }
  if (!candidate) {
    if (s.valid || !s.reason.startsWith("Aim"))
      useFurnishStore.setState({
        valid: false,
        reason:
          "Aim at the required floor, tabletop, wall face or ceiling underside.",
      });
    return;
  }
  const check = furniturePlacement(candidate, objects),
    feet = walkingFeet();
  if (
    check.valid &&
    useViewStore.getState().walking &&
    feet &&
    !bodyClear(navigationWorld([candidate]), feet)
  ) {
    check.valid = false;
    check.reason = "Keep clear of your current position; aim farther away.";
  }
  if (
    JSON.stringify(candidate) !== JSON.stringify(s.draft) ||
    check.valid !== s.valid ||
    check.reason !== s.reason
  )
    useFurnishStore.setState({
      draft: candidate,
      valid: check.valid,
      reason: check.reason,
    });
}
export function rotateFurniture(angle: number) {
  const item = useFurnishStore.getState().draft;
  if (item && FURNITURE[item.furniture!.preset].attachment === "wall") return;
  const s = useFurnishStore.getState();
  if (s.draft)
    updateFurniture({
      ...s.draft,
      rotation: [0, s.draft.rotation[1] + angle, 0],
    });
}
export function cancelFurniture() {
  useFurnishStore.setState({
    draft: null,
    base: null,
    valid: false,
    reposition: false,
    reason: "Placement cancelled; scene unchanged.",
  });
}
export function confirmFurniture() {
  const s = useFurnishStore.getState();
  if (!s.draft || !s.valid || !s.base) return false;
  const command: Command = s.reposition
    ? {
        type: "update",
        id: s.draft.id,
        patch: { position: s.draft.position, rotation: s.draft.rotation },
        precise: true,
      }
    : { type: "furniture", object: s.draft };
  const ok = useViewStore.getState().walking
    ? executeFurnishing(command, s.base)
    : s.base === useSceneStore.getState().objects && execute(command);
  if (ok)
    useFurnishStore.setState({
      draft: null,
      base: null,
      valid: false,
      reposition: false,
      selected: s.draft.id,
      reason: "Furniture placed. Exit Walkthrough to use Inspector or Undo.",
    });
  else
    useFurnishStore.setState({
      valid: false,
      reason: useSceneStore.getState().status,
    });
  return ok;
}
export function openFurnish() {
  cancelDirect();
  cancelFurniture();
  releaseLook();
  useViewStore.setState({
    furnishing: true,
    guide: false,
    paused: true,
    looking: false,
    virtual: { forward: 0, right: 0, turn: 0 },
  });
  useFurnishStore.setState({
    catalog: true,
    selected: null,
    reason: "Choose furniture, then aim at a support surface.",
  });
}
export function closeFurnish(resume = true) {
  cancelFurniture();
  useFurnishStore.setState({ catalog: false, selected: null });
  useViewStore.setState({ furnishing: false });
  if (resume && useViewStore.getState().walking) requestLook();
}
