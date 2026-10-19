import { StaircaseInspector } from "./StaircaseInspector";
import { ColorEditor } from "./ColorEditor";
import { colorPatch } from "../../scene/colors";
import { StructureInspector } from "./StructureInspector";
import { objectSize } from "../../scene/objectFactory";
import { Copy, Trash2, RotateCcw } from "lucide-react";
import { useSceneStore } from "../../scene/sceneStore";
import { execute } from "../../scene/commandManager";
import type { Vec3 } from "../../scene/objectTypes";
import {
  MATERIAL_IDS,
  MATERIAL_PRESETS,
  type MaterialId,
} from "../../scene/materialPresets";
import { surfaceControls } from "../../scene/surface";
import { Accordion } from "./Accordion";
export function ObjectInspector() {
  const objects = useSceneStore((s) => s.objects),
    id = useSceneStore((s) => s.selectedId),
    object = objects.find((o) => o.id === id);
  const group = useSceneStore((s) => s.selectedStructureId);
  if (group && objects.some((o) => o.construction?.structureId === group))
    return <StructureInspector key={group} id={group} />;
  if (object?.construction?.assembly && object.construction.role === "stair")
    return (
      <StaircaseInspector
        key={
          object.id +
          JSON.stringify(object.construction.structure?.template?.stairs)
        }
        object={object}
      />
    );
  function parameter(control: ReturnType<typeof surfaceControls>[number]) {
    if (!object) return null;
    return (
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
    );
  }
  return (
    <aside className="panel inspector">
      <div className="eyebrow">OBJECT INSPECTOR</div>

      <h2>{object ? object.name : "Nothing selected"}</h2>
      {object ? (
        <>
          <div className="object-id">
            {object.type.toUpperCase()} <span>● SELECTED</span>
          </div>
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
          </div>
          <Accordion id="inspector.transform" title="Transform">
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
            <button
              aria-label="Reset transform"
              title="Reset transform"
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
              Reset transform
            </button>
          </Accordion>
          <Accordion id="inspector.appearance" title="Appearance">
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
                />
                Original model materials
              </label>
            )}
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
                        ? {
                            model: {
                              ...object.model,
                              originalMaterials: false,
                            },
                          }
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
                {MATERIAL_IDS.map((material) => (
                  <option key={material} value={material}>
                    {MATERIAL_PRESETS[material].label}
                  </option>
                ))}
              </select>
            </label>
            {object.model?.originalMaterials ? (
              <p className="muted">
                Color tints preserve imported textures and optics. Reset
                restores original colors; a preset replaces the imported
                surface.
              </p>
            ) : (
              <>
                {surfaceControls(object)
                  .filter((c) => c.key !== "textureScale")
                  .map(parameter)}
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
              </>
            )}
            <ColorEditor
              key={object.id}
              objects={[object]}
              label="Object color"
              onApply={(color) =>
                execute({
                  type: "update",
                  id: object.id,
                  patch: colorPatch(object, color),
                })
              }
              onReset={() =>
                execute({
                  type: "update",
                  id: object.id,
                  patch: colorPatch(object, "#ffffff", true),
                })
              }
            />
            {!object.model?.originalMaterials &&
              surfaceControls(object)
                .filter((c) => c.key === "textureScale")
                .map(parameter)}
            {MATERIAL_PRESETS[object.material].texture &&
              !object.model?.originalMaterials && (
                <p className="muted">
                  Color tints the texture; white shows its native colors.
                </p>
              )}
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
            <p className="muted object-reference" title={object.id}>
              ID: {object.id}
            </p>
          </Accordion>
        </>
      ) : (
        <p className="muted">
          Point and pinch with one hand, or click an object to select it.
        </p>
      )}
    </aside>
  );
}
