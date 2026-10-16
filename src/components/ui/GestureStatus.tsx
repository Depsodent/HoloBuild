import { useGestureStore } from "../../vision/gesturePipeline";
export function GestureStatus() {
  const s = useGestureStore();
  return (
    <div className="gesture-status" aria-label="Gesture recognition status">
      <span>GESTURE</span>
      <strong>
        {s.gesture === "none" ? "No hand" : s.gesture.replace("-", " ")}
      </strong>
      <small>
        {s.cursor ? (s.stable ? "Stable" : "Stabilizing…") : "Show one hand"}
      </small>
    </div>
  );
}
