// Explicit opt-in live test: one provider generation request; never logs credentials.
import fs from "node:fs/promises";
import { configuration, createPlannerServer } from "../server/app.mjs";
if (process.env.HOLO_LIVE_GEMINI !== "1")
  throw Error("Set HOLO_LIVE_GEMINI=1 only for an authorized live request.");
const config = configuration({
  ...process.env,
  LLM_PROVIDER: "gemini",
  PLANNER_MODE: "local",
});
if (!config.apiKey || !config.models.length)
  throw Error("Configure the ignored Gemini environment first.");
const safeFetch = async (url, init) => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const data = await response
      .clone()
      .json()
      .catch(() => ({}));
    const message = String(data.error?.message ?? "");
    const terms = [
      "responseJsonSchema",
      "response_schema",
      "responseMimeType",
      "thinking",
      "temperature",
      "schema",
      "unsupported",
      "not supported",
      "quota",
      "billing",
      "permission",
      "API key",
      "INVALID_ARGUMENT",
      "not found",
    ].filter((term) => message.toLowerCase().includes(term.toLowerCase()));
    console.log(
      JSON.stringify({
        stage: init.method === "POST" ? "generation" : "model verification",
        http: response.status,
        providerStatus: data.error?.status,
        diagnosticTerms: terms,
        fieldPaths: (data.error?.details ?? []).flatMap((d) =>
          (d.fieldViolations ?? []).map((v) => v.field),
        ),
      }),
    );
  }
  return response;
};
const server = createPlannerServer(config, safeFetch);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
try {
  const url = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(url + "/api/planner/connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!health.ok) throw Error("Model connection verification failed.");
  const response = await fetch(url + "/api/planner/plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      prompt:
        "Build a small platform with one concrete floor slab 4 x 0.2 x 4 meters centered at [0,0.1,0], and one centered white cube column 1 x 1 x 1 meters resting on it at [0,0.7,0]. Exactly these two connected parts, no template metadata, no other parts.",
    }),
  });
  const text = await response.text();
  const resultEvent = text
    .split("\n\n")
    .find((e) => e.startsWith("event: result"));
  if (!resultEvent) {
    console.log(
      JSON.stringify({
        backendResponseStatus: response.status,
        backendEvents: text.split("\n\n").map((e) => e.split("\n")[0]),
      }),
    );
    throw Error(
      "Live generation failed or strict validation rejected the result.",
    );
  }
  const data = JSON.parse(resultEvent.split("data: ")[1]);
  await fs.mkdir("playwright-report", { recursive: true });
  await fs.writeFile(
    "playwright-report/gemini-live-result.json",
    JSON.stringify(data, null, 2),
  );
  const report = {
    testedAt: new Date().toISOString(),
    model: config.models[0],
    accountModelVerified: true,
    nativeStreaming: true,
    backendSchemaPassed: true,
    parts: data.plan.objects.length,
    timings: data.timings,
    clientGeometryAndHistory: "pending browser verification",
    provider: "Gemini",
    requests: 1,
  };
  await fs.writeFile(
    "docs/GEMINI_LIVE_VALIDATION.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error(
    "Live Gemini validation did not pass. No credentials or upstream body were logged.",
  );
  process.exitCode = 1;
} finally {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
