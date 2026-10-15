import {
  useAdvancedStore,
  MODE_INSTRUCTIONS,
} from "../../interaction/advancedStore";
import type { AdvancedMode } from "../../interaction/advancedStore";
import { useHandsStore } from "../../vision/handsStream";
import { Accordion } from "./Accordion";
import { useSceneStore } from "../../scene/sceneStore";
export function AdvancedGestures() {
  const state = useAdvancedStore();
  const hands = useHandsStore();
  const selected = useSceneStore(
    (s) => s.objects.find((o) => o.id === s.selectedId)?.name,
  );
  return (
    <div className="advanced-gestures">
      <label>
        Gesture mode{" "}
        <select
          aria-label="Gesture mode"
          value={state.mode}
          onChange={(e) =>
            useAdvancedStore.setState({ mode: e.target.value as AdvancedMode })
          }
        >
          <option value="move">One-hand move</option>
          <option value="scale">Two-hand scale</option>
          <option value="rotate">Two-hand yaw rotation</option>
          <option value="navigate">One-hand camera pan</option>
        </select>
      </label>
      <p>
        {hands.hands.length} tracked hands · {state.active ? "ACTIVE" : "READY"}{" "}
        ·{" "}
        {state.mode === "scale"
          ? `${state.factor.toFixed(2)}×`
          : state.mode === "rotate"
            ? `${state.angle.toFixed(1)}°`
            : "Move"}
      </p>
      <p
        className="selected-object-hint"
        title={selected ?? "Select using one-hand pinch or mouse"}
      >
        {selected ? `Selected: ${selected}` : "No object selected"}
      </p>
      <p className="advanced-message" role="status" title={state.message}>
        {state.active
          ? "Release to confirm"
          : `${state.readyHands}/2 hands prepared`}
      </p>
      <Accordion id="tools.gesture-settings" title="Gesture settings">
        <p className="muted">{MODE_INSTRUCTIONS[state.mode]}</p>
        {state.mode === "navigate" && (
          <label>
            Pan sensitivity{" "}
            <input
              aria-label="Navigation sensitivity"
              type="range"
              min="0.2"
              max="2"
              step="0.05"
              value={state.navigationSensitivity}
              disabled={state.active}
              onChange={(e) =>
                useAdvancedStore.setState({
                  navigationSensitivity: Number(e.target.value),
                })
              }
            />
          </label>
        )}
        <label>
          <input
            type="checkbox"
            aria-label="Enable open-palm tool menu"
            checked={state.menuEnabled}
            onChange={(e) =>
              useAdvancedStore.setState({ menuEnabled: e.target.checked })
            }
          />
          Enable open-palm tool menu
        </label>
        {state.menuEnabled && (
          <p>
            Hold one palm steady for 1.2 s. After a grab or menu close, lower
            your hand or point to rearm; pinch release never opens tools.
          </p>
        )}
        {state.mode === "rotate" && (
          <label>
            Rotation sensitivity{" "}
            <input
              aria-label="Rotation sensitivity"
              type="range"
              min="0.25"
              max="2"
              step="0.05"
              value={state.rotationSensitivity}
              disabled={state.active}
              onChange={(e) =>
                useAdvancedStore.setState({
                  rotationSensitivity: Number(e.target.value),
                })
              }
            />
          </label>
        )}
      </Accordion>
    </div>
  );
}
