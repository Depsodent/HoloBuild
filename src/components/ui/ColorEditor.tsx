import { useEffect, useState } from "react";
import type { SceneObject } from "../../scene/objectTypes";
import { useSceneStore } from "../../scene/sceneStore";
import { COLOR_SWATCHES, normalizeHex } from "../../scene/colors";
import { clearColorPreview, previewColors } from "../../scene/colorPreview";
export function ColorEditor({
  objects,
  label,
  onApply,
  onReset,
}: {
  objects: SceneObject[];
  label: string;
  onApply: (color: string) => void;
  onReset: () => void;
}) {
  const base = useSceneStore((s) => s.objects),
    initial = objects[0]?.color ?? "#ffffff",
    target = objects.map((o) => o.id).join(":");
  const [draft, setDraft] = useState(initial);
  const valid = normalizeHex(draft);
  useEffect(() => {
    setDraft(initial);
    clearColorPreview();
    return clearColorPreview;
  }, [base, initial, target]);
  function change(value: string) {
    setDraft(value);
    const color = normalizeHex(value);
    if (color)
      previewColors(
        base,
        objects.map((o) => o.id),
        color,
      );
    else clearColorPreview();
  }
  return (
    <fieldset className="color-editor">
      <legend>Custom color</legend>
      <div className="color-swatches">
        {Object.entries(COLOR_SWATCHES).map(([name, color]) => (
          <button
            key={name}
            type="button"
            aria-label={`${label} ${name} swatch`}
            title={name}
            style={{ background: color }}
            aria-pressed={valid === color}
            onClick={() => change(color)}
          />
        ))}
      </div>
      <div className="color-inputs">
        <label>
          Picker
          <input
            aria-label={label}
            type="color"
            value={valid ?? initial}
            onChange={(e) => change(e.target.value)}
          />
        </label>
        <label>
          HEX
          <input
            aria-label={`${label} HEX`}
            aria-invalid={!valid}
            spellCheck={false}
            maxLength={7}
            value={draft}
            onChange={(e) => change(e.target.value)}
          />
        </label>
      </div>
      {!valid && <p role="alert">Enter #RRGGBB or #RGB.</p>}
      <p className="muted">
        {new Set(objects.map((o) => o.color)).size > 1 ? "Mixed colors · " : ""}
        Preview only until applied.
      </p>
      <div className="object-actions">
        <button
          disabled={!valid || !objects.length}
          onClick={() => {
            if (valid) {
              onApply(valid);
              clearColorPreview();
            }
          }}
        >
          Apply Color
        </button>
        <button
          disabled={!objects.length}
          onClick={() => {
            onReset();
            clearColorPreview();
          }}
        >
          Reset to Material Default
        </button>
      </div>
    </fieldset>
  );
}
