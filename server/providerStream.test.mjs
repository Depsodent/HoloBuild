import test from "node:test";
import assert from "node:assert/strict";
import { collectCompletion } from "./providerStream.mjs";
const response = (events) =>
  new Response(
    new ReadableStream({
      start(controller) {
        const bytes = new TextEncoder().encode(
          events.map((e) => "data: " + JSON.stringify(e) + "\n\n").join("") +
            "data: [DONE]\n\n",
        );
        for (let i = 0; i < bytes.length; i += 7)
          controller.enqueue(bytes.slice(i, i + 7));
        controller.close();
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );
test("fragmented compatible streams preserve JSON and safe completion metadata", async () => {
  const actual = await collectCompletion(
    response([
      { choices: [{ delta: { content: '{"kind":"clarify",' } }] },
      { choices: [{ delta: { content: '"message":"Where? 🏠"}' } }] },
      { choices: [{ delta: {}, finish_reason: "stop" }] },
      {
        choices: [],
        usage: {
          prompt_tokens: 1500,
          completion_tokens: 30,
          total_tokens: 1530,
        },
      },
    ]),
    () => {},
  );
  assert.equal(
    actual.choices[0].message.content,
    '{"kind":"clarify","message":"Where? 🏠"}',
  );
  assert.equal(actual.choices[0].finish_reason, "stop");
  assert.deepEqual(actual.usage, {
    prompt_tokens: 1500,
    completion_tokens: 30,
    total_tokens: 1530,
  });
});
test("output-limit termination rejects even parseable partial designs with an actionable category", async () => {
  await assert.rejects(
    collectCompletion(
      response([
        {
          choices: [
            {
              delta: { content: '{"kind":"create"}' },
              finish_reason: "length",
            },
          ],
        },
      ]),
      () => {},
    ),
    (error) => error.kind === "provider-truncated" && error.status === 502,
  );
});
test("tool or blocked finishes cannot become construction plans and invalid usage is discarded", async () => {
  await assert.rejects(
    collectCompletion(
      response([
        {
          choices: [{ delta: { content: "{}" }, finish_reason: "tool_calls" }],
        },
      ]),
      () => {},
    ),
    (error) => error.kind === "provider-incomplete",
  );
  const actual = await collectCompletion(
    response([
      {
        choices: [{ delta: { content: "{}" }, finish_reason: "stop" }],
        usage: {
          prompt_tokens: -1,
          completion_tokens: "secret",
          total_tokens: 3,
        },
      },
    ]),
    () => {},
  );
  assert.equal(actual.usage, undefined);
});
