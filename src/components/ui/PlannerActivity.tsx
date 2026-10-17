import { useEffect, useState } from "react";
import { usePlannerProgress } from "../../generation/plannerTransport";
export function PlannerActivity() {
  const p = usePlannerProgress(),
    [now, setNow] = useState(0);
  const active = [
    "Connecting",
    "Loading Model",
    "Generating",
    "Validating",
  ].includes(p.stage);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(timer);
  }, [active]);
  if (p.stage === "Idle" && !p.provider) return null;
  const elapsed =
    active && p.started ? Math.max(p.elapsedMs, now - p.started) : p.elapsedMs;
  return (
    <p role="status" aria-label="Planner activity" className="planner-activity">
      {p.provider || "Planner"} · {p.stage}
      {elapsed > 0 ? ` · ${(elapsed / 1000).toFixed(1)} s` : ""}
    </p>
  );
}
export function PlannerTimings() {
  const t = usePlannerProgress((s) => s.timings);
  if (!t)
    return (
      <p className="muted">
        Request measurements appear after an LLM response.
      </p>
    );
  const n = (v: number | null) =>
    v === null ? "unavailable" : `${(v / 1000).toFixed(2)} s`;
  return (
    <dl aria-label="Planner timings">
      <dt>First content token</dt>
      <dd>{n(t.firstTokenMs)}</dd>
      <dt>Provider headers</dt>
      <dd>{n(t.headerMs)}</dd>
      <dt>Provider total</dt>
      <dd>{n(t.providerMs)}</dd>
      <dt>Server validation</dt>
      <dd>{n(t.validationMs)}</dd>
      <dt>Backend end to end</dt>
      <dd>{n(t.totalMs)}</dd>
      <dt>Client schema/materialization</dt>
      <dd>{n(t.clientValidationMs ?? null)}</dd>
      <dt>Client request + validation</dt>
      <dd>{n(t.clientTotalMs ?? null)}</dd>
      <dt>Model loading</dt>
      <dd>Unavailable on compatible transport</dd>
      <dt>Resident before request</dt>
      <dd>
        {t.residentBefore === undefined || t.residentBefore === null
          ? "unknown"
          : String(t.residentBefore)}
      </dd>
    </dl>
  );
}
