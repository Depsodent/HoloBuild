import type { HandsFrame } from "../vision/handRecognizer";
import { useAdvancedStore } from "./advancedStore";
import { useInteractionStore } from "./interactionStore";
export class GestureMenuController {
  private ready = true;
  private hold: number | null = null;
  private neutral: number | null = null;
  private lastManipulation = -Infinity;
  private lastMenu = -Infinity;
  private wasActive = false;
  private wasOpen = false;
  private lastFrame: number | null = null;
  suppress(timestamp: number) {
    this.ready = false;
    this.hold = null;
    this.neutral = null;
    this.lastManipulation = timestamp;
    this.lastFrame = timestamp;
    this.wasActive = false;
  }
  update(frame: HandsFrame) {
    const i = useInteractionStore.getState(),
      a = useAdvancedStore.getState(),
      now = frame.timestamp;
    if (this.lastFrame !== null && now - this.lastFrame > 250) {
      this.hold = null;
      this.neutral = null;
    }
    this.lastFrame = now;
    const active = a.active || i.phase === "dragging" || i.phase === "invalid";
    if (active || this.wasActive) {
      this.lastManipulation = now;
      this.ready = false;
      this.hold = null;
      this.neutral = null;
    }
    this.wasActive = active;
    if (i.menuOpen !== this.wasOpen) {
      this.lastMenu = now;
      this.ready = false;
      this.hold = null;
    }
    this.wasOpen = i.menuOpen;
    if (!a.menuEnabled || active || i.menuOpen || frame.ambiguous) {
      this.hold = null;
      return;
    }
    const primary = frame.hands.length === 1 ? frame.hands[0].gesture : null;
    const palm =
      primary?.gesture === "open-palm" &&
      primary.candidate === "open-palm" &&
      primary.stable &&
      !primary.pinchActive &&
      !primary.pinchCandidate;
    // Pinch release alone (even an indefinitely held palm) cannot rearm.
    const neutral =
      !frame.hands.length ||
      (primary?.gesture === "pointing" &&
        primary.stable &&
        !primary.pinchActive &&
        !primary.pinchCandidate);
    if (
      neutral &&
      now - this.lastManipulation >= 2000 &&
      now - this.lastMenu >= 4000
    ) {
      this.neutral ??= now;
      if (now - this.neutral >= 500) this.ready = true;
    } else this.neutral = null;
    if (
      !palm ||
      !this.ready ||
      now - this.lastManipulation < 2000 ||
      now - this.lastMenu < 4000
    ) {
      this.hold = null;
      return;
    }
    this.hold ??= now;
    if (now - this.hold >= 1200) {
      this.ready = false;
      this.lastMenu = now;
      this.wasOpen = true;
      this.hold = null;
      useInteractionStore.setState({
        menuOpen: true,
        message: "Point and pinch a tool card to confirm.",
      });
    }
  }
}
