import { FURNITURE } from "../../shared/furnitureCatalog.mjs";
import { useSceneStore, type Preview } from "../scene/sceneStore";
import type { SceneObject, Vec3 } from "../scene/objectTypes";
import { executeWalkthroughTransform } from "../scene/commandManager";
import { groupPreview } from "../interaction/structureInteraction";
import { bounds, placement } from "../interaction/placement";
import { yawRotation } from "../interaction/twoHandMath";
import {
  anchorFurnitureTransform,
  furniturePlacement,
} from "../furniture/placement";
import { bodyClear, navigationWorld } from "./navigation";
import { useViewStore, walkingFeet } from "./viewStore";
const STEP = Math.PI / 12;
let drag: {
  base: SceneObject[];
  object: SceneObject;
  group: string | null;
  mode: string;
  position: Vec3;
  angle: number;
} | null = null;
export function directActive() {
  return !!drag;
}
export function directOriginal() {
  return drag?.object ?? null;
}
export function cancelDirect(message = "Movement cancelled; scene unchanged.") {
  if (!drag) return;
  drag = null;
  useSceneStore.setState({ preview: null });
  useViewStore.setState({ manipulating: false, message });
}
export function beginDirect(id: string) {
  if (!useViewStore.getState().walking) return false;
  cancelDirect();
  const s = useSceneStore.getState();
  s.select(id);
  const object = s.objects.find((o) => o.id === id),
    group = useSceneStore.getState().selectedStructureId;
  if (!object || (object.construction && !group)) {
    useViewStore.setState({
      message:
        "Connected components use their architectural controls. Choose Structure in the editor to move the whole structure.",
    });
    return false;
  }
  drag = {
    base: s.objects,
    object,
    group,
    mode: s.selectionMode,
    position: [...object.position],
    angle: 0,
  };
  useViewStore.setState({
    manipulating: true,
    message:
      "Right-drag to reposition · Left/Right Arrow rotate · release to place · Escape exits.",
  });
  updateDirect(object.position);
  return true;
}
function current() {
  const s = useSceneStore.getState();
  return (
    drag &&
    useViewStore.getState().walking &&
    drag.base === s.objects &&
    drag.object.id === s.selectedId &&
    drag.group === s.selectedStructureId &&
    drag.mode === s.selectionMode
  );
}
export function updateDirect(position: Vec3) {
  if (!drag) return;
  if (!current()) {
    cancelDirect("Scene or selection changed; movement cancelled.");
    return;
  }
  drag.position = [...position];
  const d = drag,
    s = useSceneStore.getState(),
    object = d.object;
  let preview: Preview;
  let next: SceneObject[];
  if (d.group) {
    const delta = position.map((v, i) => v - object.position[i]) as Vec3;
    preview = groupPreview(object.id, {
      type: "batch",
      operations: [
        { type: "rotate", angle: d.angle },
        { type: "move", delta },
      ],
    })!;
    next = [
      ...s.objects.filter((o) => o.construction?.structureId !== d.group),
      ...(preview.structure?.objects ?? []),
    ];
  } else {
    const candidate = anchorFurnitureTransform(object, {
      ...object,
      position: [...position],
      rotation:
        d.angle === 0
          ? [...object.rotation]
          : yawRotation(object.rotation, d.angle),
    });
    if (!object.furniture)
      candidate.position[1] += bounds(object).min.y - bounds(candidate).min.y;
    const result = placement(candidate, candidate.position, s.objects, s.snap);
    preview = {
      id: object.id,
      position: result.position,
      rotation: candidate.rotation,
      valid: result.valid,
    };
    next = s.objects.map((o) =>
      o.id === object.id ? { ...candidate, position: result.position } : o,
    );
  }
  const feet = walkingFeet();
  preview.valid =
    preview.valid &&
    !!feet &&
    bodyClear(navigationWorld(next), feet) &&
    next.every((o) => !o.furniture || furniturePlacement(o, next).valid);
  useSceneStore.setState({ preview });
  useViewStore.setState({
    message: preview.valid
      ? "Valid preview · release right mouse to place · arrows rotate · Escape exits."
      : "Invalid placement: collision, support, access or player clearance. Release cancels.",
  });
}
export function rotateDirect(direction: number) {
  if (!drag) {
    const s = useSceneStore.getState();
    if (!s.selectedId || !beginDirect(s.selectedId)) return false;
    if (!rotateDirect(direction)) {
      cancelDirect();
      return false;
    }
    return commitDirect();
  }
  if (
    drag.object.furniture &&
    FURNITURE[drag.object.furniture.preset].attachment === "wall"
  ) {
    useViewStore.setState({
      message:
        "Wall-mounted furniture must retain its supporting face; reposition it on that face.",
    });
    return false;
  }
  drag.angle += direction * STEP;
  updateDirect(drag.position);
  return true;
}
export function commitDirect() {
  if (!drag) return false;
  if (!current()) {
    cancelDirect();
    return false;
  }
  const d = drag;
  if (d.angle === 0 && d.position.every((v, i) => v === d.object.position[i])) {
    cancelDirect("Position unchanged; no history entry.");
    return true;
  }
  const preview = useSceneStore.getState().preview;
  const ok =
    !!preview?.valid &&
    executeWalkthroughTransform(
      preview.structure
        ? {
            type: "structure",
            structureId: preview.structure.id,
            operation: preview.structure.operation,
            base: d.base,
            snap: useSceneStore.getState().snap,
          }
        : {
            type: "update",
            id: d.object.id,
            patch: { position: preview.position, rotation: preview.rotation },
            precise: true,
          },
      d.base,
    );
  cancelDirect(
    ok
      ? "Object placed. Exit Walkthrough to Undo."
      : "Invalid placement cancelled; scene unchanged.",
  );
  return ok;
}
