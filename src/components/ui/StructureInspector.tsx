import { useState } from "react";
import { Vector3 } from "three";
import { Accordion } from "./Accordion";
import { useSceneStore } from "../../scene/sceneStore";
import { execute } from "../../scene/commandManager";
import { members, structureInfo, structureBox } from "../../scene/structures";
import {
  MATERIAL_IDS,
  MATERIAL_PRESETS,
  type MaterialId,
} from "../../scene/materialPresets";
import type { Vec3 } from "../../scene/objectTypes";
import type { StructureOperation } from "../../../shared/editSchema.mjs";
import { useAccordionStore } from "../../workspace/accordionStore";
import { updateGeneration } from "../../generation/generationStore";
export function SelectionMode() {
  const mode = useSceneStore((s) => s.selectionMode);
  return (
    <label className="field">
      Selection
      <select
        aria-label="Selection mode"
        value={mode}
        onChange={(e) =>
          useSceneStore
            .getState()
            .setSelectionMode(e.target.value as "component" | "structure")
        }
      >
        <option value="component">Select Component</option>
        <option value="structure">Select Entire Structure</option>
      </select>
    </label>
  );
}
export function StructureInspector({ id }: { id: string }) {
  const objects = useSceneStore((s) => s.objects),
    parts = members(objects, id),
    info = structureInfo(parts);
  const [role, setRole] = useState("wall"),
    [level, setLevel] = useState(0);
  const activeLevel = Math.min(
    level,
    Math.max(0, (info.template?.floors ?? 1) - 1),
  );
  const size = structureBox(parts).getSize(new Vector3());
  const run = (operation: StructureOperation) =>
    execute({ type: "structure", structureId: id, operation });
  const transform = (
    patch: Partial<{ position: Vec3; yaw: number; scale: Vec3 }>,
  ) =>
    run({
      type: "setTransform",
      position: info.position,
      yaw: info.yaw,
      scale: info.scale,
      ...patch,
    });
  return (
    <aside className="panel inspector" aria-label="Structure Inspector">
      <div className="eyebrow">STRUCTURE INSPECTOR</div>
      <SelectionMode />
      <h2>{info.name}</h2>
      <div className="object-id">
        {info.type.toUpperCase()} <span>WHOLE STRUCTURE</span>
      </div>
      <p className="muted">
        {parts.length} components ·{" "}
        {size
          .toArray()
          .map((v) => v.toFixed(2))
          .join(" × ")}{" "}
        m
      </p>
      <div className="object-actions">
        <button onClick={() => run({ type: "duplicate" })}>
          Duplicate structure
        </button>
        <button onClick={() => run({ type: "delete" })}>
          Delete structure
        </button>
      </div>
      <Accordion id="structure.transform" title="Structure Transform">
        <label className="field">
          Name
          <input
            aria-label="Structure name"
            key={info.name}
            defaultValue={info.name}
            maxLength={60}
            onBlur={(e) => {
              if (e.target.value !== info.name)
                run({ type: "rename", name: e.target.value });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </label>
        {(["position", "scale"] as const).map((key) => (
          <fieldset key={key}>
            <legend>{key}</legend>
            <div className="vector">
              {["X", "Y", "Z"].map((axis, i) => (
                <label key={axis}>
                  {axis}
                  <input
                    type="number"
                    aria-label={`Structure ${key} ${axis}`}
                    step={key === "scale" ? 0.1 : 0.5}
                    value={Number(info[key][i].toFixed(3))}
                    onChange={(e) => {
                      if (e.target.value !== "") {
                        const v = [...info[key]] as Vec3;
                        v[i] = Number(e.target.value);
                        transform({ [key]: v });
                      }
                    }}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <label className="field">
          Yaw · degrees
          <input
            type="number"
            aria-label="Structure yaw"
            step={15}
            value={Number(((info.yaw * 180) / Math.PI).toFixed(2))}
            onChange={(e) => {
              if (e.target.value !== "")
                transform({
                  yaw: Math.atan2(
                    Math.sin((Number(e.target.value) * Math.PI) / 180),
                    Math.cos((Number(e.target.value) * Math.PI) / 180),
                  ),
                });
            }}
          />
        </label>
      </Accordion>
      <Accordion
        id="structure.components"
        title={`Components · ${parts.length}`}
      >
        <div className="scene-list">
          {parts.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                const s = useSceneStore.getState();
                s.setSelectionMode("component");
                s.select(o.id);
              }}
            >
              {o.name.split(" / ").at(-1)}
              <small>
                {o.construction!.role}
                {o.construction!.level === undefined
                  ? ""
                  : ` / L${o.construction!.level + 1}`}
              </small>
            </button>
          ))}
        </div>
      </Accordion>
      <Accordion id="structure.materials" title="Materials">
        <p className="muted">
          {[
            ...new Set(parts.map((o) => MATERIAL_PRESETS[o.material].label)),
          ].join(", ")}
        </p>
        <label className="field">
          Apply to
          <select
            aria-label="Structure material target"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="all">All components</option>
            {[...new Set(parts.map((o) => o.construction!.role))].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Material
          <select
            aria-label="Structure material"
            value=""
            onChange={(e) =>
              run({
                type: "material",
                material: e.target.value as MaterialId,
                ...(role === "all" ? {} : { role: role as "wall" }),
              })
            }
          >
            <option value="" disabled>
              Choose material
            </option>
            {MATERIAL_IDS.map((m) => (
              <option key={m} value={m}>
                {MATERIAL_PRESETS[m].label}
              </option>
            ))}
          </select>
        </label>
      </Accordion>
      <Accordion id="structure.ai" title="AI Edit">
        <button
          onClick={() => {
            updateGeneration({
              prompt: "Change all walls in this structure to brick",
            });
            useAccordionStore.getState().setOpen("tools.voice", true);
          }}
        >
          Edit in Ask HoloBuild
        </button>
        <p className="muted">Review each modification before confirming.</p>
      </Accordion>
      <Accordion id="structure.advanced" title="Advanced">
        {info.template &&
        ["house", "tower", "office"].includes(info.template.kind) ? (
          <>
            <p>
              {info.template.floors} floors · {info.template.height} m storeys
            </p>
            <div className="object-actions">
              <button onClick={() => run({ type: "floors", action: "add" })}>
                Add floor
              </button>
              <button
                disabled={info.template.floors <= 1}
                onClick={() => run({ type: "floors", action: "remove" })}
              >
                Remove top floor
              </button>
            </div>
            <label className="field">
              Source floor
              <select
                aria-label="Source floor"
                value={activeLevel}
                onChange={(e) => setLevel(Number(e.target.value))}
              >
                {Array.from({ length: info.template.floors }, (_, i) => (
                  <option key={i} value={i}>
                    Floor {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() =>
                run({ type: "floors", action: "duplicate", level: activeLevel })
              }
            >
              Duplicate floor on top
            </button>
            <label className="field">
              Storey height
              <input
                type="number"
                aria-label="Storey height"
                min={2.5}
                max={5}
                step={0.5}
                value={info.template.height}
                onChange={(e) => {
                  if (e.target.value !== "")
                    run({
                      type: "floors",
                      action: "height",
                      height: Number(e.target.value),
                    });
                }}
              />
            </label>
            <button
              onClick={() =>
                run({
                  type: "material",
                  role: "floor",
                  level: activeLevel,
                  material: "concrete",
                })
              }
            >
              Concrete on source floor slab
            </button>
          </>
        ) : (
          <p className="muted">
            Floor layout editing is unavailable for this geometry.
          </p>
        )}
        <button onClick={() => run({ type: "ungroup" })}>
          Ungroup structure
        </button>
        <p className="muted object-reference">ID: {id}</p>
      </Accordion>
    </aside>
  );
}
