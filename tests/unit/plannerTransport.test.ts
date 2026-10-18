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
  const timeout = vi.spyOn(globalThis, "setTimeout");
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
  expect(timeout).toHaveBeenCalledWith(expect.any(Function), 122000);
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
    "Cannot reach the planner",
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

it("keeps safe quota retry messages and diagnostic IDs for JSON and SSE", async () => {
  for (const streamed of [false, true]) {
    const failure = {
      kind: "rate-limit",
      error: "Too many requests; retry in 42 seconds.",
      requestId: "diagnostic-123",
      retryAfterSeconds: 42,
    };
    vi.stubGlobal("fetch", async () =>
      streamed
        ? new Response(
            "event: error\ndata: " + JSON.stringify(failure) + "\n\n",
            { headers: { "content-type": "text/event-stream" } },
          )
        : Response.json(failure, { status: 429 }),
    );
    await expect(plannerRequest("/api/planner/plan", {})).rejects.toThrow(
      "retry in 42 seconds. Reference: diagnostic-123",
    );
  }
});
it("works without AbortSignal.any or AbortSignal.timeout and still cancels", async () => {
  const any = vi.spyOn(AbortSignal, "any").mockImplementation(() => {
    throw Error("unsupported");
  });
  const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
    throw Error("unsupported");
  });
  try {
    const controller = new AbortController();
    vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
      controller.abort();
      expect(init.signal?.aborted).toBe(true);
      return Response.json({ source: "llm", plan: {} });
    });
    await expect(
      plannerRequest("/api/planner/plan", {}, controller.signal),
    ).rejects.toThrow("Cancelled");
  } finally {
    any.mockRestore();
    timeout.mockRestore();
  }
});

it("non-JSON platform rate limits retain Retry-After without exposing HTML", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response("<html>private platform response</html>", {
        status: 429,
        headers: { "Retry-After": "8", "X-Request-ID": "edge-ref" },
      }),
  );
  await expect(plannerRequest("/api/planner/plan", {})).rejects.toThrow(
    "retry in 8 seconds or use Offline. Reference: edge-ref",
  );
});
