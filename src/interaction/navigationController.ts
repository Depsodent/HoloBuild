import type { HandsFrame } from "../vision/handRecognizer";
import { handReference } from "./twoHandMath";
import { useAdvancedStore } from "./advancedStore";
import { useInteractionStore } from "./interactionStore";
import { isOnViewport } from "./coordinateMapping";
export interface NavigationGeometry<T> {
  capture: () => T | null;
  pan: (start: T, dx: number, dy: number, sensitivity: number) => boolean;
  restore: (start: T) => void;
}
export class NavigationController<T> {
  private armed: number | null = null;
  private session: {
    id: number;
    start: T;
    origin: { x: number; y: number };
    last: { x: number; y: number };
    time: number;
    sensitivity: number;
  } | null = null;
  constructor(private geometry: NavigationGeometry<T>) {}
  get active() {
    return this.session !== null;
  }
  cancel(message = "Navigation cancelled. Open pinch to rearm.") {
    const wasActive = this.active;
    if (this.session) this.geometry.restore(this.session.start);
    this.session = null;
    this.armed = null;
    if (!wasActive) return;
    useAdvancedStore.setState({ active: false, message });
    useInteractionStore.setState({ phase: "idle" });
  }
  update(frame: HandsFrame) {
    const state = useAdvancedStore.getState();
    if (state.mode !== "navigate" || useInteractionStore.getState().menuOpen) {
      this.armed = null;
      if (this.active) this.cancel();
      return;
    }
    const hand = frame.hands.length === 1 ? frame.hands[0] : undefined;
    if (
      !hand ||
      frame.ambiguous ||
      !hand.gesture.cursor ||
      !isOnViewport(hand.gesture.cursor) ||
      hand.gesture.gesture === "none"
    ) {
      if (this.active || this.armed !== null)
        this.cancel("Navigation requires one clearly tracked hand.");
      return;
    }
    const point = handReference(hand),
      g = hand.gesture;
    if (this.session) {
      const s = this.session;
      if (
        hand.id !== s.id ||
        frame.timestamp - s.time > 250 ||
        Math.hypot(point.x - s.last.x, point.y - s.last.y) > 0.25
      ) {
        this.cancel("Tracking lost or jumped. Camera pan restored.");
        return;
      }
      s.last = point;
      s.time = frame.timestamp;
      if (!g.pinchStable) return;
      if (!g.pinchActive) {
        this.session = null;
        this.armed = null;
        useAdvancedStore.setState({
          active: false,
          message: "Camera pan confirmed. Scene history is unchanged.",
        });
        useInteractionStore.setState({ phase: "idle" });
        return;
      }
      if (
        !this.geometry.pan(
          s.start,
          point.x - s.origin.x,
          point.y - s.origin.y,
          s.sensitivity,
        )
      ) {
        this.cancel("Camera pan exceeds workspace bounds.");
        return;
      }
      useAdvancedStore.setState({
        message: "NAVIGATION ACTIVE · release pinch to finish panning.",
      });
      return;
    }
    if (!g.pinchActive && !g.pinchCandidate && g.pinchStable)
      this.armed = hand.id;
    if (g.pinchActive && g.pinchStable && this.armed === hand.id) {
      this.armed = null;
      const start = this.geometry.capture();
      if (!start) return;
      this.session = {
        id: hand.id,
        start,
        origin: point,
        last: point,
        time: frame.timestamp,
        sensitivity: state.navigationSensitivity,
      };
      useAdvancedStore.setState({
        active: true,
        message: "NAVIGATION ACTIVE · move your pinched hand to pan.",
      });
      useInteractionStore.setState({ phase: "dragging", hoveredId: null });
    }
  }
}
