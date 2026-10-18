import { test } from "node:test";
import assert from "node:assert/strict";
import { configuration, createPlannerServer } from "./app.mjs";
const plan = {
  version: 1,
  name: "Test slab",
  units: "meters",
  objects: [
    {
      id: "floor",
      name: "Floor",
      role: "floor",
      type: "floor",
      position: [0, 0.1, 0],
      rotation: [0, 0, 0],
      dimensions: [4, 0.2, 4],
      material: "concrete",
      color: "#ffffff",
    },
  ],
  contacts: [],
  warnings: [],
};
async function fixture(t, fetcher, env = {}) {
  const server = createPlannerServer(
    configuration({ LLM_MODEL: "local-test", ...env }),
    fetcher,
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  return `http://127.0.0.1:${server.address().port}`;
}
const post = (url, body = { prompt: "build a house" }, extra = {}) =>
  fetch(url + "/api/planner/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...extra,
  });
test("configuration defaults to local; rejects unsafe URLs, credentials and invalid model config", () => {
  assert.equal(configuration({}).models.length, 0);
  for (const LLM_BASE_URL of [
    "file:///etc/passwd",
    "http://remote.example/v1",
    "https://user:password@remote.example/v1",
    "https://remote.example/v1?key=secret",
  ])
    assert.throws(() => configuration({ LLM_BASE_URL }));
  assert.equal(
    configuration({
      LLM_BASE_URL: "https://provider.example/v1",
      LLM_ALLOW_REMOTE: "true",
    }).local,
    false,
  );
  assert.throws(() => configuration({ LLM_MODEL: "bad\nkey" }));
});
test("status never discloses key/endpoint and unconfigured mode makes no provider request", async (t) => {
  let calls = 0;
  const url = await fixture(
    t,
    async () => {
      calls++;
    },
    { LLM_MODEL: "", LLM_API_KEY: "PRIVATE-KEY" },
  );
  const status = await (await fetch(url + "/api/planner/status")).text();
  assert.ok(!status.includes("PRIVATE-KEY"));
  assert.equal((await post(url)).status, 503);
  assert.equal(calls, 0);
});
test("real HTTP adapter forwards allowlisted model, bounded data, secret only server-side; validates result", async (t) => {
  let request;
  const url = await fixture(
    t,
    async (endpoint, init) => {
      request = { endpoint, ...init };
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(plan) } }],
        }),
      );
    },
    { LLM_API_KEY: "test-backend-only" },
  );
  const response = await post(url),
    data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.source, "llm");
  assert.deepEqual(data.plan, plan);
  assert.equal(request.headers.Authorization, "Bearer test-backend-only");
  assert.equal(JSON.parse(request.body).model, "local-test");
  assert.match(
    JSON.parse(request.body).messages[0].content,
    /validated six-part/,
  );
  assert.ok(!JSON.stringify(data).includes("test-backend-only"));
  assert.equal(
    (await post(url, { prompt: "house", model: "not-allowed" })).status,
    400,
  );
});
test("rejects malformed/oversized model output and request code/unknown fields", async (t) => {
  let content = "not JSON";
  const url = await fixture(
    t,
    async () =>
      new Response(JSON.stringify({ choices: [{ message: { content } }] })),
  );
  assert.equal((await post(url)).status, 422);
  content = JSON.stringify({ ...plan, execute: "shell" });
  assert.equal((await post(url)).status, 422);
  content = "x".repeat(140000);
  assert.equal((await post(url)).status, 502);
  assert.equal((await post(url, { prompt: "x".repeat(1201) })).status, 422);
  assert.equal(
    (await post(url, { prompt: "house", endpoint: "file://private" })).status,
    422,
  );
});
test("origin, content-type and rate guards protect local adapter", async (t) => {
  const url = await fixture(
    t,
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(plan) } }],
        }),
      ),
  );
  assert.equal(
    (
      await post(
        url,
        { prompt: "house" },
        {
          headers: {
            "Content-Type": "application/json",
            Origin: "https://evil.example",
          },
        },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post(
        url,
        { prompt: "house" },
        { headers: { "Content-Type": "text/plain" } },
      )
    ).status,
    415,
  );
  for (let i = 0; i < 10; i++) assert.equal((await post(url)).status, 200);
  assert.equal((await post(url)).status, 429);
});
test(
  "at most two provider operations may be in flight",
  { timeout: 5000 },
  async (t) => {
    const finish = [];
    const url = await fixture(
      t,
      async () =>
        new Promise((resolve) =>
          finish.push(() =>
            resolve(
              new Response(
                JSON.stringify({
                  choices: [{ message: { content: JSON.stringify(plan) } }],
                }),
              ),
            ),
          ),
        ),
    );
    const first = post(url),
      second = post(url);
    while (finish.length < 2)
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal((await post(url)).status, 429);
    finish.forEach((resolve) => resolve());
    assert.equal((await first).status, 200);
    assert.equal((await second).status, 200);
  },
);
test("timeout aborts provider work and returns a redacted error", async (t) => {
  let aborted = false;
  const url = await fixture(
    t,
    async (_, init) =>
      new Promise((resolve, reject) =>
        init.signal.addEventListener("abort", () => {
          aborted = true;
          reject(Error("PRIVATE-provider-details"));
        }),
      ),
    { LLM_TIMEOUT_MS: "1000" },
  );
  const response = await post(url);
  assert.equal(response.status, 504);
  assert.equal(aborted, true);
  assert.ok(!(await response.text()).includes("PRIVATE"));
});
test("client cancellation propagates to provider; connection checks do not invoke generation", async (t) => {
  let providerSignal;
  const url = await fixture(t, async (endpoint, init) => {
    if (endpoint.endsWith("/models"))
      return new Response(JSON.stringify({ data: [{ id: "local-test" }] }));
    providerSignal = init.signal;
    return new Promise((resolve, reject) =>
      init.signal.addEventListener("abort", () => reject(Error("cancelled"))),
    );
  });
  const status = await fetch(url + "/api/planner/connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal((await status.json()).connection, "connected");
  const abort = new AbortController(),
    pending = post(url, undefined, { signal: abort.signal });
  while (!providerSignal)
    await new Promise((resolve) => setTimeout(resolve, 5));
  abort.abort();
  await assert.rejects(pending);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(providerSignal.aborted, true);
});

const editContext = {
  selected: "00000000-0000-4000-8000-000000000001",
  structures: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      name: "House",
      type: "house",
      count: 8,
      floors: 1,
    },
  ],
};
const editPost = (url, body) =>
  fetch(url + "/api/planner/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
test("edit adapter uses compatible provider and strict intent schema, never scene mutations", async (t) => {
  let sent;
  const plan = {
    version: 1,
    target: editContext.selected,
    operation: { type: "material", role: "wall", material: "brick" },
  };
  const url = await fixture(t, async (endpoint, init) => {
    sent = JSON.parse(init.body);
    return Response.json({
      choices: [{ message: { content: JSON.stringify(plan) } }],
    });
  });
  const r = await editPost(url, {
    prompt: "Make the house walls brick",
    context: editContext,
  });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).plan, plan);
  assert.ok(sent.messages[0].content.includes("clarify"));
  assert.deepEqual(sent.response_format, { type: "json_object" });
  assert.equal(sent.max_tokens, 768);
  assert.deepEqual(JSON.parse(sent.messages[1].content).context, editContext);
  assert.equal(
    (
      await editPost(url, {
        prompt: "edit house",
        context: editContext,
        execute: "delete",
      })
    ).status,
    422,
  );
});
test("edit endpoint rejects invalid context, executable output, unknown material, and malformed JSON", async (t) => {
  let content = "{}",
    calls = 0;
  const url = await fixture(t, async () => {
    calls++;
    return Response.json({ choices: [{ message: { content } }] });
  });
  assert.equal(
    (
      await editPost(url, {
        prompt: "edit house",
        context: { ...editContext, secret: "x" },
      })
    ).status,
    422,
  );
  assert.equal(calls, 0);
  for (const plan of [
    { version: 1, operation: { type: "material", material: "lava" } },
    { version: 1, operation: { type: "delete" }, objects: [] },
    { version: 1, operation: { type: "execute", code: "run" } },
  ]) {
    content = JSON.stringify(plan);
    assert.equal(
      (await editPost(url, { prompt: "edit house", context: editContext }))
        .status,
      422,
    );
  }
  content = "not json";
  assert.equal(
    (await editPost(url, { prompt: "edit house", context: editContext }))
      .status,
    422,
  );
});

