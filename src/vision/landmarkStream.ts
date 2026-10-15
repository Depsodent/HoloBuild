export interface Landmark {
  x: number;
  y: number;
  z: number;
}
export interface TrackingFrame {
  hands?: import("./handRecognizer").HandInput[];
  landmarks: Landmark[];
  timestamp: number;
  inferenceMs: number;
  aspectRatio?: number;
  source?: "camera";
  captureTime?: number;
}
type Listener = (frame: TrackingFrame) => void;
const listeners = new Set<Listener>();
// High-frequency tracking data never goes through React or persisted scene state.
let latest: TrackingFrame = { landmarks: [], timestamp: 0, inferenceMs: 0 };
export const landmarkStream = {
  get: () => latest,
  publish(frame: TrackingFrame) {
    latest = frame;
    listeners.forEach((listener) => listener(frame));
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
