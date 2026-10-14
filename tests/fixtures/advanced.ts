import { hand } from "./landmarks";
import type {
  HandsFrame,
  RecognizedHand,
} from "../../src/vision/handRecognizer";
export function recognized(
  id: number,
  x: number,
  pinch: boolean,
  y = 0.45,
): RecognizedHand {
  const p = hand(pinch ? "pinch" : "pointing"),
    index = p[8];
  const landmarks = p.map((q) => ({
    x: 1 - x + (q.x - index.x) * 0.45,
    y: y + (q.y - index.y) * 0.45,
    z: q.z * 0.45,
  }));
  return {
    id,
    landmarks,
    gesture: {
      gesture: pinch ? "pinch" : "pointing",
      candidate: pinch ? "pinch" : "pointing",
      timestamp: 0,
      cursor: { x, y },
      pinchRatio: pinch ? 0.15 : 1,
      pinchActive: pinch,
      pinchCandidate: pinch,
      pinchStable: true,
      stable: true,
      recognitionMs: 0,
    },
  };
}
export const pair = (
  timestamp: number,
  distance: number,
  pinch: boolean,
): HandsFrame => ({
  hands: [
    recognized(1, 0.5 - distance / 2, pinch),
    recognized(2, 0.5 + distance / 2, pinch),
  ],
  timestamp,
  aspectRatio: 1,
  ambiguous: false,
});