function providerEvents(content) {
  const text = JSON.stringify(content);
  return new Response(
    `data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(0, 20) } }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: { content: text.slice(20) } }] })}\n\ndata: [DONE]\n\n`,
    { headers: { "content-type": "text/event-stream" } },
  );
}
test("SSE sends stages and validated result with genuine timing, matching 120s budget", async (t) => {
  let request;
  const url = await fixture(
    t,
    async (endpoint, init) => {
      if (endpoint.endsWith("/api/ps")) return Response.json({ models: [] });
      request = JSON.parse(init.body);
      return providerEvents(plan);
    },
    { LLM_TIMEOUT_MS: "120000" },
  );
  const response = await post(
    url,
    { prompt: "build a house", timeoutMs: 120000 },
    {
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
      },
    },
  );
  const text = await response.text();
  assert.match(text, /Loading Model/);
  assert.match(text, /Generating/);
  assert.match(text, /Validating/);
  assert.equal(request.stream, true);
  assert.equal(request.response_format.type, "json_schema");
  assert.equal(request.response_format.json_schema.name, "holobuild_plan");
  const decoded = request.response_format.json_schema.schema.properties;
  assert.deepEqual(decoded.contacts.items.items, {
    type: "string",
    pattern: "^[a-zA-Z0-9_-]{1,48}$",
  });
  assert.equal(decoded.objects.items.properties.position.minItems, 3);
  assert.deepEqual(decoded.objects.items.properties.position.items, {
    type: "number",
  });
  assert.equal(
    request.response_format.json_schema.schema.additionalProperties,
    false,
  );
  const event = text.split("\n\n").find((x) => x.startsWith("event: result"));
  const data = JSON.parse(event.split("data: ")[1]);
  assert.deepEqual(data.plan, plan);
  assert.equal(data.provider, "Ollama");
  assert.ok(data.timings.firstTokenMs >= 0);
  assert.ok(data.timings.totalMs >= data.timings.providerMs);
  assert.equal(data.timings.modelLoadMs, null);
  assert.equal(data.timings.residentBefore, false);
  const status = await (await fetch(url + "/api/planner/status")).json();
  assert.equal(status.timeoutMs, 120000);
});
test("stream errors never expose an invalid plan; connection and timeout are distinct", async (t) => {
  for (const [kind, fetcher] of [
    ["validation", async () => providerEvents({ version: 99 })],
    [
      "connection",
      async () => {
        throw new TypeError("private endpoint");
      },
    ],
    [
      "timeout",
      async (_endpoint, init) =>
        new Promise((_resolve, reject) =>
          init.signal.addEventListener(
            "abort",
            () => reject(init.signal.reason),
            { once: true },
          ),
        ),
    ],
  ]) {
    const url = await fixture(t, fetcher, {
      LLM_BASE_URL: "http://127.0.0.1:9999/v1",
      LLM_TIMEOUT_MS: "1000",
    });
    const response = await post(
      url,
      { prompt: "build a house", timeoutMs: 1000 },
      {
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
        },
      },
    );
    const text = await response.text();
    assert.match(text, /event: error/);
    assert.match(text, new RegExp(`"kind":"${kind}"`));
    assert.ok(!text.includes("event: result"));
    assert.ok(!text.includes("private endpoint"));
  }
});
test("disconnecting streamed client cancels the active provider request", async (t) => {
  let providerSignal;
  const url = await fixture(
    t,
    async (_endpoint, init) => {
      providerSignal = init.signal;
      return new Promise((_resolve, reject) =>
        init.signal.addEventListener(
          "abort",
          () => reject(init.signal.reason),
          { once: true },
        ),
      );
    },
    { LLM_BASE_URL: "http://127.0.0.1:9999/v1" },
  );
  const abort = new AbortController();
  const response = await post(url, undefined, {
    signal: abort.signal,
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
    },
  });
  const reader = response.body.getReader();
  await reader.read();
  abort.abort();
  await reader.cancel().catch(() => {});
  for (let i = 0; i < 50 && !providerSignal?.aborted; i++)
    await new Promise((r) => setTimeout(r, 10));
  assert.equal(providerSignal?.aborted, true);
});

