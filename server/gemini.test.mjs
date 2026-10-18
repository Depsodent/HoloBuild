import { request as httpRequest } from "node:http";
import { test } from "node:test";
import assert from "node:assert/strict";
import { configuration, createPlannerServer } from "./app.mjs";
import { geminiSchema, geminiText, geminiRequest } from "./gemini.mjs";
import { collectCompletion } from "./providerStream.mjs";
import {
  createHostedGuard,
  hostedSecurity,
  acquireScript,
} from "./hostedGuard.mjs";
const env = {
  LLM_PROVIDER: "gemini",
  GEMINI_MODEL: "gemini-test",
  GEMINI_API_KEY: "test-server-only",
};
const plan = {
  version: 1,
  name: "Slab",
  units: "meters",
  objects: [
    {
      id: "slab",
      name: "Slab",
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
const completion = (content) => ({
  candidates: [
    {
      content: { parts: [{ text: JSON.stringify(content) }] },
      finishReason: "STOP",
    },
  ],
});
async function fixture(t, fetcher, extra = {}) {
  const server = createPlannerServer(
    configuration({ ...env, ...extra }),
    fetcher,
  );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(
    () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(r);
      }),
  );
  return `http://127.0.0.1:${server.address().port}`;
}
const post = (url, body = { prompt: "Build a room" }, headers = {}) =>
  fetch(`${url}/api/planner/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const metadata = {
  name: "models/gemini-test",
  supportedGenerationMethods: ["generateContent"],
};
test("Gemini maps native requests, verifies the configured model, and preserves strict scene data", async (t) => {
  let request;
  const url = await fixture(t, async (endpoint, init) => {
    assert.equal(init.headers["x-goog-api-key"], env.GEMINI_API_KEY);
    assert.ok(!endpoint.includes(env.GEMINI_API_KEY));
    if (init.method !== "POST") return Response.json(metadata);
    request = JSON.parse(init.body);
    return Response.json(completion(plan));
  });
  const response = await post(url),
    data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.provider, "Gemini");
  assert.deepEqual(data.plan, plan);
  assert.equal(request.generationConfig.responseMimeType, "application/json");
  assert.ok(request.generationConfig.responseJsonSchema);
  assert.match(request.systemInstruction.parts[0].text, /validated six-part/);
  assert.ok(!request.messages);
  assert.equal(request.contents[0].role, "user");
  assert.ok(!JSON.stringify(data).includes(env.GEMINI_API_KEY));
});
test("Gemini unavailable model blocks generation before a billable call", async (t) => {
  let posts = 0;
  const url = await fixture(t, async (_, init) => {
    if (init.method === "POST") posts++;
    return Response.json({ ...metadata, name: "models/different" });
  });
  assert.equal((await post(url)).status, 502);
  assert.equal(posts, 0);
});
test("Gemini rejects invalid model output, blocked/truncated candidates and executable parts", async (t) => {
  for (const value of [
    completion({ ...plan, script: "bad" }),
    { choices: [{ message: { content: JSON.stringify(plan) } }] },
    { promptFeedback: { blockReason: "SAFETY" } },
    {
      candidates: [
        {
          finishReason: "MAX_TOKENS",
          content: { parts: [{ text: JSON.stringify(plan) }] },
        },
      ],
    },
  ]) {
    const url = await fixture(t, async (_, init) =>
      Response.json(init.method === "POST" ? value : metadata),
    );
    assert.ok((await post(url)).status >= 400);
  }
  assert.throws(() =>
    geminiText({
      candidates: [{ content: { parts: [{ functionCall: { name: "bad" } }] } }],
    }),
  );
});
test("Gemini native streaming excludes thoughts and maps only validated final JSON", async (t) => {
  const url = await fixture(t, async (_, init) => {
    if (init.method !== "POST") return Response.json(metadata);
    const body = JSON.parse(init.body);
    assert.equal(body.generationConfig.maxOutputTokens, 10000);
    const events = [
      {
        candidates: [
          { content: { parts: [{ thought: true, text: "private thinking" }] } },
        ],
      },
      completion(plan),
    ];
    return new Response(
      events.map((v) => `data: ${JSON.stringify(v)}\n\n`).join(""),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  });
  const response = await post(url, undefined, { Accept: "text/event-stream" }),
    text = await response.text();
  assert.ok(text.includes('"provider":"Gemini"'));
  assert.ok(text.includes('"stage":"Validating"'));
  assert.ok(text.includes("event: result"));
  assert.ok(!text.includes("private thinking"));
  assert.ok(!text.includes(env.GEMINI_API_KEY));
});
test("Gemini stream truncation and incomplete events are rejected", async () => {
  await assert.rejects(() =>
    collectCompletion(
      new Response('data: {"candidates":[{"finishReason":"MAX_TOKENS"}]}\n\n', {
        headers: { "Content-Type": "text/event-stream" },
      }),
      () => {},
      "gemini",
    ),
  );
  await assert.rejects(() =>
    collectCompletion(
      new Response("data: {", {
        headers: { "Content-Type": "text/event-stream" },
      }),
      () => {},
      "gemini",
    ),
  );
});
test("Gemini provider errors never disclose key, prompt or upstream error bodies", async (t) => {
  const url = await fixture(t, async (_, init) =>
    init.method === "POST"
      ? new Response(JSON.stringify({ error: env.GEMINI_API_KEY }), {
          status: 403,
        })
      : Response.json(metadata),
  );
  const response = await post(url);
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes(env.GEMINI_API_KEY));
});
test("Gemini health verifies model support without generating, status has no credentials", async (t) => {
  let calls = 0;
  const url = await fixture(t, async (_, init) => {
    assert.notEqual(init.method, "POST");
    calls++;
    return Response.json(metadata);
  });
  const response = await fetch(url + "/api/planner/connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal((await response.json()).modelVerified, true);
  assert.equal(calls, 1);
  assert.ok(
    !(await (await fetch(url + "/api/planner/status")).text()).includes(
      env.GEMINI_API_KEY,
    ),
  );
});
test("Gemini schema projects tuples and constants but does not mutate original constraints", () => {
  const schema = {
    type: "array",
    prefixItems: [
      { const: 1, type: "number" },
      { const: 1, type: "number" },
    ],
    items: false,
  };
  const copy = structuredClone(schema),
    result = geminiSchema(schema);
  assert.deepEqual(result.items.enum, [1]);
  assert.equal(result.minItems, 2);
  assert.deepEqual(schema, copy);
});
test("hosted mode rejects local fallback, wildcard origins, unsafe stores and model lists", () => {
  assert.throws(() => configuration({ PLANNER_MODE: "hosted" }));
  for (const APP_ORIGINS of [
    "*",
    "http://public.example",
    "https://public.example/path",
  ])
    assert.throws(() =>
      configuration({ ...env, PLANNER_MODE: "hosted", APP_ORIGINS }),
    );
  assert.throws(() =>
    hostedSecurity({ UPSTASH_REDIS_REST_URL: "http://unsafe.example" }),
  );
  assert.throws(() =>
    configuration({ ...env, GEMINI_MODEL: "gemini-test,gemini-other" }),
  );
});
test("hosted requests fail closed without quota credentials and never call Gemini", async (t) => {
  let calls = 0;
  const url = await fixture(
    t,
    async () => {
      calls++;
      throw Error();
    },
    { PLANNER_MODE: "hosted", APP_ORIGINS: "https://app.example" },
  );
  const status = await new Promise((resolve, reject) => {
    const req = httpRequest(
      url + "/api/planner/plan",
      {
        method: "POST",
        headers: {
          Host: "app.example",
          Origin: "https://app.example",
          "Content-Type": "application/json",
        },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on("error", reject);
    req.end(JSON.stringify({ prompt: "Build a house" }));
  });
  assert.equal(status, 503);
  assert.equal(calls, 0);
  assert.equal((await post(url)).status, 403);
});
test("distributed guard atomically reserves daily/IP/concurrency budgets and releases only its lease", async () => {
  const requests = [];
  const config = {
    ...hostedSecurity({
      UPSTASH_REDIS_REST_URL: "https://demo.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-private-token",
      PUBLIC_AI_ENABLED: "true",
    }),
    timeoutMs: 30000,
  };
  let result = 1;
  const guard = createHostedGuard(config, async (_, init) => {
    requests.push(JSON.parse(init.body));
    return Response.json({ result });
  });
  const req = { headers: { "x-vercel-forwarded-for": "192.0.2.1" } };
  const release = await guard(req, true);
  assert.ok(release);
  assert.equal(requests[0][0], "EVAL");
  assert.equal(requests[0][1], acquireScript);
  assert.ok(!JSON.stringify(requests).includes("192.0.2.1"));
  await release();
  assert.equal(requests[1][0], "ZREM");
  result = 0;
  await assert.rejects(
    () => guard(req, true),
    (error) => error.status === 429 && error.kind === "rate-limit",
  );
});
test("quota-store failure blocks rather than silently enabling unmetered Gemini", async () => {
  const guard = createHostedGuard(
    {
      ...hostedSecurity({
        UPSTASH_REDIS_REST_URL: "https://demo.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
        PUBLIC_AI_ENABLED: "true",
      }),
      timeoutMs: 30000,
    },
    async () => {
      throw Error("unreachable");
    },
  );
  await assert.rejects(() => guard({ headers: {} }, true));
});

test("Gemini editing uses native context/schema mapping and the same strict edit validator", async (t) => {
  let request;
  const edit = {
    version: 1,
    target: "11111111-1111-4111-8111-111111111111",
    operation: { type: "material", material: "brick", role: "wall" },
  };
  const url = await fixture(t, async (_, init) => {
    if (init.method !== "POST") return Response.json(metadata);
    request = JSON.parse(init.body);
    return Response.json(completion(edit));
  });
  const context = {
    selected: "11111111-1111-4111-8111-111111111111",
    structures: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "House",
        type: "house",
        count: 6,
      },
    ],
  };
  const response = await fetch(url + "/api/planner/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "Make walls brick", context }),
  });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(data.plan, edit);
  assert.ok(JSON.parse(request.contents[0].parts[0].text).context);
  assert.equal(request.generationConfig.maxOutputTokens, 2048);
});
import { createServer } from "node:http";
import { createPlannerHandler } from "./app.mjs";

test("Gemini timeout aborts the native provider and returns a safe failure", async (t) => {
  let providerSignal;
  const url = await fixture(
    t,
    async (_, init) => {
      if (init.method !== "POST") return Response.json(metadata);
      providerSignal = init.signal;
      return new Promise((_, reject) =>
        init.signal.addEventListener(
          "abort",
          () => reject(init.signal.reason),
          { once: true },
        ),
      );
    },
    { LLM_TIMEOUT_MS: "1000" },
  );
  const response = await post(url);
  assert.equal(response.status, 504);
  assert.equal((await response.json()).kind, "timeout");
  assert.equal(providerSignal.aborted, true);
});
test("Gemini streamed client cancellation aborts generation", async (t) => {
  let providerSignal;
  const url = await fixture(t, async (_, init) => {
    if (init.method !== "POST") return Response.json(metadata);
    providerSignal = init.signal;
    return new Promise((_, reject) =>
      init.signal.addEventListener("abort", () => reject(init.signal.reason), {
        once: true,
      }),
    );
  });
  const abort = new AbortController();
  const response = await fetch(url + "/api/planner/plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ prompt: "Build a slab" }),
    signal: abort.signal,
  });
  const reader = response.body.getReader();
  await reader.read();
  abort.abort();
  await reader.cancel().catch(() => {});
  for (let i = 0; i < 50 && !providerSignal?.aborted; i++)
    await new Promise((r) => setTimeout(r, 10));
  assert.equal(providerSignal?.aborted, true);
});
test("Vercel parsed JSON bodies retain generation validation and the 8 KiB limit", async (t) => {
  let body = { prompt: "Build a slab" },
    calls = 0;
  const handler = createPlannerHandler(configuration(env), async (_, init) => {
    calls++;
    return Response.json(init.method === "POST" ? completion(plan) : metadata);
  });
  const server = createServer((req, res) => {
    req.body = body;
    return handler(req, res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(
    () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(r);
      }),
  );
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await post(url)).status, 200);
  const previous = calls;
  body = { prompt: "x".repeat(9000) };
  assert.ok((await post(url)).status >= 400);
  assert.equal(calls, previous);
  body = { prompt: "Build a slab", arbitraryProxy: "https://bad.example" };
  assert.equal((await post(url)).status, 422);
  assert.equal(calls, previous);
});
test("hosted quota denial prevents all Gemini calls and oversized store data is bounded", async (t) => {
  let providerCalls = 0;
  const url = await fixture(
    t,
    async (endpoint) => {
      if (endpoint === "https://demo.upstash.io")
        return Response.json({ result: 0 });
      providerCalls++;
      throw Error("No generation allowed");
    },
    {
      PLANNER_MODE: "hosted",
      APP_ORIGINS: "https://app.example",
      PUBLIC_AI_ENABLED: "true",
      UPSTASH_REDIS_REST_URL: "https://demo.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-quota-token",
    },
  );
  const status = await new Promise((resolve, reject) => {
    const req = httpRequest(
      url + "/api/planner/plan",
      {
        method: "POST",
        headers: {
          Host: "app.example",
          Origin: "https://app.example",
          "Content-Type": "application/json",
        },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on("error", reject);
    req.end(JSON.stringify({ prompt: "Build a slab" }));
  });
  assert.equal(status, 429);
  assert.equal(providerCalls, 0);
  const guard = createHostedGuard(
    {
      ...hostedSecurity({
        PUBLIC_AI_ENABLED: "true",
        UPSTASH_REDIS_REST_URL: "https://demo.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
      }),
      timeoutMs: 30000,
    },
    async () => new Response("x".repeat(5000)),
  );
  await assert.rejects(
    () => guard({ headers: {} }, true),
    (error) => error.status === 503 && error.kind === "quota-store",
  );
});

test("Gemini decoder guidance omits large array maxima without weakening final validation", () => {
  const input = {
    type: "array",
    maxItems: 120,
    items: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "number" },
    },
  };
  const result = geminiSchema(input);
  assert.equal(result.maxItems, undefined);
  assert.equal(result.items.maxItems, 3);
  assert.equal(input.maxItems, 120);
});

test("Gemini 3.8 uses supported low thinking and omits deprecated sampling without changing older models", () => {
  const request = (model) =>
    JSON.parse(
      geminiRequest(
        { apiKey: "test-only" },
        model,
        "system",
        "input",
        { type: "object" },
        true,
        false,
        new AbortController().signal,
      ).init.body,
    ).generationConfig;
  const modern = request("gemini-3.8-flash");
  assert.deepEqual(modern.thinkingConfig, { thinkingLevel: "low" });
  assert.equal(modern.temperature, undefined);
  assert.equal(modern.maxOutputTokens, 2048);
  const older = request("gemini-2.5-flash");
  assert.equal(older.thinkingConfig, undefined);
  assert.equal(older.temperature, 0.2);
});

test("hosted quota/store errors expose safe references and recovery without calling Gemini on rejection", async (t) => {
  let result = [2, 21],
    broken = false,
    providerCalls = 0;
  const logs = [];
  t.mock.method(console, "warn", (line) => logs.push(JSON.parse(line)));
  const url = await fixture(
    t,
    async (endpoint, init) => {
      if (endpoint === "https://demo.upstash.io") {
        if (broken) throw new TypeError("private-url-token");
        return Response.json({
          result: JSON.parse(init.body)[0] === "ZREM" ? 1 : result,
        });
      }
      providerCalls++;
      return Response.json(
        init.method === "POST" ? completion(plan) : metadata,
      );
    },
    {
      PLANNER_MODE: "hosted",
      APP_ORIGINS: "https://app.example",
      PUBLIC_AI_ENABLED: "true",
      UPSTASH_REDIS_REST_URL: "https://demo.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-only",
    },
  );
  const headers = { Host: "app.example", Origin: "https://app.example" };
  for (const [code, kind] of [
    [2, "rate-limit"],
    [3, "daily-quota"],
    [4, "concurrency"],
  ]) {
    result = [code, 21];
    const r = await hostedPost(url, headers),
      body = await r.json();
    assert.equal(r.status, 429);
    assert.equal(r.headers.get("retry-after"), "21");
    assert.equal(body.kind, kind);
    assert.equal(body.requestId, r.headers.get("x-request-id"));
    assert.match(body.error, /retry in 21/);
  }
  broken = true;
  let r = await hostedPost(url, headers);
  assert.equal(r.status, 503);
  assert.equal((await r.json()).kind, "quota-store");
  assert.equal(providerCalls, 0);
  broken = false;
  result = [1, 0];
  r = await hostedPost(url, headers);
  assert.equal(r.status, 200);
  assert.ok(logs.every((l) => l.requestId && l.timestamp));
  assert.ok(!JSON.stringify(logs).includes("private-url-token"));
});
test("upstream quota in an opened SSE stream retains category, logical status and request reference", async (t) => {
  const url = await fixture(t, async (_, init) =>
    init.method === "POST"
      ? new Response("private-provider-content", { status: 429 })
      : Response.json(metadata),
  );
  const r = await post(url, undefined, { Accept: "text/event-stream" });
  assert.equal(r.status, 200);
  const body = await r.text();
  assert.match(body, /"kind":"provider-quota"/);
  assert.match(body, /"status":503/);
  assert.match(body, new RegExp(r.headers.get("x-request-id")));
  assert.ok(!body.includes("private-provider-content"));
});

function hostedPost(url, headers) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      url + "/api/planner/plan",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve(
            new Response(Buffer.concat(chunks), {
              status: res.statusCode,
              headers: res.headers,
            }),
          ),
        );
      },
    );
    req.on("error", reject);
    req.end(JSON.stringify({ prompt: "Build a slab" }));
  });
}

test("metadata provider quota is actionable and makes no generation request", async (t) => {
  let calls = 0;
  const url = await fixture(t, async () => {
    calls++;
    return new Response("private", { status: 429 });
  });
  const r = await post(url);
  assert.equal(r.status, 503);
  assert.equal(r.headers.get("retry-after"), "60");
  assert.equal((await r.json()).kind, "provider-quota");
  assert.equal(calls, 1);
});

test("hosted JSON and SSE terminal responses wait for lease release before closing", async (t) => {
  for (const stream of [false, true]) {
    const began = Promise.withResolvers(),
      finish = Promise.withResolvers();
    const url = await fixture(
      t,
      async (endpoint, init) => {
        if (endpoint === "https://demo.upstash.io") {
          const command = JSON.parse(init.body);
          if (command[0] === "ZREM") {
            began.resolve();
            await finish.promise;
            return Response.json({ result: 1 });
          }
          return Response.json({ result: [1, 0] });
        }
        return Response.json(
          init.method === "POST" ? completion(plan) : metadata,
        );
      },
      {
        PLANNER_MODE: "hosted",
        APP_ORIGINS: "https://app.example",
        PUBLIC_AI_ENABLED: "true",
        UPSTASH_REDIS_REST_URL: "https://demo.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "test-only",
      },
    );
    let closed = false;
    const pending = hostedPost(url, {
      Host: "app.example",
      Origin: "https://app.example",
      ...(stream ? { Accept: "text/event-stream" } : {}),
    }).then((r) => {
      closed = true;
      return r;
    });
    try {
      await began.promise;
      assert.equal(closed, false);
    } finally {
      finish.resolve();
    }
    const response = await pending;
    assert.equal(response.status, 200);
    if (stream) assert.match(await response.text(), /event: result/);
    else assert.deepEqual((await response.json()).plan, plan);
  }
});
