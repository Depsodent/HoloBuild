import { useInteractionStore } from "../../interaction/interactionStore";
import { useAdvancedStore } from "../../interaction/advancedStore";
export function InteractionStatus() {
  const message = useInteractionStore((s) => s.message);
  const phase = useInteractionStore((s) => s.phase);
  const advanced = useAdvancedStore();
  return (
    <div className={`interaction-status ${phase}`} role="status">
      {advanced.mode === "move" ? message : advanced.message}
    </div>
  );
}
