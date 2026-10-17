import { useHandsStore } from "../../vision/handsStream";
import { useInteractionStore } from "../../interaction/interactionStore";
import { useAdvancedStore } from "../../interaction/advancedStore";
export function InteractionStatus() {
  const message = useInteractionStore((s) => s.message);
  const phase = useInteractionStore((s) => s.phase);
  const advanced = useAdvancedStore();
  const hands = useHandsStore((s) => s.hands.length);
  return (
    <div className={`interaction-status ${phase}`} role="status">
      {advanced.mode === "move" ||
      (advanced.mode === "auto" && hands < 2 && !advanced.active)
        ? message
        : advanced.message}
    </div>
  );
}
