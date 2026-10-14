import { create } from "zustand";
import { landmarkStream } from "./landmarkStream";
import { HandRecognizer } from "./handRecognizer";
import { handsStream, useHandsStore } from "./handsStream";
import type { GestureFrame } from "./gestureTypes";
const empty: GestureFrame = {
  gesture: "none",
  candidate: "none",
  timestamp: 0,
  cursor: null,
  pinchRatio: null,
  pinchActive: false,
  pinchCandidate: false,
  pinchStable: false,
  stable: false,
  recognitionMs: 0,
};
let current = empty;
const listeners = new Set<(frame: GestureFrame) => void>();
export const gestureStream = {
  get: () => current,
  subscribe(fn: (frame: GestureFrame) => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
export const useGestureStore = create<GestureFrame>(() => empty);
export function startGesturePipeline() {
  const recognizer = new HandRecognizer();
  let primary: number | undefined;
  let lastUi = 0;
  const unsubscribe = landmarkStream.subscribe((frame) => {
    const start = performance.now();
    const result = recognizer.update(
      frame.hands ?? [{ landmarks: frame.landmarks }],
      frame.timestamp,
      frame.aspectRatio,
    );
    const previousPrimary = primary;
    if (!result.hands.some((h) => h.id === primary))
      primary = result.hands[0]?.id;
    const hand = result.hands.find((h) => h.id === primary);
    const next =
      result.ambiguous ||
      (previousPrimary !== undefined && primary !== previousPrimary)
        ? { ...empty, timestamp: frame.timestamp }
        : (hand?.gesture ?? { ...empty, timestamp: frame.timestamp });
    next.recognitionMs = performance.now() - start;
    const changed = next.gesture !== current.gesture;
    current = next;
    listeners.forEach((fn) => fn(next));
    handsStream.publish(result);
    if (changed || frame.timestamp - lastUi >= 150 || !next.cursor) {
      useGestureStore.setState(next);
      useHandsStore.setState(result);
      lastUi = frame.timestamp;
    }
  });
  return () => {
    unsubscribe();
    current = empty;
    useGestureStore.setState(empty);
    const lost = { hands: [], timestamp: 0, aspectRatio: 1, ambiguous: false };
    handsStream.publish(lost);
    useHandsStore.setState(lost);
    listeners.forEach((fn) => fn(empty));
  };
}
