import {
  MODE_INSTRUCTIONS,
  useAdvancedStore,
} from "../interaction/advancedStore";
import { useHandsStore } from "../vision/handsStream";

export function CompactHint() {
  const mode = useAdvancedStore((s) => s.mode);
  const count = useHandsStore((s) => s.hands.length);
  const text = `${count} ${count === 1 ? "hand" : "hands"} detected · ${MODE_INSTRUCTIONS[mode]}`;
  return (
    <span className="compact-hint" title={text} aria-label={text}>
      {text}
    </span>
  );
}
