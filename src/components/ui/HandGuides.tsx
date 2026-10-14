import { useInteractionStore } from "../../interaction/interactionStore";
import { useAdvancedStore } from "../../interaction/advancedStore";
import { useHandsStore } from "../../vision/handsStream";
import { handReference } from "../../interaction/twoHandMath";
export function HandGuides() {
  const state = useAdvancedStore(),
    hands = useHandsStore();
  const phase = useInteractionStore((s) => s.phase);
  const active =
    state.mode === "move"
      ? phase === "dragging" || phase === "invalid"
      : state.active;
  const paired =
    hands.hands.length === 2 &&
    (state.mode === "scale" || state.mode === "rotate");
  const points = hands.hands.map(handReference);
  return (
    <>
      {paired && (
        <svg
          className="hand-guides"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-label="Two-hand visual guide"
        >
          <line
            x1={points[0].x * 100}
            y1={points[0].y * 100}
            x2={points[1].x * 100}
            y2={points[1].y * 100}
            stroke={
              hands.ambiguous || phase === "invalid" ? "#ff7991" : "#79ffe0"
            }
            strokeWidth="0.25"
            strokeDasharray="1 1"
          />
          {points.map((p, i) => (
            <circle
              key={hands.hands[i].id}
              cx={p.x * 100}
              cy={p.y * 100}
              r="0.8"
              fill={hands.hands[i].id % 2 ? "#65f6df" : "#bf9aff"}
            />
          ))}
        </svg>
      )}
      {(hands.hands.length > 0 || state.mode !== "move") && (
        <div className="advanced-hud" aria-label="Advanced gesture feedback">
          <strong>
            {state.mode === "navigate"
              ? "CAMERA PAN"
              : state.mode.toUpperCase()}{" "}
            · {active ? "ACTIVE" : "READY"}
          </strong>
          <span>
            {hands.hands.length} tracked hands
            {hands.ambiguous ? " · separate hands" : ""}
          </span>
          {state.mode === "scale" && <b>{state.factor.toFixed(2)}× scale</b>}
          {state.mode === "rotate" && <b>{state.angle.toFixed(1)}° yaw</b>}
          {hands.hands.map((h) => (
            <small key={h.id}>
              Hand {h.id}: {h.gesture.gesture} ·{" "}
              {h.gesture.pinchActive ? "pinched" : "open"}
            </small>
          ))}
        </div>
      )}
    </>
  );
}
