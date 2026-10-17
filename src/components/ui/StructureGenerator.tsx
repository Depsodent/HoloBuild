import { openTools } from "../../workspace/toolsStore";
import { PlannerTimings } from "./PlannerActivity";
import { useEffect, useRef, useState } from "react";
import { Accordion } from "./Accordion";
import {
  useGenerationStore,
  updateGeneration,
  planStructure,
  cancelGeneration,
  confirmStructure,
} from "../../generation/generationStore";
import { plannerStatus, type PlannerStatus } from "../../generation/planner";
import type { OfflineOptions } from "../../generation/offline";
import { useSceneStore } from "../../scene/sceneStore";
import {
  MATERIAL_IDS,
  MATERIAL_PRESETS,
  type MaterialId,
} from "../../scene/materialPresets";

const examples = [
  "Build a small house with four walls and a roof",
  "Create a modern two-story house with windows",
  "Generate a room with a floor, four walls, and a doorway",
  "Build a tower with five levels",
  "Create a warehouse with a metal roof",
  "Generate a bridge supported by pillars",
  "Build a garden shed with wooden walls",
];
export function StructureGenerator({
  view = "main",
}: {
  view?: "main" | "settings" | "help";
}) {
  const s = useGenerationStore(),
    objects = useSceneStore((state) => state.objects),
    preview = useSceneStore((state) => !!state.preview);
  const [connection, setConnection] = useState<PlannerStatus | null>(null),
    [status, setStatus] = useState(
      "Backend not checked. Offline works without it.",
    ),
    [checking, setChecking] = useState(false);
  const check = useRef<AbortController | null>(null);
  useEffect(() => () => check.current?.abort(), []);
  useEffect(() => {
    const abort = new AbortController();
    void plannerStatus(
      false,
      AbortSignal.any([abort.signal, AbortSignal.timeout(3000)]),
    )
      .then((config) => {
        if (abort.signal.aborted) return;
        setConnection(config);
        const current = useGenerationStore.getState();
        if (current.status !== "planning")
          useGenerationStore.setState({
            timeoutMs: Math.min(current.timeoutMs, config.timeoutMs),
            model: current.model || config.model,
          });
      })
      .catch(() => {
        /* Offline remains available; explicit connection check reports errors. */
      });
    return () => abort.abort();
  }, []);
  async function connect() {
    check.current?.abort();
    const controller = new AbortController();
    check.current = controller;
    setChecking(true);
    setStatus("Checking backend…");
    try {
      const config = await plannerStatus(
        false,
        AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
      );
      const next = config.configured
        ? await plannerStatus(
            true,
            AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]),
          )
        : config;
      if (controller.signal.aborted) return;
      setConnection(next);
      setStatus(
        next.configured
          ? next.connection
          : "No model configured. Set backend LLM_MODEL; Offline is available.",
      );
      updateGeneration({
        model: next.model,
        timeoutMs: Math.min(s.timeoutMs, next.timeoutMs),
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        setConnection(null);
        setStatus(
          error instanceof Error
            ? error.message
            : "Backend unavailable. Choose Offline.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setChecking(false);
    }
  }
  const stale = !!s.prepared && (objects !== s.prepared.base || !!preview);
  const materialCounts = new Map<string, number>();
  s.prepared?.objects.forEach((o) =>
    materialCounts.set(o.material, (materialCounts.get(o.material) ?? 0) + 1),
  );
  return (
    <>
      <div className="structure-generator">
        {(s.status === "error" ||
          s.status === "complete" ||
          s.message.startsWith("Plan cancelled") ||
          s.message.startsWith("Scene changed")) && (
          <p role="status" aria-label="Generation result">
            {s.message}
          </p>
        )}
        {s.notice && s.prepared && (
          <p className="muted" aria-label="Planner source">
            {s.notice}
          </p>
        )}
        {s.status === "complete" &&
          objects.some(
            (o) => o.construction?.structureId === s.lastStructureId,
          ) && (
            <button
              onClick={() => {
                useSceneStore.getState().setSelectionMode("structure");
                useSceneStore
                  .getState()
                  .select(
                    objects.find(
                      (o) => o.construction?.structureId === s.lastStructureId,
                    )!.id,
                  );
                openTools("edit");
              }}
            >
              Edit Structure
            </button>
          )}
        {(s.status === "planning" || s.prepared) && (
          <button
            onClick={() => {
              cancelGeneration();
              useGenerationStore.setState({ prompt: "" });
            }}
          >
            Cancel generation
          </button>
        )}
        {s.prepared && (
          <section
            className="construction-review"
            aria-label="Construction plan preview"
          >
            <strong>{s.prepared.plan.name}</strong>
            <p className="muted">Preview only · nonselectable</p>
            <button
              onClick={() =>
                window.dispatchEvent(new Event("holobuild:fit-structure"))
              }
            >
              Fit structure in view
            </button>
            <p>
              {s.prepared.objects.length} components ·{" "}
              {s.source === "llm" ? "LLM" : "Offline"}
            </p>
            <p>
              Approx.{" "}
              {s.prepared.dimensions.map((v) => v.toFixed(2)).join(" × ")} m
            </p>
            <p>Origin: {s.prepared.origin.join(", ")} m (world X, Y, Z)</p>
            <p>
              {[...materialCounts]
                .map(
                  ([id, n]) =>
                    `${MATERIAL_PRESETS[id as MaterialId].label}: ${n}`,
                )
                .join(" · ")}
            </p>
            <ul aria-label="Plan warnings">
              {s.prepared.plan.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <details>
              <summary>Generated components</summary>
              <ul className="component-list">
                {s.prepared.plan.objects.map((o) => (
                  <li key={o.id}>
                    {o.id} · {o.name} · {o.role} · {o.dimensions.join("×")} m
                  </li>
                ))}
              </ul>
            </details>
            <label>
              <input
                type="checkbox"
                checked={s.ghost}
                onChange={(e) =>
                  useGenerationStore.setState({ ghost: e.target.checked })
                }
              />{" "}
              Ghost preview in workspace
            </label>
            {stale && (
              <p className="command-error">
                Scene changed or manipulation active. Regenerate before
                confirming.
              </p>
            )}
            <button
              disabled={stale}
              onClick={() => {
                confirmStructure();
                if (useGenerationStore.getState().status === "complete")
                  useGenerationStore.setState({ prompt: "" });
              }}
            >
              Confirm construction
            </button>
            <button onClick={() => void planStructure()}>
              Regenerate plan
            </button>
          </section>
        )}
        <div hidden={view !== "settings"}>
          <Accordion id="tools.generator-parameters" title="Offline parameters">
            <p className="muted">
              Leave blank to use prompt/defaults. Controls apply to Offline
              only.
            </p>
            {(
              [
                ["width", "Width (m)", 3, 20, 0.1],
                ["depth", "Depth (m)", 2, 20, 0.1],
                ["height", "Storey height (m)", 2.5, 5, 0.1],
                ["floors", "Floor count", 1, 6, 1],
                ["thickness", "Wall thickness (m)", 0.1, 0.4, 0.05],
                ["doors", "Door count", 0, 2, 1],
                ["windows", "Windows per storey", 0, 4, 1],
              ] as const
            ).map(([key, label, min, max, step]) => (
              <label key={key}>
                {label}
                <input
                  aria-label={label}
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={s.options[key] ?? ""}
                  placeholder="Auto"
                  onChange={(e) =>
                    updateGeneration({
                      options: {
                        ...s.options,
                        [key]:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            ))}
            <label>
              Wall / deck material
              <select
                aria-label="Offline surface material"
                value={s.options.material ?? ""}
                onChange={(e) =>
                  updateGeneration({
                    options: {
                      ...s.options,
                      material: (e.target.value || undefined) as
                        MaterialId | undefined,
                    },
                  })
                }
              >
                <option value="">Auto</option>
                {MATERIAL_IDS.map((id) => (
                  <option key={id} value={id}>
                    {MATERIAL_PRESETS[id].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Roof style
              <select
                aria-label="Offline roof style"
                value={s.options.roof ?? ""}
                onChange={(e) =>
                  updateGeneration({
                    options: {
                      ...s.options,
                      roof: (e.target.value ||
                        undefined) as OfflineOptions["roof"],
                    },
                  })
                }
              >
                <option value="">Auto</option>
                <option value="flat">Flat</option>
                <option value="none">None</option>
              </select>
            </label>
            <button onClick={() => updateGeneration({ options: {} })}>
              Reset offline parameters
            </button>
          </Accordion>
        </div>
      </div>
      <div hidden={view !== "settings"}>
        <PlannerTimings />
        <Accordion id="tools.ai-settings" title="AI Settings">
          <div className="structure-generator">
            <p role="status" aria-label="Model connection">
              {status}
            </p>
            <button disabled={checking} onClick={() => void connect()}>
              Check model connection
            </button>
            <p>
              {connection?.provider ??
                "Optional backend · loopback only by default"}
            </p>
            <label>
              Configured model
              <select
                aria-label="Configured model"
                value={s.model}
                disabled={!connection?.models.length}
                onChange={(e) => updateGeneration({ model: e.target.value })}
              >
                <option value="">Backend default</option>
                {connection?.models.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              Timeout (seconds)
              <input
                aria-label="Planner timeout seconds"
                type="number"
                min={1}
                max={Math.min(120, (connection?.timeoutMs ?? 120000) / 1000)}
                value={s.timeoutMs / 1000}
                onChange={(e) =>
                  updateGeneration({ timeoutMs: Number(e.target.value) * 1000 })
                }
              />
            </label>
            <p className="muted">
              Start optional service: npm run planner. Provider URL, model
              allowlist and keys are backend .env settings. No keys belong in
              this panel or project exports. No model download is automatic.
            </p>
          </div>
        </Accordion>
      </div>
      <div hidden={view !== "help"}>
        <Accordion id="tools.ai-examples" title="Structure Examples">
          <div className="structure-examples">
            {examples.map((text) => (
              <button
                key={text}
                onClick={() => {
                  updateGeneration({ prompt: text });
                  openTools("ai");
                }}
              >
                {text}
              </button>
            ))}
          </div>
        </Accordion>
      </div>
    </>
  );
}
