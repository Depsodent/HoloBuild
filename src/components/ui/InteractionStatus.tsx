import { useInteractionStore } from "../../interaction/interactionStore";
export function InteractionStatus() {
  const message = useInteractionStore((s) => s.message);
  const phase = useInteractionStore((s) => s.phase);
  return (
    <div className={`interaction-status ${phase}`} role="status">
      {message}
    </div>
  );
}
