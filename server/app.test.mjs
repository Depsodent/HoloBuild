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
  assert.ok(!JSON.stringify(data).includes("test-backend-only"));
  assert.equal(
    (await post(url, { prompt: "house", model: "not-allowed" })).status,
    502,
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
