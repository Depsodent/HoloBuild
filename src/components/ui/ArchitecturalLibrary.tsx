import { standaloneFlight, nativeSupport } from "../../scene/nativeAssemblies";
import { validateStructure } from "../../scene/structures";
import { prepareComponentCommand } from "../../generation/editStore";
import { useState } from "react";
import { Layers, RectangleHorizontal, Plus } from "lucide-react";
import { useSceneStore } from "../../scene/sceneStore";
import { members, structureIds, structureInfo } from "../../scene/structures";
import {
  insertStaircase,
  insertBalcony,
} from "../../generation/libraryOperations";
import { requestEdit, useEditStore } from "../../generation/editStore";
import { openTools, useToolsStore } from "../../workspace/toolsStore";
import {
  MATERIAL_IDS,
  MATERIAL_PRESETS,
  type MaterialId,
} from "../../scene/materialPresets";
import type { Balcony, Staircase } from "../../../shared/planSchema.mjs";
export function ArchitecturalLibrary() {
  const objects = useSceneStore((s) => s.objects);
  const [stairMode, setStairMode] = useState<"standalone" | "connected">(
      "connected",
    ),
    [rise, setRise] = useState(3.2),
    [base, setBase] = useState(0);
  const [kind, setKind] = useState<"stairs" | "balcony" | null>(null),
    [host, setHost] = useState("");
  const [level, setLevel] = useState(1),
    [width, setWidth] = useState(1),
    [run, setRun] = useState(0.2),
    [steps, setSteps] = useState(16),
    [x, setX] = useState(-1.5),
    [z, setZ] = useState(0),
    [yaw, setYaw] = useState(0),
    [facade, setFacade] = useState<Balcony["facade"]>("front"),
    [offset, setOffset] = useState(0),
    [depth, setDepth] = useState(1.5),
    [rail, setRail] = useState(1.1),
    [material, setMaterial] = useState<MaterialId>("concrete"),
    [color, setColor] = useState("#aab5c2"),
    [message, setMessage] = useState("");
  const buildings = structureIds(objects).flatMap((id) => {
    const info = structureInfo(members(objects, id)),
      recipe = info.template ?? info.architectureTemplate;
    return recipe && recipe.kind !== "bridge" && recipe.floors >= 2
      ? [{ id, info, recipe }]
      : [];
  });
  const current = buildings.find((b) => b.id === host);
  function choose(type: "stairs" | "balcony") {
    const state = useSceneStore.getState(),
      preferred =
        state.selectedStructureId ??
        state.objects.find((o) => o.id === state.selectedId)?.construction
          ?.structureId;
    setKind(type);
    if (type === "stairs")
      setStairMode(buildings.length ? "connected" : "standalone");
    setWidth(type === "stairs" ? 1 : 2.4);
    setHost(
      buildings.some((b) => b.id === preferred)
        ? preferred!
        : buildings.length === 1
          ? buildings[0].id
          : "",
    );
    setMessage("");
  }
  const field = (
    name: string,
    value: number,
    set: (n: number) => void,
    step = 0.1,
  ) => (
    <label className="field">
      {name}
      <input
        aria-label={"Library " + name}
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          if (e.target.value !== "") set(Number(e.target.value));
        }}
      />
    </label>
  );
  return (
    <>
      {(["stairs", "balcony"] as const).map((type) => {
        const Icon = type === "stairs" ? Layers : RectangleHorizontal;
        const name = type === "stairs" ? "Stairs" : "Balcony";
        return (
          <button
            key={type}
            className="shape"
            title={"Create " + name}
            aria-label={name + " connected architectural assembly"}
            onClick={() => choose(type)}
          >
            <Icon size={22} />
            <span>
              {name}
              <small>
                {type === "stairs" ? "Standalone / floors" : "Attach to facade"}
              </small>
            </span>
            <Plus size={14} />
          </button>
        );
      })}
      {kind && (
        <form
          className="architectural-insertion"
          aria-label="Architectural insertion"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              if (kind === "stairs" && stairMode === "standalone") {
                const parts = standaloneFlight(
                  { steps, height: rise, run, width, material, color },
                  [x, base, z],
                  (yaw * Math.PI) / 180,
                );
                validateStructure(parts, objects);
                nativeSupport(parts, objects);
                prepareComponentCommand(
                  { type: "construct", objects: parts },
                  [...objects, ...parts],
                  parts,
                  "Standalone staircase: no automatic floor connection or opening. Review support and placement.",
                );
                useToolsStore.setState({ aiView: "main" });
                openTools("ai");
                return;
              }
              if (!current)
                throw Error("Choose a compatible multi-floor building first.");
              const operation =
                kind === "stairs"
                  ? insertStaircase(current.recipe, {
                      from: level - 1,
                      to: level,
                      steps,
                      run,
                      width,
                      x,
                      z,
                      yaw: yaw as Staircase["yaw"],
                      material,
                      color,
                    })
                  : insertBalcony(current.recipe, {
                      level,
                      facade,
                      offset,
                      width,
                      depth,
                      railHeight: rail,
                      material,
                      color,
                    });
              useSceneStore.getState().setSelectionMode("structure");
              useSceneStore.getState().select(members(objects, host)[0].id);
              await requestEdit(
                "Insert library " + kind,
                { mode: "offline" },
                operation,
                true,
              );
              const result = useEditStore.getState();
              if (result.status !== "preview") throw Error(result.message);
              useToolsStore.setState({ aiView: "main" });
              openTools("ai");
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Invalid attachment; scene unchanged.",
              );
            }
          }}
        >
          <h3>Add {kind === "stairs" ? "Stairs" : "Balcony"}</h3>
          {kind === "stairs" && (
            <label className="field">
              Stair configuration
              <select
                aria-label="Stair configuration"
                value={stairMode}
                onChange={(e) =>
                  setStairMode(e.target.value as "standalone" | "connected")
                }
              >
                <option value="standalone">Standalone Stairs</option>
                <option value="connected">Connect Floors</option>
              </select>
            </label>
          )}
          <div hidden={kind === "stairs" && stairMode === "standalone"}>
            <label className="field">
              Building
              <select
                aria-label="Library building"
                value={host}
                onChange={(e) => {
                  setHost(e.target.value);
                  setLevel(1);
                }}
              >
                <option value="">Select a building</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.info.name}
                  </option>
                ))}
              </select>
            </label>
            {!buildings.length && (
              <p className="muted">
                Create or load a multi-floor building first. These connected
                assemblies require real floors. Choose Standalone Stairs for a
                freestanding flight.
              </p>
            )}
            <label className="field">
              Destination floor
              <select
                aria-label="Library floor"
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
              >
                {Array.from(
                  { length: (current?.recipe.floors ?? 2) - 1 },
                  (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Floor {i + 2}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          <div className="precision-grid">
            {field("Width", width, setWidth)}
            {kind === "stairs" ? (
              <>
                {field("Step count", steps, setSteps, 1)}
                {field("Step run", run, setRun, 0.05)}
                {field("X", x, setX)}
                {field("Z", z, setZ)}
                <label className="field">
                  Orientation
                  <select
                    aria-label="Library orientation"
                    value={yaw}
                    onChange={(e) => setYaw(Number(e.target.value))}
                  >
                    {[0, 90, 180, 270].map((v) => (
                      <option key={v} value={v}>
                        {v}°
                      </option>
                    ))}
                  </select>
                </label>
                {stairMode === "standalone" ? (
                  <>
                    {field("Overall rise", rise, setRise, 0.1)}
                    {field("Base elevation", base, setBase, 0.1)}
                  </>
                ) : (
                  <label>
                    Overall rise (m)
                    <output>
                      {((current?.recipe.height ?? 3) + 0.2).toFixed(2)}
                    </output>
                  </label>
                )}
              </>
            ) : (
              <>
                {field("Depth", depth, setDepth)}
                {field("Rail height", rail, setRail)}
                {field("Offset", offset, setOffset)}
                <label className="field">
                  Facade
                  <select
                    aria-label="Library facade"
                    value={facade}
                    onChange={(e) =>
                      setFacade(e.target.value as Balcony["facade"])
                    }
                  >
                    {["front", "back", "left", "right"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
          <label className="field">
            Material
            <select
              aria-label="Library material"
              value={material}
              onChange={(e) => setMaterial(e.target.value as MaterialId)}
            >
              {MATERIAL_IDS.map((m) => (
                <option key={m} value={m}>
                  {MATERIAL_PRESETS[m].label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Color
            <input
              aria-label="Library color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          <p className="muted">
            Metres. Preview validates landings, openings and attachment.
            Rise/elevation follow the selected floors; edit building parameters
            for a different rise. Visual design only.
          </p>
          <div className="object-actions">
            <button
              disabled={
                !current && !(kind === "stairs" && stairMode === "standalone")
              }
            >
              Preview library {kind}
            </button>
            <button type="button" onClick={() => setKind(null)}>
              Close insertion
            </button>
          </div>
          <p role="status">{message}</p>
        </form>
      )}
    </>
  );
}
