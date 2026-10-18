import { create } from "zustand";
export interface PlannerTimings {
  firstTokenMs: number | null;
  headerMs: number;
  providerMs: number;
  validationMs: number;
  totalMs: number;
  modelLoadMs: number | null;
  clientValidationMs?: number;
  clientTotalMs?: number;
  residentBefore?: boolean | null;
  residentVramBytes?: number | null;
}
export const usePlannerProgress = create(() => ({
  stage: "Idle",
  started: 0,
  elapsedMs: 0,
  provider: "",
  timings: null as PlannerTimings | null,
}));
export function plannerStage(stage: string, provider?: string) {
  const s = usePlannerProgress.getState();
  if (stage === "Idle") {
    usePlannerProgress.setState({
      stage,
      provider: "",
      started: 0,
      elapsedMs: 0,
      timings: null,
    });
    return;
  }
  usePlannerProgress.setState({
    stage,
    ...(provider ? { provider } : {}),
    ...(s.started
      ? { elapsedMs: performance.now() - s.started }
      : { started: performance.now() }),
  });
}
// Fetch/SSE work in browsers that predate AbortSignal.any/timeout.
export function plannerDeadline(
  signal: AbortSignal | undefined,
  milliseconds: number,
) {
  const combined = new AbortController();
  const cancel = () => combined.abort(signal?.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(
    () => combined.abort(new DOMException("Planner deadline", "TimeoutError")),
    milliseconds,
  );
  return {
    signal: combined.signal,
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    },
  };
}
export function plannerFailure(
  data: { error?: unknown; requestId?: unknown } | null,
  response?: Response,
): Error {
  const retry = Number(response?.headers.get("retry-after"));
  const seconds =
    Number.isFinite(retry) && retry > 0 && retry <= 172800
      ? Math.ceil(retry)
      : 60;
  const message =
    typeof data?.error === "string"
      ? data.error.slice(0, 300)
      : response?.status === 429
        ? "Too many requests; retry in " + seconds + " seconds or use Offline."
        : "Planner request failed" +
          (response ? " (HTTP " + response.status + ")" : "") +
          ". Retry or choose Offline.";
  const id =
    typeof data?.requestId === "string"
      ? data.requestId
      : response?.headers.get("x-request-id");
  return Error(
    message +
      (id && /^[a-zA-Z0-9-]{1,80}$/.test(id) ? " Reference: " + id : ""),
  );
}
export async function plannerRequest(
  path: string,
  body: { timeoutMs?: number; [key: string]: unknown },
  signal?: AbortSignal,
): Promise<{
  requestId?: string;
  source: string;
  model: string;
  provider?: string;
  plan: unknown;
  timings?: PlannerTimings;
}> {
  const started = performance.now();
  usePlannerProgress.setState({
    stage: "Connecting",
    started,
    elapsedMs: 0,
    provider: "LLM",
    timings: null,
  });
  const budget = body.timeoutMs ?? 120000;
  const deadline = plannerDeadline(signal, budget + 2000);
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ ...body, timeoutMs: budget }),
      signal: deadline.signal,
    });
    let result;
    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      const reader = response.body?.getReader();
      if (!reader) throw Error("Planner returned no stream.");
      const decoder = new TextDecoder();
      let pending = "",
        bytes = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 1048576) throw Error("Planner response exceeds limit.");
          pending += decoder.decode(value, { stream: true }).replace(/\r/g, "");
          let boundary;
          while ((boundary = pending.indexOf("\n\n")) >= 0) {
            const event = pending.slice(0, boundary);
            pending = pending.slice(boundary + 2);
            const type = event
                .split("\n")
                .find((l) => l.startsWith("event:"))
                ?.slice(6)
                .trim(),
              text = event
                .split("\n")
                .filter((l) => l.startsWith("data:"))
                .map((l) => l.slice(5).trim())
                .join("\n");
            if (!text) continue;
            const data = JSON.parse(text);
            if (type === "error") throw plannerFailure(data, response);
            if (type === "progress" && !signal?.aborted)
              usePlannerProgress.setState({
                stage: data.stage,
                elapsedMs: performance.now() - started,
                ...(data.provider ? { provider: data.provider } : {}),
              });
            if (type === "result") result = data;
          }
        }
      } catch (error) {
        await reader.cancel().catch(() => {});
        throw error;
      }
    } else {
      result = await response.json().catch(() => null);
      if (!response.ok) throw plannerFailure(result, response);
    }
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    if (!result) throw Error("Planner ended without a validated result.");
    usePlannerProgress.setState({
      stage: "Validating",
      elapsedMs: performance.now() - started,
      provider: result.provider ?? "LLM",
      timings: result.timings ?? null,
    });
    return result;
  } catch (error) {
    if (signal?.aborted) throw error;
    usePlannerProgress.setState({
      stage: "Error",
      elapsedMs: performance.now() - started,
    });
    if (error instanceof DOMException && error.name === "TimeoutError")
      throw Error(
        `Client planner time budget exceeded (${budget / 1000} s plus transport grace).`,
      );
    if (error instanceof TypeError)
      throw Error(
        "Cannot reach the planner. Check your connection, reload this page, or choose Offline.",
      );
    throw error;
  } finally {
    deadline.dispose();
  }
}

export function recordClientValidation(started: number) {
  const p = usePlannerProgress.getState();
  if (p.timings)
    usePlannerProgress.setState({
      timings: {
        ...p.timings,
        clientValidationMs: performance.now() - started,
        clientTotalMs: performance.now() - p.started,
      },
    });
}
