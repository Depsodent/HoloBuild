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
  blocked?: (cursor: Cursor) => boolean;
}
export class GestureController {
  private previousPinch = false;
  private armed = false;
  private aim: { id: string; cursor: Cursor; time: number } | null = null;
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
    this.aim = null;
    this.previousPinch = false;
    this.lastCursor = null;
    if (useSceneStore.getState().preview)
      useSceneStore.setState({ preview: null });
    useInteractionStore.setState({
      phase: "idle",
      hoveredId: null,
      rayTarget: null,
      rejection: message,
      ...(wasDragging ? { message } : {}),
    });
  }
  update(frame: GestureFrame) {
    const cursor = frame.cursor;
    if (!cursor || !isOnViewport(cursor) || frame.gesture === "none") {
      this.cancel(
        "Hand lost, outside viewport, or tracking restarting. Open pinch and aim again.",
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
    const entered = frame.pinchActive && !this.previousPinch;
    this.previousPinch = frame.pinchActive;
    const menuOpen = useInteractionStore.getState().menuOpen;
    const blocked = !menuOpen && this.geometry.blocked?.(cursor);
    const rayTarget =
      blocked || menuOpen ? undefined : this.geometry.pick(cursor);
    useInteractionStore.setState({ rayTarget: rayTarget ?? null });
    if (this.grab) {
      if (blocked || menuOpen) {
        this.cancel("Interface covers the cursor. Movement cancelled.");
        return;
      }
      const preview = useSceneStore.getState().preview;
      // Binary pinch debouncing is independent of the other fingers' pose.
      // Freeze the last preview during release so opening the fingers cannot
      // nudge the final placement.
      if (!frame.pinchStable) return;
      if (frame.pinchActive) {
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
          rejection: result.valid
            ? "none"
            : "Placement overlaps, is below ground, or exceeds ±50 m.",
          message: result.valid
            ? "Release pinch to place · grid snapping active when enabled"
            : "Invalid placement · overlapping, below ground, or beyond ±50 m",
        });
      } else {
        const id = this.grab.id;
        this.grab = null;
        this.armed = false;
        this.aim = null;
        const committed =
          frame.candidate !== "fist" &&
          preview?.valid &&
          placeObject(id, preview.position);
        useSceneStore.setState({ preview: null });
        useInteractionStore.setState({
          phase: "idle",
          hoveredId: null,
          rejection: committed ? "none" : "Cancelled or unchanged placement.",
          message: committed
            ? "Object placed. One undo restores the previous position."
            : "Placement cancelled or unchanged. Open pinch and aim to try again.",
        });
      }
      return;
    }
    if (blocked) {
      this.armed = false;
      this.aim = null;
      useInteractionStore.setState({
        phase: "idle",
        hoveredId: null,
        rejection: "Cursor is over the interface.",
      });
      return;
    }
    // An open pinch is the arming condition. Relaxed middle/ring fingers must
    // not disarm a valid aim during thumb/index closure.
    if (!frame.pinchCandidate && !frame.pinchActive && frame.pinchStable) {
      this.armed = frame.candidate !== "fist";
      if (rayTarget && this.armed)
        this.aim = {
          id: rayTarget,
          cursor: { ...cursor },
          time: frame.timestamp,
        };
      useInteractionStore.setState({
        phase: rayTarget && this.armed ? "targeting" : "idle",
        hoveredId: this.armed ? (rayTarget ?? null) : null,
        rejection:
          rayTarget && this.armed
            ? "none"
            : "Aim at a cube with thumb and index apart.",
      });
    }
    if (entered && frame.pinchStable) {
      if (!this.armed) {
        useInteractionStore.setState({
          rejection: "Open pinch before grabbing again.",
        });
        return;
      }
      this.armed = false;
      if (menuOpen) {
        const action = this.geometry.menuHit(cursor);
        if (action) runMenuAction(action);
        useInteractionStore.setState({
          rejection: action ? "none" : "No menu card under cursor.",
        });
        this.aim = null;
        return;
      }
      // A bounded recent real ray hit tolerates fingertip drift while closing.
      // Prefer that intended target over a neighbouring cube hit mid-closure.
      const recent =
        this.aim &&
        frame.timestamp - this.aim.time <= 500 &&
        Math.hypot(
          cursor.x - this.aim.cursor.x,
          cursor.y - this.aim.cursor.y,
        ) <= 0.08;
      const target = recent ? this.aim!.id : rayTarget;
      this.aim = null;
      const object = useSceneStore
        .getState()
        .objects.find((o) => o.id === target);
      if (!object) {
        useInteractionStore.setState({
          rejection:
            "Ray missed: aim at the cube, then close pinch without moving away.",
        });
        return;
      }
      const point = this.geometry.plane(cursor, object.position[1]);
      if (!point) {
        useInteractionStore.setState({
          rejection: "Ray does not intersect the construction plane.",
        });
        return;
      }
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
        rejection: "none",
        message: "Grabbed. Move your hand, then release pinch to place.",
      });
    }
  }
}