test("validation-aware retry is explicit, bounded, and preserves the original provider prompt", async (t) => {
  let sent;
  let calls = 0;
  const url = await fixture(t, async (_endpoint, init) => {
    calls++;
    sent = JSON.parse(init.body);
    return Response.json({
      choices: [{ message: { content: JSON.stringify(plan) } }],
    });
  });
  for (const validationFeedback of [
    { reason: "overlap", attempt: 2 },
    { reason: "unknown", attempt: 1 },
    { reason: "bounds", attempt: 1, secret: "x" },
  ])
    assert.equal(
      (await post(url, { prompt: "build a house", validationFeedback })).status,
      422,
    );
  assert.equal(calls, 0);
  const result = await post(url, {
    prompt: "build a house",
    validationFeedback: { reason: "overlap", attempt: 1 },
  });
  assert.equal(result.status, 200);
  assert.equal(calls, 1);
  assert.match(sent.messages[1].content, /build a house/);
  assert.match(sent.messages[1].content, /overlap/);
});
test("bounded conversation summary reaches edit interpreter; oversize history rejected before provider call", async (t) => {
  let sent;
  let calls = 0;
  const context = {
    ...editContext,
    conversation: [{ role: "user", text: "Make it two stories" }],
    details: {
      id: editContext.selected,
      dimensions: [6, 3.4, 6],
      requestedDesign: "Build a house",
      roles: [
        { role: "wall", count: 4, color: "#ffffff", material: "concrete" },
      ],
    },
  };
  const output = {
    version: 1,
    operation: {
      type: "batch",
      operations: [
        { type: "color", role: "roof", color: "#508ee8" },
        { type: "design", windowScale: 1.2 },
      ],
    },
  };
  const url = await fixture(t, async (_endpoint, init) => {
    calls++;
    sent = JSON.parse(init.body);
    return Response.json({
      choices: [{ message: { content: JSON.stringify(output) } }],
    });
  });
  assert.equal(
    (await editPost(url, { prompt: "Blue roof and larger windows", context }))
      .status,
    200,
  );
  assert.deepEqual(JSON.parse(sent.messages[1].content).context, context);
  for (const conversation of [
    Array.from({ length: 7 }, () => ({ role: "user", text: "x" })),
    [{ role: "user", text: "x".repeat(161) }],
  ])
    assert.equal(
      (
        await editPost(url, {
          prompt: "edit house",
          context: { ...context, conversation },
        })
      ).status,
      422,
    );
  assert.equal(calls, 1);
});

