import { objectSize } from "../../scene/objectFactory";
import { Copy, Trash2, RotateCcw } from "lucide-react";
import { useSceneStore } from "../../scene/sceneStore";
import { execute } from "../../scene/commandManager";
import type { Vec3 } from "../../scene/objectTypes";
import { MATERIAL_IDS, MATERIAL_PRESETS } from "../../scene/materialPresets";
import type { MaterialId } from "../../scene/materialPresets";
import { surfaceControls } from "../../scene/surface";
export function ObjectInspector() {
  const objects = useSceneStore((s) => s.objects);
  const id = useSceneStore((s) => s.selectedId);
  const object = objects.find((o) => o.id === id);
  return (
    <aside className="panel inspector">
      <div className="eyebrow">OBJECT INSPECTOR</div>
      <h2>{object ? object.name : "Nothing selected"}</h2>
      {object ? (
        <>
          <div className="object-id">
            {object.type.toUpperCase()} GEOMETRY <span>● SELECTED</span>
          </div>
          <label className="field">
            Name
            <input
              aria-label="Object name"
              value={object.name}
              onChange={(e) =>
                execute({
                  type: "update",
                  id: object.id,
                  patch: { name: e.target.value },
                })
              }
            />
          </label>
          {(["position", "rotation", "scale"] as const).map((property) => (
            <fieldset key={property}>
              <legend>
                {property}
                {property === "rotation" ? " · degrees" : ""}
              </legend>
              <div className="vector">
                {(["X", "Y", "Z"] as const).map((axis, index) => (
                  <label key={axis}>
                    <span className={`axis-${axis}`}>{axis}</span>
                    <input
                      aria-label={`${property} ${axis}`}
                      type="number"
                      step={property === "rotation" ? 15 : 0.5}
                      value={Number(
                        (
                          object[property][index] *
                          (property === "rotation" ? 180 / Math.PI : 1)
                        ).toFixed(2),
                      )}
                      onChange={(e) => {
                        if (e.target.value === "") return;
                        const vector = [...object[property]] as Vec3;
                        vector[index] =
                          Number(e.target.value) *
                          (property === "rotation" ? Math.PI / 180 : 1);
                        execute({
                          type: "update",
                          id: object.id,
                          patch: { [property]: vector },
                        });
                      }}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="section-label">APPEARANCE</div>
          {object.model && (
            <label className="toggle">
              <input
                type="checkbox"
                aria-label="Use original model materials"
                checked={object.model.originalMaterials}
                onChange={(e) =>
                  execute({
                    type: "update",
                    id: object.id,
                    patch: {
                      model: {
                        ...object.model!,
                        originalMaterials: e.target.checked,
                      },
                    },
                  })
                }
              />{" "}
              Original model materials
            </label>
          )}
          {object.model?.originalMaterials && (
            <p className="muted">
              Imported PBR surfaces are active. Choose a preset to override
              them; re-enable originals here.
            </p>
          )}
          <label className="color-field">
            Surface color
            <input
              aria-label="Object color"
              type="color"
              value={object.color}
              onChange={(e) =>
                execute({
                  type: "update",
                  id: object.id,
                  patch: {
                    color: e.target.value,
                    ...(object.model
                      ? { model: { ...object.model, originalMaterials: false } }
                      : {}),
                  },
                })
              }
            />
          </label>
          <label className="field">
            Material
            <select
              aria-label="Material"
              value={
                object.model?.originalMaterials ? "original" : object.material
              }
              onChange={(e) =>
                execute({
                  type: "update",
                  id: object.id,
                  patch: {
                    material: e.target.value as MaterialId,
                    surface: {},
                    ...(object.model
                      ? { model: { ...object.model, originalMaterials: false } }
                      : {}),
                  },
                })
              }
            >
              {object.model?.originalMaterials && (
                <option value="original" disabled>
                  Original model surfaces
                </option>
              )}
              {MATERIAL_IDS.map((id) => (
                <option key={id} value={id}>
                  {MATERIAL_PRESETS[id].label}
                </option>
              ))}
            </select>
          </label>
          {!object.model?.originalMaterials &&
            surfaceControls(object).map((control) => (
              <label className="field" key={control.key}>
                {control.label}
                <input
                  aria-label={control.label}
                  type="number"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={control.value}
                  onChange={(e) => {
                    if (e.target.value !== "")
                      execute({
                        type: "update",
                        id: object.id,
                        patch: {
                          surface: {
                            ...object.surface,
                            [control.key]: Number(e.target.value),
                          },
                        },
                      });
                  }}
                />
              </label>
            ))}
          {!object.model?.originalMaterials && (
            <button
              onClick={() =>
                execute({
                  type: "update",
                  id: object.id,
                  patch: { surface: {} },
                })
              }
            >
              Reset material defaults
            </button>
          )}
          {MATERIAL_PRESETS[object.material].texture &&
            !object.model?.originalMaterials && (
              <p className="muted">
                Surface color tints the texture. Use white to see its native
                colors.
              </p>
            )}
          <div className="object-actions">
            <button
              onClick={() => execute({ type: "duplicate", id: object.id })}
            >
              <Copy size={15} />
              Duplicate
            </button>
            <button
              title="Delete selected object"
              aria-label="Delete selected object"
              onClick={() => execute({ type: "delete", id: object.id })}
            >
              <Trash2 size={16} />
            </button>
            <button
              title="Reset transform"
              aria-label="Reset transform"
              onClick={() =>
                execute({
                  type: "update",
                  id: object.id,
                  patch: {
                    position: [0, objectSize(object)[1] / 2, 0],
                    rotation: [0, 0, 0],
                    scale: [1, 1, 1],
                  },
                })
              }
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </>
      ) : (
        <p className="muted">
          Click an object in the viewport or the scene list to inspect it.
        </p>
      )}
      <div className="section-label scene-title">
        SCENE COLLECTION{" "}
        <span>{objects.length.toString().padStart(2, "0")}</span>
      </div>
      <div className="scene-list">
        {objects.map((o, i) => (
          <button
            className={id === o.id ? "selected" : ""}
            key={o.id}
            onClick={() => useSceneStore.getState().select(o.id)}
          >
            <span style={{ color: o.color }}>◇</span>
            {o.name}
            <small>{String(i + 1).padStart(2, "0")}</small>
          </button>
        ))}
        {!objects.length && (
          <p className="muted">Your next idea starts here.</p>
        )}
      </div>
    </aside>
  );
}
