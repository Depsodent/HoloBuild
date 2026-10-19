import { useState } from "react";
import type { Balcony } from "../../../shared/planSchema.mjs";
import type { SceneObject } from "../../scene/objectTypes";
import { balconyOpeningChange } from "../../generation/balconies";
import { MATERIAL_IDS, MATERIAL_PRESETS } from "../../scene/materialPresets";
import { requestEdit } from "../../generation/editStore";
import { openTools } from "../../workspace/toolsStore";
export function BalconyInspector({ object }: { object: SceneObject }) {
  const recipe =
    object.construction?.structure?.template ??
    object.construction?.structure?.architectureTemplate;
  const current = recipe?.balconies?.find(
    (b) => b.id === object.construction?.assembly,
  );
  const [draft, setDraft] = useState<Balcony | undefined>(
    current
      ? { ...current, material: object.material, color: object.color }
      : undefined,
  );
  if (!recipe || !current || !draft)
    return (
      <aside className="panel inspector">
        <h2>Balcony assembly</h2>
        <p>Restore certified facade geometry before editing this balcony.</p>
      </aside>
    );
  const preview = async (remove = false) => {
    const balconies = remove
      ? recipe.balconies!.filter((b) => b.id !== current.id)
      : recipe.balconies!.map((b) => (b.id === current.id ? draft : b));
    await requestEdit(
      remove ? "Remove selected balcony" : "Update selected balcony",
      { mode: "offline" },
      {
        type: "design",
        balconies,
        openings: balconyOpeningChange(recipe, balconies),
      },
    );
    openTools("ai");
  };
  return (
    <aside className="panel inspector" aria-label="Balcony Inspector">
      <div className="eyebrow">PARAMETRIC ASSEMBLY</div>
      <h2>Balcony {current.id}</h2>
      <p className="muted">Slab, rails and access doorway move together.</p>
      <div className="vector">
        {(["offset", "width", "depth", "railHeight"] as const).map((k) => (
          <label key={k}>
            {k}
            <input
              type="number"
              step={0.1}
              aria-label={`Balcony ${k}`}
              value={draft[k]}
              onChange={(e) => {
                if (e.target.value !== "")
                  setDraft({ ...draft, [k]: Number(e.target.value) });
              }}
            />
          </label>
        ))}
      </div>
      <label>
        Floor
        <select
          aria-label="Balcony floor"
          value={draft.level}
          onChange={(e) =>
            setDraft({ ...draft, level: Number(e.target.value) })
          }
        >
          {Array.from({ length: recipe.floors - 1 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              Floor {i + 2}
            </option>
          ))}
        </select>
      </label>
      <label>
        Facade
        <select
          aria-label="Balcony facade"
          value={draft.facade}
          onChange={(e) =>
            setDraft({ ...draft, facade: e.target.value as Balcony["facade"] })
          }
        >
          {(["front", "back", "left", "right"] as const).map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <label>
        Material
        <select
          aria-label="Balcony material"
          value={draft.material}
          onChange={(e) =>
            setDraft({
              ...draft,
              material: e.target.value as Balcony["material"],
            })
          }
        >
          {MATERIAL_IDS.map((m) => (
            <option key={m} value={m}>
              {MATERIAL_PRESETS[m].name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Color
        <input
          type="color"
          aria-label="Balcony color"
          value={draft.color}
          onChange={(e) => setDraft({ ...draft, color: e.target.value })}
        />
      </label>
      <div className="object-actions">
        <button onClick={() => void preview()}>Preview balcony change</button>
        <button onClick={() => void preview(true)}>Remove balcony</button>
      </div>
      <p className="muted">
        Visual geometry only; no structural or building-regulation
        certification. Access panels are static.
      </p>
    </aside>
  );
}
