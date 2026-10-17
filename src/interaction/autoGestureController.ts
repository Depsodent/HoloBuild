import type { HandsFrame } from "../vision/handRecognizer";
import { gestureStream } from "../vision/gesturePipeline";
import type { GestureFrame } from "../vision/gestureTypes";
import type { GestureController } from "./gestureController";
import { TwoHandController } from "./twoHandController";
export class AutoGestureController {
  readonly two: TwoHandController;
  constructor(private one: GestureController) {
    this.two = new TwoHandController(() => one.transfer());
  }
  get active() {
    return this.one.dragging || this.two.active;
  }
  cancel(message = "Gesture canceled. Open pinches and aim again.") {
    this.one.cancel(message);
    this.two.cancel(message);
  }
  update(frame: HandsFrame, primary: GestureFrame = gestureStream.get()) {
    if (frame.ambiguous) {
      this.cancel("Gesture canceled: ambiguous hand identities.");
      return;
    }
    this.two.update(frame);
    if (this.two.active) return;
    // Freeze an existing move while the second hand joins; release still places it normally.
    if (frame.hands.length === 2 && this.one.dragging && primary.pinchActive)
      return;
    this.one.update(primary);
  }
}
