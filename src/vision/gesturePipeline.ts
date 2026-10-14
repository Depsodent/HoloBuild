import { create } from "zustand";
import { landmarkStream } from "./landmarkStream";
import { LandmarkSmoother } from "./smoothing";
import { GestureDetector } from "./gestureDetector";
import { GESTURE_CONFIG } from "./calibration";
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
  const smooth = new LandmarkSmoother(
    GESTURE_CONFIG.smoothingMs,
    GESTURE_CONFIG.lossGapMs,
  );
  const detector = new GestureDetector();
  let lastUi = 0;
  const unsubscribe = landmarkStream.subscribe((frame) => {
    const start = performance.now();
    const points =
      frame.landmarks.length === 21 &&
      frame.landmarks.every(
        (p) =>
          Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z),
      )
        ? frame.landmarks
        : [];
    const next = detector.update(
      smooth.update(points, frame.timestamp),
      frame.timestamp,
      frame.aspectRatio,
    );
    next.recognitionMs = performance.now() - start;
    const changed = next.gesture !== current.gesture;
    current = next;
    listeners.forEach((fn) => fn(next));
    if (changed || frame.timestamp - lastUi >= 150 || !next.cursor) {
      useGestureStore.setState(next);
      lastUi = frame.timestamp;
    }
  });
  return () => {
    unsubscribe();
    current = empty;
    useGestureStore.setState(empty);
    listeners.forEach((fn) => fn(empty));
  };
}
