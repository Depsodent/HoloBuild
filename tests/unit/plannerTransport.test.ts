import { afterEach, expect, it, vi } from "vitest";
import {
  plannerRequest,
  usePlannerProgress,
  plannerStage,
} from "../../src/generation/plannerTransport";
import { plannerPreferences } from "../../src/generation/plannerPreferences";
afterEach(() => {
  vi.unstubAllGlobals();
  plannerStage("Idle");
});
it("defaults to 120s with 2s transport grace and reports streamed source/metrics", async () => {
  const timeout = vi.spyOn(AbortSignal, "timeout");
  const timings = {
    firstTokenMs: 28,
    providerMs: 99,
    validationMs: 2,
    totalMs: 101,
    headerMs: 4,
    modelLoadMs: null,
  };
  const mock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(
        `event: progress\ndata: {"stage":"Loading Model","provider":"Ollama"}\n\nevent: result\ndata: ${JSON.stringify({ source: "llm", model: "test", provider: "Ollama", plan: { version: 1 }, timings })}\n\n`,
        { headers: { "content-type": "text/event-stream" } },
      ),
    );
  vi.stubGlobal("fetch", mock);
  expect(plannerPreferences().timeoutMs).toBe(120000);
  const result = await plannerRequest("/api/planner/plan", {
    prompt: "build a house",
  });
  expect(timeout).toHaveBeenCalledWith(122000);
  expect(JSON.parse(String(mock.mock.calls[0][1]?.body))).toMatchObject({
    timeoutMs: 120000,
  });
  expect(result.provider).toBe("Ollama");
  expect(usePlannerProgress.getState().timings).toEqual(timings);
  timeout.mockRestore();
});
it("reports server timeout separately from network failure and rejects incomplete streams", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        'event: error\ndata: {"error":"Backend/provider time budget exceeded."}\n\n',
        { headers: { "content-type": "text/event-stream" } },
      ),
  );
  await expect(plannerRequest("/api/planner/plan", {})).rejects.toThrow(
    "time budget",
  );
  vi.stubGlobal("fetch", async () => {
    throw new TypeError("fetch failed");
  });
  await expect(plannerRequest("/api/planner/plan", {})).rejects.toThrow(
    "connection failed",
  );
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response('event: progress\ndata: {"stage":"Generating"}\n\n', {
        headers: { "content-type": "text/event-stream" },
      }),
  );
  await expect(plannerRequest("/api/planner/plan", {})).rejects.toThrow(
    "without a validated result",
  );
});
it("late result after cancellation cannot be accepted", async () => {
  const abort = new AbortController();
  vi.stubGlobal("fetch", async () => {
    abort.abort();
    return Response.json({ source: "llm", plan: {} });
  });
  await expect(
    plannerRequest("/api/planner/plan", {}, abort.signal),
  ).rejects.toThrow("Cancelled");
});

it("a slow 31-second provider result survives the previous 30-second frontend cap", async () => {
  vi.useFakeTimers();
  try {
    vi.stubGlobal(
      "fetch",
      () =>
        new Promise<Response>((resolve) =>
          setTimeout(
            () =>
              resolve(
                Response.json({
                  source: "llm",
                  provider: "Ollama",
                  model: "slow",
                  plan: { version: 1 },
                }),
              ),
            31000,
          ),
        ),
    );
    const pending = plannerRequest("/api/planner/plan", { timeoutMs: 120000 });
    await vi.advanceTimersByTimeAsync(31000);
    await expect(pending).resolves.toMatchObject({ model: "slow" });
    expect(usePlannerProgress.getState().elapsedMs).toBeGreaterThanOrEqual(
      31000,
    );
  } finally {
    vi.useRealTimers();
  }
});
