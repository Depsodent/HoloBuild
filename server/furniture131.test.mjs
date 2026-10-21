import { test } from "node:test";
import assert from "node:assert/strict";
import { configuration, createPlannerServer } from "./app.mjs";
import { FURNITURE_IDS } from "../shared/furnitureCatalog.mjs";
import {
  assistantPlanSchema,
  parseModelAssistant,
} from "../shared/assistantSchema.mjs";
import { assistantContract } from "./plannerContracts.mjs";
import { editContextSchema } from "../shared/editSchema.mjs";
test("all native catalog IDs share strict furniture response validation", () => {
  assert.equal(FURNITURE_IDS.length, 45);
  for (const preset of FURNITURE_IDS)
    assert.equal(
      assistantPlanSchema.safeParse({
        kind: "furnish",
        preset,
        message: "Review placement.",
      }).success,
      true,
    );
  for (const bad of [
    { preset: "remote-model" },
    { position: [NaN, 0, 0] },
    { position: [0, -1, 0] },
    { assetUrl: "https://invalid.example/asset.glb" },
    { code: "no" },
  ])
    assert.equal(
      assistantPlanSchema.safeParse({
        kind: "furnish",
        preset: "sofa-two",
        message: "Review.",
        ...bad,
      }).success,
      false,
    );
  assert.equal(
    parseModelAssistant(
      JSON.stringify({
        response: JSON.stringify({
          kind: "furnish",
          preset: "sofa-two",
          position: [3, 0, 2],
          message: "Review.",
        }),
      }),
    ).preset,
    "sofa-two",
  );
});
test("compact contract exposes allowlist and requires location clarification rather than room invention", () => {
  assert.ok(assistantContract.includes("kind:furnish"));
  assert.ok(assistantContract.includes("NEVER invent rooms"));
  assert.ok(assistantContract.includes("ceiling-light"));
  assert.ok(assistantContract.length < 14000);
  assert.equal(
    editContextSchema.safeParse({
      selected: null,
      structures: [],
      selection: {
        mode: "component",
        id: "f4473482-f094-4a23-bccf-c0513f329267",
        type: "furniture",
        furniture: "sofa-two",
        name: "Two-seat sofa",
        position: [0, 0.5, 0],
        scale: [1, 1, 1],
      },
    }).success,
    true,
  );
});
async function fixture(t, plan) {
  let forwarded;
  const server = createPlannerServer(
    configuration({ LLM_MODEL: "local-test" }),
    async (_url, init) => {
      forwarded = JSON.parse(init.body);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({ response: JSON.stringify(plan) }),
            },
          },
        ],
      });
    },
  );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(
    () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(r);
      }),
  );
  return {
    url: "http://127.0.0.1:" + server.address().port,
    forwarded: () => forwarded,
  };
}
test("real backend HTTP adapter accepts native furniture without executing or changing scene data", async (t) => {
  const f = await fixture(t, {
      kind: "furnish",
      preset: "wardrobe",
      position: [3, 0, 2],
      message: "Review wardrobe.",
    }),
    r = await fetch(f.url + "/api/planner/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Place a wardrobe at 3,0,2",
        context: { selected: null, structures: [] },
      }),
    });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.plan.kind, "furnish");
  assert.equal(body.plan.preset, "wardrobe");
  assert.ok(JSON.stringify(f.forwarded()).includes("ceiling-light"));
});
test("backend rejects an unregistered model-proposed furniture type", async (t) => {
  const f = await fixture(t, {
      kind: "furnish",
      preset: "download-any-model",
      position: [0, 0, 0],
      message: "Review.",
    }),
    r = await fetch(f.url + "/api/planner/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Place furniture",
        context: { selected: null, structures: [] },
      }),
    });
  assert.equal(r.status, 422);
  const body = await r.json();
  assert.ok(body.requestId);
  assert.equal(body.kind, "response-schema");
});
