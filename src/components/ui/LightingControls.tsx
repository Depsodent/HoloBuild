import { Lightbulb } from "lucide-react";
import { useLightingStore } from "../../scene/lightingStore";
export function LightingControls({ compact }: { compact: boolean }) {
  const { lighting, update, reset } = useLightingStore();
  if (compact)
    return (
      <span title="Expand Construction Tools to adjust lighting">
        <Lightbulb size={18} />
      </span>
    );
  return (
    <details className="lighting-controls">
      <summary>
        <Lightbulb size={15} /> Studio lighting
      </summary>
      {(["ambient", "key", "fill", "environment"] as const).map((key) => (
        <label className="field" key={key}>
          {key === "environment"
            ? "Reflections"
            : `${key[0].toUpperCase()}${key.slice(1)} light`}
          <input
            aria-label={`${key} intensity`}
            type="number"
            min="0"
            max={key === "fill" ? 30 : key === "key" ? 6 : 3}
            step={key === "fill" ? 1 : 0.1}
            value={lighting[key]}
            onChange={(e) => {
              if (e.target.value !== "")
                update({ [key]: Number(e.target.value) });
            }}
          />
        </label>
      ))}
      <label className="toggle">
        <input
          type="checkbox"
          aria-label="Scene shadows"
          checked={lighting.shadows}
          onChange={(e) => update({ shadows: e.target.checked })}
        />{" "}
        Shadows
      </label>
      <button onClick={reset}>Reset lighting</button>
    </details>
  );
}
