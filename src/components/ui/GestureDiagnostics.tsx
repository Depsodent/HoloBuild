import { useGestureStore } from "../../vision/gesturePipeline";
import { useInteractionStore } from "../../interaction/interactionStore";
import { useTrackingStore } from "../../vision/trackingStore";
import { GESTURE_CONFIG } from "../../vision/calibration";
export function GestureDiagnostics() {
  const g = useGestureStore();
  const i = useInteractionStore();
  const t = useTrackingStore();
  return (
    <details className="gesture-diagnostics">
      <summary>Gesture diagnostics</summary>
      <dl>
        <dt>Gesture / candidate</dt>
        <dd>
          {g.gesture} / {g.candidate}
        </dd>
        <dt>Pinch distance</dt>
        <dd>{g.pinchRatio?.toFixed(3) ?? "unavailable"}</dd>
        <dt>Activate / release</dt>
        <dd>
          {GESTURE_CONFIG.pinchOn.toFixed(2)} /{" "}
          {GESTURE_CONFIG.pinchOff.toFixed(2)}
        </dd>
        <dt>Pinch state</dt>
        <dd>
          {g.pinchActive ? "active" : "inactive"}
          {g.pinchStable ? " · stable" : " · debouncing"}
        </dd>
        <dt>Threshold latch</dt>
        <dd>{g.pinchCandidate ? "closed" : "open"}</dd>
        <dt>Targeted object</dt>
        <dd>{i.hoveredId ?? "none"}</dd>
        <dt>Selectable ray hit</dt>
        <dd>{i.rayTarget ?? "none"}</dd>
        <dt>Grab state</dt>
        <dd>{i.phase}</dd>
        <dt>Grab / cancel reason</dt>
        <dd>{i.rejection}</dd>
        <dt>Tracking</dt>
        <dd>
          {t.status} · {g.cursor ? "21 landmarks" : "no hand"} · {t.inferenceHz}{" "}
          Hz
        </dd>
        <dt>Confidence</dt>
        <dd>Not exposed by the detector</dd>
      </dl>
      <p>
        Aim until the cube highlights, then pinch. Distance must stay below{" "}
        {GESTURE_CONFIG.pinchOn} for {GESTURE_CONFIG.pinchDwellMs} ms. Keep one
        whole hand visible.
      </p>
    </details>
  );
}
