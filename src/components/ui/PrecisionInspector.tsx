import { useState, useRef, useEffect } from "react";
import { LegacyObjectInspector } from "./ObjectInspector";
import { useSceneStore } from "../../scene/sceneStore";
import { execute } from "../../scene/commandManager";
import { ColorEditor } from "./ColorEditor";
import { colorPatch } from "../../scene/colors";
import { surfaceValues, surfaceControls } from "../../scene/surface";
import {
  MATERIAL_IDS,
  MATERIAL_PRESETS,
  type MaterialId,
} from "../../scene/materialPresets";
import { members, structureInfo } from "../../scene/structures";
import {
  dimensions,
  dimensionPatch,
  precisionUpdate,
  floorPosition,
  edgePosition,
  structureDimensions,
  structureDimensionOperation,
} from "../../scene/precision";
import {
  usePrecisionSettings,
  precisionSettings,
} from "../../scene/precisionSettings";
import { dispatchAssistant } from "../../generation/assistant";
import { useGenerationStore } from "../../generation/generationStore";
import { CommandInterpreter } from "../../commands/interpreter";
import { saveProject } from "../../assets/saveProject";
import { openTools } from "../../workspace/toolsStore";
import { useConversationStore } from "../../generation/conversationStore";
import type { Vec3 } from "../../scene/objectTypes";
function Numeric({
  label,
  value,
  onApply,
  min,
  max,
  step = 0.1,
  clamp = false,
}: {
  label: string;
  value: number;
  onApply: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  clamp?: boolean;
}) {
  return (
    <label className="field">
      {label}
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        key={value}
        defaultValue={Number(value.toFixed(4))}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = String(value);
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n) && n !== value) {
            if (
              !clamp &&
              ((min !== undefined && n < min) || (max !== undefined && n > max))
            ) {
              useSceneStore.setState({
                status: "Invalid numeric range; scene unchanged.",
              });
              e.target.value = String(value);
            } else
              onApply(
                clamp
                  ? Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))
                  : n,
              );
          } else e.target.value = String(value);
          const element = e.currentTarget;
          requestAnimationFrame(() => {
            if (element.isConnected) element.value = String(value);
          });
        }}
      />
    </label>
  );
}
export function PrecisionInspector() {
  const objects = useSceneStore((s) => s.objects),
    id = useSceneStore((s) => s.selectedId),
    group = useSceneStore((s) => s.selectedStructureId),
    o = objects.find((v) => v.id === id),
    parts = group ? members(objects, group) : o ? [o] : [];
  const [materialRole, setMaterialRole] = useState("all");
  const [edgeTarget, setEdgeTarget] = useState("");
  const selectionKey = group ?? id;
  useEffect(() => {
    setMaterialRole("all");
    setEdgeTarget("");
  }, [selectionKey]);
  const [tab, setTab] = useState("materials"),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [interpreter] = useState(() => new CommandInterpreter(saveProject));
  const messages = useConversationStore((s) => s.messages),
    editMessage =
      messages.at(-1)?.role === "assistant" ? messages.at(-1)?.text : "";
  const settings = useGenerationStore();
  const step = usePrecisionSettings((s) => s.gridStep),
    measurements = usePrecisionSettings((s) => s.measurements),
    guides = usePrecisionSettings((s) => s.guides),
    snap = useSceneStore((s) => s.snap);
  const status = useSceneStore((s) => s.status);
  const fail = (e: unknown) =>
    useSceneStore.setState({
      status: e instanceof Error ? e.message : "Invalid edit; scene unchanged.",
    });
  const run = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      fail(e);
    }
  };
  const surface = (
    values: { roughness?: number; metalness?: number; opacity?: number },
    reset = false,
  ) => {
    if (!o) return;
    if (group)
      execute({
        type: "structure",
        structureId: group,
        operation: {
          ...(materialRole !== "all" ? { role: materialRole as "wall" } : {}),
          type: "surface",
          ...(reset ? { reset: true } : { values }),
        },
      });
    else
      execute({
        type: "update",
        id: o.id,
        patch: {
          surface: reset ? {} : { ...o.surface, ...values },
          ...(o.model
            ? { model: { ...o.model, originalMaterials: false } }
            : {}),
        },
      });
  };
  const targets = group
    ? parts.filter(
        (p) => materialRole === "all" || p.construction?.role === materialRole,
      )
    : parts;
  const optics = targets[0]
    ? surfaceValues(targets[0])
    : o
      ? surfaceValues(o)
      : null;
  const info = group ? structureInfo(parts) : null;
  const size = group
    ? structureDimensions(objects, group)
    : o
      ? dimensions(o)
      : null;
  return (
    <section
      className="panel inspector precision-inspector"
      aria-label="Precision Inspector"
    >
      <nav
        className="ai-secondary-nav inspector-tabs"
        aria-label="Inspector views"
      >
        {["materials", "ai", "advanced"].map((key, i) => (
          <button
            key={key}
            aria-pressed={tab === key}
            aria-controls={"inspector-" + key}
            onClick={() => setTab(key)}
          >
            {["Materials", "AI Edit", "Advanced"][i]}
          </button>
        ))}
      </nav>
      {!o ? (
        <div className="panel">
          <h2>Nothing selected</h2>
          <p className="muted">Select a Part or Structure to inspect.</p>
        </div>
      ) : (
        <>
          <header
            className="inspector-heading"
            aria-label={group ? "Structure Inspector" : undefined}
          >
            <h2>{info?.name ?? o.name}</h2>
            <p className="muted">
              {group ? "Structure" : "Part"} ·{" "}
              {info?.type ?? o.construction?.role ?? o.type}
            </p>
            <div className="object-actions">
              <button onClick={() => execute({ type: "duplicate", id: o.id })}>
                Duplicate
              </button>
              <button
                aria-label="Delete selected object"
                onClick={() => execute({ type: "delete", id: o.id })}
              >
                Delete
              </button>
            </div>
          </header>
          <div id="inspector-materials" hidden={tab !== "materials"}>
            {group && (
              <label className="field">
                Apply to
                <select
                  aria-label="Structure material target"
                  value={materialRole}
                  onChange={(e) => setMaterialRole(e.target.value)}
                >
                  <option value="all">All components</option>
                  {[...new Set(parts.map((p) => p.construction!.role))].map(
                    (r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ),
                  )}
                </select>
              </label>
            )}
            <label className="field">
              Material
              <select
                aria-label={group ? "Structure material" : "Material"}
                value={group ? "" : o.material}
                onChange={(e) => {
                  const material = e.target.value as MaterialId;
                  if (group)
                    execute({
                      type: "structure",
                      structureId: group,
                      operation: {
                        type: "material",
                        material,
                        ...(materialRole !== "all"
                          ? { role: materialRole as "wall" }
                          : {}),
                      },
                    });
                  else
                    execute({
                      type: "update",
                      id: o.id,
                      patch: {
                        material,
                        surface: {},
                        ...(o.model
                          ? {
                              model: { ...o.model, originalMaterials: false },
                            }
                          : {}),
                      },
                    });
                }}
              >
                {group && (
                  <option value="" disabled>
                    Choose for all components
                  </option>
                )}
                {MATERIAL_IDS.map((m) => (
                  <option key={m} value={m}>
                    {MATERIAL_PRESETS[m].label}
                  </option>
                ))}
              </select>
            </label>
            {o.model && (
              <label className="toggle">
                <input
                  type="checkbox"
                  aria-label="Use original model materials"
                  checked={o.model.originalMaterials}
                  onChange={(e) =>
                    execute({
                      type: "update",
                      id: o.id,
                      patch: {
                        model: {
                          ...o.model!,
                          originalMaterials: e.target.checked,
                        },
                      },
                    })
                  }
                />
                Original model materials
              </label>
            )}
            <ColorEditor
              key={group ?? id}
              objects={targets}
              label={group ? "Structure color" : "Object color"}
              onApply={(color) =>
                group
                  ? execute({
                      type: "structure",
                      structureId: group,
                      operation: {
                        type: "color",
                        color,
                        ...(materialRole !== "all"
                          ? { role: materialRole as "wall" }
                          : {}),
                      },
                    })
                  : execute({
                      type: "update",
                      id: o.id,
                      patch: colorPatch(o, color),
                    })
              }
              onReset={() =>
                group
                  ? execute({
                      type: "structure",
                      structureId: group,
                      operation: {
                        type: "color",
                        reset: true,
                        ...(materialRole !== "all"
                          ? { role: materialRole as "wall" }
                          : {}),
                      },
                    })
                  : execute({
                      type: "update",
                      id: o.id,
                      patch: colorPatch(o, "#ffffff", true),
                    })
              }
            />
            {(["roughness", "metalness", "opacity"] as const).map((key) => (
              <Numeric
                key={key}
                label={key[0].toUpperCase() + key.slice(1)}
                value={optics![key]}
                min={key === "opacity" ? 0.05 : 0}
                max={1}
                step={0.05}
                clamp
                onApply={(n) => surface({ [key]: n })}
              />
            ))}
            {!group &&
              surfaceControls(o)
                .filter(
                  (c) => !["roughness", "metalness", "opacity"].includes(c.key),
                )
                .map((c) => (
                  <Numeric
                    key={c.key}
                    label={c.label}
                    value={c.value ?? 0}
                    min={c.min}
                    max={c.max}
                    step={c.step}
                    onApply={(n) =>
                      execute({
                        type: "update",
                        id: o.id,
                        patch: { surface: { ...o.surface, [c.key]: n } },
                      })
                    }
                  />
                ))}
            {group && (
              <p className="muted">
                Values show the first component. Applying a value targets all
                selected components.
              </p>
            )}
            {o.model?.originalMaterials && (
              <p className="muted">
                Optical edits use a HoloBuild surface; original textures remain
                available above.
              </p>
            )}
            <button onClick={() => surface({}, true)}>
              Reset material defaults
            </button>
          </div>
          <div id="inspector-ai" hidden={tab !== "ai"}>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await dispatchAssistant(draft, settings, interpreter);
                  openTools("ai");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="field">
                Edit selected {group ? "Structure" : "Part"}
                <input
                  ref={input}
                  aria-label="AI edit selected"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Set roughness to 0.3"
                />
              </label>
              <button disabled={busy || !draft.trim()}>
                {busy ? "Planning…" : "Preview edit"}
              </button>
            </form>
            <div className="object-actions">
              {[
                "Set roughness to 0.3",
                "Set opacity to 50%",
                "Move this object 20 centimeters to the right",
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => {
                    setDraft(example);
                    input.current?.focus();
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
            <p role="status">{editMessage}</p>
            <button onClick={() => openTools("ai")}>
              Review preview in Ask HoloBuild
            </button>
          </div>
          <div id="inspector-advanced" hidden={tab !== "advanced"}>
            <p className="muted">
              Metres · local dimensions; world position. Visual design
              measurements, not engineering certification.
            </p>
            {!group && (
              <label className="field">
                Name
                <input
                  aria-label="Object name"
                  key={o.id + o.name}
                  defaultValue={o.name}
                  maxLength={60}
                  onBlur={(e) => {
                    if (e.target.value !== o.name)
                      execute({
                        type: "update",
                        id: o.id,
                        patch: { name: e.target.value },
                      });
                  }}
                />
              </label>
            )}
            {group && info && (
              <>
                <label className="field">
                  Name
                  <input
                    aria-label="Structure name"
                    key={group + info.name}
                    defaultValue={info.name}
                    maxLength={60}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    onBlur={(e) => {
                      if (e.target.value !== info.name)
                        execute({
                          type: "structure",
                          structureId: group,
                          operation: { type: "rename", name: e.target.value },
                        });
                    }}
                  />
                </label>
                <div className="precision-grid">
                  {(["position", "scale"] as const).map((property) =>
                    ["X", "Y", "Z"].map((axis, i) => (
                      <Numeric
                        key={property + axis}
                        label={"Structure " + property + " " + axis}
                        value={info[property][i]}
                        min={property === "scale" ? 0.1 : undefined}
                        max={property === "scale" ? 20 : undefined}
                        onApply={(n) =>
                          run(() => {
                            const vector = [...info[property]] as Vec3;
                            vector[i] = n;
                            execute({
                              type: "structure",
                              structureId: group,
                              snap: false,
                              operation: {
                                type: "setTransform",
                                position: info.position,
                                yaw: info.yaw,
                                scale: info.scale,
                                [property]: vector,
                              },
                            });
                          })
                        }
                      />
                    )),
                  )}
                </div>
                <Numeric
                  label="Structure yaw"
                  value={(info.yaw * 180) / Math.PI}
                  step={1}
                  onApply={(n) =>
                    run(() =>
                      execute({
                        type: "structure",
                        structureId: group,
                        snap: false,
                        operation: {
                          type: "setTransform",
                          position: info.position,
                          scale: info.scale,
                          yaw: Math.atan2(
                            Math.sin((n * Math.PI) / 180),
                            Math.cos((n * Math.PI) / 180),
                          ),
                        },
                      }),
                    )
                  }
                />
                <p className="muted">
                  Structure rotation supports yaw (Y) in degrees; connected
                  geometry transforms together.
                </p>
              </>
            )}
            <div className="precision-grid">
              {size &&
                ["Width", "Height", "Depth"].map((label, i) => (
                  <Numeric
                    key={label}
                    label={"Selection " + label.toLowerCase() + " (m)"}
                    value={size[i]}
                    min={group ? 0.001 : (dimensions(o)[i] / o.scale[i]) * 0.1}
                    onApply={(n) =>
                      run(() => {
                        if (group)
                          execute({
                            type: "structure",
                            structureId: group,
                            operation: structureDimensionOperation(
                              objects,
                              group,
                              i,
                              n,
                            ),
                            snap: false,
                          });
                        else
                          execute(
                            precisionUpdate(objects, o, dimensionPatch(o, i, n))
                              .command,
                          );
                      })
                    }
                  />
                ))}
              {!group &&
                (["position", "rotation", "scale"] as const).map((property) =>
                  ["X", "Y", "Z"].map((axis, i) => (
                    <Numeric
                      key={property + axis}
                      label={property + " " + axis}
                      value={
                        o[property][i] *
                        (property === "rotation" ? 180 / Math.PI : 1)
                      }
                      step={property === "rotation" ? 1 : 0.1}
                      onApply={(n) =>
                        run(() => {
                          const v = [...o[property]] as Vec3;
                          v[i] =
                            n * (property === "rotation" ? Math.PI / 180 : 1);
                          execute(
                            precisionUpdate(objects, o, { [property]: v })
                              .command,
                          );
                        })
                      }
                    />
                  )),
                )}
            </div>
            {!group && (
              <button
                onClick={() =>
                  run(() =>
                    execute(
                      precisionUpdate(objects, o, {
                        position: floorPosition(o, objects),
                      }).command,
                    ),
                  )
                }
              >
                Align to floor
              </button>
            )}
            {!group && !o.construction && (
              <details>
                <summary>Align to an object edge</summary>
                <label className="field">
                  Reference object
                  <select
                    aria-label="Alignment reference"
                    value={edgeTarget}
                    onChange={(e) => setEdgeTarget(e.target.value)}
                  >
                    <option value="">Choose object</option>
                    {objects
                      .filter((v) => v.id !== o.id && !v.construction)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="object-actions">
                  {(["left", "right", "front", "back"] as const).map((edge) => (
                    <button
                      key={edge}
                      disabled={!edgeTarget}
                      onClick={() =>
                        run(() => {
                          const target = objects.find(
                            (v) => v.id === edgeTarget,
                          );
                          if (!target)
                            throw Error("Choose an existing reference object.");
                          execute(
                            precisionUpdate(objects, o, {
                              position: edgePosition(o, target, edge),
                            }).command,
                          );
                        })
                      }
                    >
                      Align {edge}
                    </button>
                  ))}
                </div>
                <p className="muted">
                  Axis-aligned standalone box faces only. Collisions remain
                  rejected.
                </p>
              </details>
            )}
            <fieldset>
              <legend>Precision preferences</legend>
              <label className="toggle">
                <input
                  type="checkbox"
                  aria-label="Precision grid snapping"
                  checked={snap}
                  onChange={(e) =>
                    useSceneStore.setState({ snap: e.target.checked })
                  }
                />
                Grid snapping
              </label>
              <label className="field">
                Grid increment (m)
                <select
                  aria-label="Grid increment"
                  value={step}
                  onChange={(e) =>
                    precisionSettings({ gridStep: Number(e.target.value) })
                  }
                >
                  {[0.05, 0.1, 0.25, 0.5, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} m
                    </option>
                  ))}
                </select>
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={measurements}
                  onChange={(e) =>
                    precisionSettings({ measurements: e.target.checked })
                  }
                />
                Show measurements
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={guides}
                  onChange={(e) =>
                    precisionSettings({ guides: e.target.checked })
                  }
                />
                Show manipulation guides
              </label>
            </fieldset>
            <div className="legacy-advanced">
              <LegacyObjectInspector precision />
            </div>
          </div>
          <p className="muted" role="status">
            {status}
          </p>
        </>
      )}
    </section>
  );
}
