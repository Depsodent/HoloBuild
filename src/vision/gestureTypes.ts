export type Gesture =
  "none" | "pointing" | "pinch" | "open-palm" | "fist" | "unknown";
export interface GestureFrame {
  gesture: Gesture;
  candidate: Gesture;
  timestamp: number;
  cursor: { x: number; y: number } | null;
  pinchRatio: number | null;
  pinchActive: boolean;
  pinchCandidate: boolean;
  pinchStable: boolean;
  stable: boolean;
  recognitionMs: number;
}
