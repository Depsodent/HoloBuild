import { useState } from "react";
import type { Staircase } from "../../../shared/planSchema.mjs";
import type { SceneObject } from "../../scene/objectTypes";
import { MATERIAL_IDS, MATERIAL_PRESETS } from "../../scene/materialPresets";
import { requestEdit } from "../../generation/editStore";
import { openTools } from "../../workspace/toolsStore";
export function StaircaseInspector({ object }: { object: SceneObject }) {
  const template =
    object.construction?.structure?.template ??
    object.construction?.structure?.architectureTemplate;
  const stairs = template?.stairs ?? [];
  const current = stairs.find((s) => s.id === object.construction?.assembly);
  const [draft, setDraft] = useState<Staircase | undefined>(
    current
      ? { ...current, material: object.material, color: object.color }
      : undefined,
  );
  if (!template || !current || !draft)
    return (
      <aside className="panel inspector">
        <h2>Staircase assembly</h2>
        <p>
          Template geometry was modified. Undo the manual change before editing
          this staircase parametrically.
        </p>
      </aside>
    );
  const update = (patch: Partial<Staircase>) =>
    setDraft({ ...draft, ...patch });
  const preview = async (remove = false) => {
    await requestEdit(
      remove
        ? "Remove selected staircase"
        : "Update selected staircase parameters",
      { mode: "offline" },
      {
        type: "design",
        stairs: remove
          ? stairs.filter((s) => s.id !== current.id)
          : stairs.map((s) => (s.id === current.id ? draft : s)),
      },
    );
    openTools("ai");
  };
  return (
    <aside className="panel inspector" aria-label="Staircase Inspector">
      <div className="eyebrow">PARAMETRIC ASSEMBLY</div>
      <h2>Staircase {current.id}</h2>
      <p className="muted">
        Floor {current.from + 1} → {current.to + 1} · includes its floor opening
      </p>
      <div className="vector">
        {(
          [
            ["x", "X"],
            ["z", "Z"],
            ["width", "Width"],
            ["run", "Run"],
            ["rise", "Rise"],
            ["steps", "Step count"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              aria-label={`Stair ${label}`}
              step={key === "steps" ? 1 : 0.05}
              value={draft[key]}
              onChange={(e) => {
                if (e.target.value === "") return;
                const value = Number(e.target.value);
                update(
                  key === "steps"
                    ? { steps: value, rise: (template.height + 0.2) / value }
                    : { [key]: value },
                );
              }}
            />
          </label>
        ))}
      </div>
      <label>
        Orientation
        <select
          aria-label="Stair orientation"
          value={draft.yaw}
          onChange={(e) =>
            update({ yaw: Number(e.target.value) as Staircase["yaw"] })
          }
        >
          {[0, 90, 180, 270].map((n) => (
            <option key={n} value={n}>
              {n}°
            </option>
          ))}
        </select>
      </label>
      <label>
        Destination floor
        <select
          aria-label="Stair destination floor"
          value={draft.to}
          onChange={(e) => {
            const to = Number(e.target.value);
            update({ from: to - 1, to });
          }}
        >
          {Array.from({ length: template.floors - 1 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              Floor {i + 2}
            </option>
          ))}
        </select>
      </label>
      <label>
        Material
        <select
          aria-label="Stair material"
          value={draft.material}
          onChange={(e) =>
            update({ material: e.target.value as Staircase["material"] })
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
          aria-label="Stair color"
          value={draft.color}
          onChange={(e) => update({ color: e.target.value })}
        />
      </label>
      <div className="object-actions">
        <button onClick={() => void preview()}>Preview staircase change</button>
        <button onClick={() => void preview(true)}>Remove staircase</button>
      </div>
      <p className="muted">
        Rise × count must match floor elevations. Count edits recompute equal
        rise. Visual model; no regulatory or structural certification.
      </p>
    </aside>
  );
}