test("assistant endpoint interprets bounded flexible requests through the protected compatible adapter", async (t) => {
  let sent;
  const interpreted = {
    kind: "create",
    design: {
      kind: "house",
      width: 6,
      depth: 6,
      height: 3,
      floors: 2,
      thickness: 0.2,
      doors: 1,
      windows: 3,
      roof: "flat",
      material: "concrete",
    },
    message: "A two-story house with three windows per floor.",
  };
  const url = await fixture(t, async (_url, init) => {
    sent = JSON.parse(init.body);
    return Response.json({
      choices: [{ message: { content: JSON.stringify(interpreted) } }],
    });
  });
  const r = await fetch(url + "/api/planner/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "I would like a villa",
      context: editContext,
    }),
  });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).plan, interpreted);
  assert.equal(sent.max_tokens, 10000);
  assert.match(sent.messages[0].content, /Never claim execution/);
  assert.deepEqual(JSON.parse(sent.messages[1].content).context, editContext);
});
test("assistant rejects executable or unbounded responses without changing endpoint safeguards", async (t) => {
  const url = await fixture(t, async () =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({ kind: "execute", code: "run" }),
          },
        },
      ],
    }),
  );
  const r = await fetch(url + "/api/planner/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Something flexible",
      context: editContext,
    }),
  });
  assert.equal(r.status, 422);
  assert.ok((await r.json()).requestId);
});

test("assistant transport envelope preserves strict runtime validation", async () => {
  const { parseModelAssistant } = await import("../shared/assistantSchema.mjs");
  const wrap = (value) => JSON.stringify({ response: JSON.stringify(value) });
  assert.deepEqual(
    parseModelAssistant(wrap({ kind: "clarify", message: "Which structure?" })),
    { kind: "clarify", message: "Which structure?" },
  );
  for (const value of [
    { kind: "create", message: "Ready", design: { kind: "house", width: -1 } },
    {
      kind: "edit",
      message: "Ready",
      scope: "component",
      target: "wrong",
      operation: { kind: "delete" },
    },
    { kind: "clarify", message: "Hello", code: "execute" },
  ])
    assert.throws(() => parseModelAssistant(wrap(value)));
  assert.throws(() =>
    parseModelAssistant(JSON.stringify({ response: "{}", secret: "no" })),
  );
  assert.throws(() =>
    parseModelAssistant(JSON.stringify({ response: "not json" })),
  );
});
