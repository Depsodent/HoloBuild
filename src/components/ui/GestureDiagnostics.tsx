import { useRef } from "react";
import { ChevronDown, Grip, Minus, X } from "lucide-react";
import { useGestureStore } from "../../vision/gesturePipeline";
import { useInteractionStore } from "../../interaction/interactionStore";
import { useTrackingStore } from "../../vision/trackingStore";
import { GESTURE_CONFIG } from "../../vision/calibration";
import { useHandsStore } from "../../vision/handsStream";
import { useAdvancedStore } from "../../interaction/advancedStore";
import { useWorkspaceLayout } from "../../workspace/layoutStore";
import { useFloatingPanel } from "../camera/useFloatingPanel";
import { clampLayout } from "../camera/panelLayout";
import type { WorkspaceSize } from "../camera/panelLayout";
import "./GestureDiagnostics.css";

function diagnosticLayout(size: WorkspaceSize) {
  return clampLayout(
    {
      x: size.width < 780 ? 44 : size.width - 554,
      y: size.width < 780 ? Math.max(48, size.height - 70) : 16,
      width: size.width < 780 ? size.width - 104 : 290,
      height: 420,
      minimized: true,
    },
    size,
  );
}
export function GestureDiagnostics() {
  const panel = useRef<HTMLElement>(null);
  const floating = useFloatingPanel(panel, {
    storageKey: "holobuild.diagnostics-window.v1",
    boundarySelector: ".workspace",
    initialLayout: diagnosticLayout,
  });
  const visible = useWorkspaceLayout((s) => s.layout.diagnosticsVisible);
  const updateLayout = useWorkspaceLayout((s) => s.update);
  const g = useGestureStore();
  const i = useInteractionStore();
  const t = useTrackingStore();
  const hands = useHandsStore();
  const advanced = useAdvancedStore();
  return (
    <section
      ref={panel}
      className={`gesture-diagnostics floating-diagnostics ${floating.layout.minimized ? "minimized" : ""}`}
      style={{ ...floating.style, display: visible ? undefined : "none" }}
      aria-label="Gesture Diagnostics"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="diagnostics-title">
        <div
          className="diagnostics-drag-handle"
          data-layout-handle
          role="button"
          tabIndex={0}
          aria-label="Move Gesture Diagnostics"
          title="Drag to move · Arrow keys move · Shift moves faster"
          {...floating.handle("move")}
        >
          <strong>Gesture Diagnostics</strong>
          <small>
            {g.gesture} · {t.status}
          </small>
        </div>
        <button
          aria-label={
            floating.layout.minimized
              ? "Expand Gesture Diagnostics"
              : "Minimize Gesture Diagnostics"
          }
          onClick={floating.minimize}
        >
          {floating.layout.minimized ? (
            <ChevronDown size={15} />
          ) : (
            <Minus size={15} />
          )}
        </button>
        <button
          aria-label="Close Gesture Diagnostics"
          onClick={() => updateLayout({ diagnosticsVisible: false })}
        >
          <X size={15} />
        </button>
      </div>
      <div className="diagnostics-body" hidden={floating.layout.minimized}>
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
          <dt>Interaction mode</dt>
          <dd>
            {advanced.mode} · {advanced.active ? "active" : "ready"}
          </dd>
          <dt>Scale / rotation</dt>
          <dd>
            {advanced.factor.toFixed(2)}× / {advanced.angle.toFixed(1)}°
          </dd>
          <dt>Interaction status</dt>
          <dd>{advanced.message}</dd>
          <dt>Tracking</dt>
          <dd>
            {t.status} · {g.cursor ? "21 landmarks" : "no hand"} ·{" "}
            {t.inferenceHz} Hz
          </dd>
          <dt>Confidence</dt>
          <dd>Not exposed by the detector</dd>
          <dt>Tracked hands</dt>
          <dd>
            {hands.hands.length}
            {hands.ambiguous ? " · ambiguous" : ""}
          </dd>
          {hands.hands.map((h) => (
            <div className="hand-diagnostic" key={h.id}>
              <dt>Hand {h.id}</dt>
              <dd>
                {h.gesture.gesture} · pinch{" "}
                {h.gesture.pinchRatio?.toFixed(2) ?? "unavailable"}
                {h.handedness
                  ? ` · model ${h.handedness} (${h.handednessScore !== undefined ? `${(h.handednessScore * 100).toFixed(0)}% handedness` : "score unavailable"})`
                  : ""}
              </dd>
            </div>
          ))}
        </dl>
        <p>
          Aim until an object highlights, then pinch. Distance must stay below{" "}
          {GESTURE_CONFIG.pinchOn} for {GESTURE_CONFIG.pinchDwellMs} ms. Keep
          each interacting hand fully visible.
        </p>
      </div>
      {!floating.layout.minimized && (
        <button
          className="diagnostics-resize"
          data-layout-handle
          aria-label="Resize Gesture Diagnostics"
          title="Drag to resize · Arrow keys resize"
          {...floating.handle("resize")}
        >
          <Grip size={16} />
        </button>
      )}
    </section>
  );
}
