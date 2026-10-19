import { useState } from "react";
import type { SceneObject } from "../../scene/objectTypes";
import { useSceneStore } from "../../scene/sceneStore";
import { structureInfo, members } from "../../scene/structures";
import { openingDefinitions } from "../../generation/openings";
import { openingTarget } from "../../scene/openingTransform";
import { requestEdit } from "../../generation/editStore";
import { openTools } from "../../workspace/toolsStore";
import { execute } from "../../scene/commandManager";
import { ColorEditor } from "./ColorEditor";
import { colorPatch } from "../../scene/colors";
import {
  MATERIAL_IDS,
  MATERIAL_PRESETS,
  type MaterialId,
} from "../../scene/materialPresets";
export function OpeningInspector({
  object,
  structureId,
  openingId,
  onBack,
}: {
  object?: SceneObject;
  structureId?: string;
  openingId?: string;
  onBack?: () => void;
}) {
  const objects = useSceneStore((s) => s.objects);
  const id = structureId ?? object?.construction?.structureId;
  const parts = id ? members(objects, id) : [];
  const info = parts.length ? structureInfo(parts) : null;
  const recipe = info?.template ?? info?.architectureTemplate;
  const definitions = recipe
    ? openingDefinitions(recipe, info?.floorLayouts)
    : [];
  const current = openingId
    ? definitions.find((d) => d.id === openingId)
    : object
      ? openingTarget(objects, object.id)?.current
      : undefined;
  const [draft, setDraft] = useState(current);
  if (!recipe || !current || !draft)
    return (
      <aside className="panel inspector">
        <h2>Opening Inspector</h2>
        <p>
          This panel no longer matches a certified wall opening. Undo manual
          edits on that facade before continuing.
        </p>
        {onBack && <button onClick={onBack}>Back to structure</button>}
      </aside>
    );
  const panel =
    object ??
    parts.find(
      (p) =>
        ["window", "door"].includes(p.construction!.role) &&
        openingTarget(objects, p.id)?.current.id === current.id,
    );
  const preview = async (remove = false) => {
    await requestEdit(
      remove ? "Remove selected opening" : "Update selected wall opening",
      { mode: "offline" },
      {
        type: "design",
        openings: remove
          ? definitions.filter((d) => d.id !== current.id)
          : definitions.map((d) => (d.id === current.id ? draft : d)),
      },
    );
    openTools("ai");
  };
  return (
    <aside className="panel inspector" aria-label="Opening Inspector">
      <div className="eyebrow">WALL OPENING</div>
      <h2>
        {current.kind === "door" ? "Static door / doorway" : "Window opening"}
      </h2>
      <p className="muted">
        Floor {current.level + 1} · {current.facade} · surrounding wall follows
        the opening
      </p>
      {onBack && <button onClick={onBack}>Back to structure</button>}
      <div className="vector">
        {(["offset", "bottom", "width", "height"] as const)
          .filter((k) => current.kind !== "door" || k !== "bottom")
          .map((key) => (
            <label key={key}>
              {key}
              <input
                type="number"
                step={0.1}
                aria-label={`Opening ${key}`}
                value={draft[key]}
                onChange={(e) => {
                  if (e.target.value !== "")
                    setDraft({ ...draft, [key]: Number(e.target.value) });
                }}
              />
            </label>
          ))}
      </div>
      <label>
        Wall face
        <select
          aria-label="Opening facade"
          value={draft.facade}
          onChange={(e) =>
            setDraft({
              ...draft,
              facade: e.target.value as typeof draft.facade,
            })
          }
        >
          {(["front", "back", "left", "right"] as const).map((face) => (
            <option key={face} value={face}>
              {face}
            </option>
          ))}
        </select>
      </label>
      <label>
        Floor
        <select
          aria-label="Opening floor"
          value={draft.level}
          onChange={(e) =>
            setDraft({ ...draft, level: Number(e.target.value) })
          }
        >
          {Array.from({ length: recipe.floors }, (_, i) => (
            <option key={i} value={i}>
              Floor {i + 1}
            </option>
          ))}
        </select>
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          aria-label="Show static opening panel"
          checked={draft.panel}
          onChange={(e) => setDraft({ ...draft, panel: e.target.checked })}
        />
        Static panel
      </label>
      <div className="object-actions">
        <button onClick={() => void preview()}>Preview opening change</button>
        <button onClick={() => void preview(true)}>Remove opening</button>
      </div>
      {panel && (
        <>
          <label>
            Material
            <select
              aria-label="Material"
              value={panel.material}
              onChange={(e) =>
                execute({
                  type: "update",
                  id: panel.id,
                  patch: {
                    material: e.target.value as MaterialId,
                    surface: undefined,
                  },
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
          <ColorEditor
            objects={[panel]}
            label="Object color"
            onApply={(color) =>
              execute({
                type: "update",
                id: panel.id,
                patch: colorPatch(panel, color),
              })
            }
            onReset={() =>
              execute({
                type: "update",
                id: panel.id,
                patch: colorPatch(panel, "#ffffff", true),
              })
            }
          />
        </>
      )}
      <p className="muted">
        Geometry is previewed before confirmation. Panels are static; animated
        hinges are not implemented.
      </p>
    </aside>
  );
}
