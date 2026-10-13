import type { GestureFrame } from "../vision/gestureTypes";
import type { Vec3 } from "../scene/objectTypes";
import { useSceneStore } from "../scene/sceneStore";
import { isOnViewport, type Cursor } from "./coordinateMapping";
import { placement } from "./placement";
import { placeObject, runMenuAction } from "./intentMapper";
import { useInteractionStore, type MenuAction } from "./interactionStore";
interface InputGeometry {
  pick: (cursor: Cursor) => string | undefined;
  plane: (cursor: Cursor, height: number) => Vec3 | null;
  menuHit: (cursor: Cursor) => MenuAction | null;
}
export class GestureController {
  private previous = "none";
  private armed = false;
  private grab: { id: string; height: number; offset: Vec3 } | null = null;
  private lastCursor: Cursor | null = null;
  constructor(private geometry: InputGeometry) {}
  get dragging() {
    return this.grab !== null;
  }
  cancel(message = "Tracking lost. Uncommitted movement cancelled.") {
    const wasDragging = this.dragging;
    this.grab = null;
    this.armed = false;
    this.previous = "none";
    this.lastCursor = null;
    if (useSceneStore.getState().preview)
      useSceneStore.setState({ preview: null });
    useInteractionStore.setState({
      phase: "idle",
      hoveredId: null,
      ...(wasDragging ? { message } : {}),
    });
  }
  update(frame: GestureFrame) {
    const cursor = frame.cursor;
    if (!cursor || !isOnViewport(cursor) || frame.gesture === "none") {
      this.cancel(
        frame.cursor && isOnViewport(frame.cursor)
          ? "Gesture tracking restarted. Uncommitted movement cancelled."
          : "Hand lost or outside viewport. Uncommitted movement cancelled.",
      );
      return;
    }
    if (
      this.dragging &&
      this.lastCursor &&
      Math.hypot(cursor.x - this.lastCursor.x, cursor.y - this.lastCursor.y) >
        0.4
    ) {
      this.cancel("Large tracking jump. Movement cancelled; point again.");
      return;
    }
    this.lastCursor = cursor;
    const entered = frame.gesture !== this.previous;
    this.previous = frame.gesture;
    if (this.grab) {
      const preview = useSceneStore.getState().preview;
      if (frame.gesture === "pinch") {
        if (!frame.stable) return;
        const point = this.geometry.plane(cursor, this.grab.height);
        const s = useSceneStore.getState();
        const object = s.objects.find((o) => o.id === this.grab!.id);
        if (!point || !object) {
          this.cancel("No valid construction plane. Movement cancelled.");
          return;
        }
        const pos = point.map((v, i) => v + this.grab!.offset[i]) as Vec3;
        const result = placement(object, pos, s.objects, s.snap);
        useSceneStore.setState({ preview: { id: object.id, ...result } });
        useInteractionStore.setState({
          phase: result.valid ? "dragging" : "invalid",
          message: result.valid
            ? "Release pinch to place · grid snapping active when enabled"
            : "Invalid placement · overlapping, below ground, or beyond ±50 m",
        });
      } else if (frame.stable) {
        const id = this.grab.id;
        this.grab = null;
        this.armed = false;
        const releaseAllowed =
          frame.gesture === "pointing" || frame.gesture === "open-palm";
        const committed =
          releaseAllowed && preview?.valid && placeObject(id, preview.position);
        useSceneStore.setState({ preview: null });
        useInteractionStore.setState({
          phase: "idle",
          hoveredId: null,
          message: committed
            ? "Object placed. One undo restores the previous position."
            : "Placement cancelled. Point and pinch to try again.",
        });
      }
      return;
    }
    if (frame.gesture === "open-palm" && frame.stable && entered) {
      useInteractionStore.setState({
        menuOpen: true,
        hoveredId: null,
        message: "Point and pinch a menu card, or click it.",
      });
      this.armed = false;
      return;
    }
    const menuOpen = useInteractionStore.getState().menuOpen;
    const target = menuOpen ? undefined : this.geometry.pick(cursor);
    if (frame.gesture === "pointing" && frame.stable) {
      this.armed = true;
      useInteractionStore.setState({
        phase: target ? "targeting" : "idle",
        hoveredId: target ?? null,
      });
    }
    if (frame.gesture === "pinch" && frame.stable && entered && this.armed) {
      this.armed = false;
      if (menuOpen) {
        const action = this.geometry.menuHit(cursor);
        if (action) runMenuAction(action);
        return;
      }
      const object = useSceneStore
        .getState()
        .objects.find((o) => o.id === target);
      if (!object) return;
      const point = this.geometry.plane(cursor, object.position[1]);
      if (!point) return;
      // Selection/tool setup precedes the transaction so its own setup cannot
      // look like an external edit to the scene-change cancellation listener.
      useSceneStore.getState().select(object.id);
      useSceneStore.getState().setTool("select");
      this.grab = {
        id: object.id,
        height: object.position[1],
        offset: object.position.map((v, i) => v - point[i]) as Vec3,
      };
      useSceneStore.setState({
        preview: { id: object.id, position: [...object.position], valid: true },
      });
      useInteractionStore.setState({
        phase: "dragging",
        hoveredId: object.id,
        message: "Grabbed. Move your hand, then release pinch to place.",
      });
    }
    if (frame.gesture === "fist" || frame.gesture === "unknown")
      this.armed = false;
  }
}
