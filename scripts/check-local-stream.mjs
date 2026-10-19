// Opt-in live diagnostic. Prints safe metadata only, never provider/user content or secrets.
import { createPlannerServer, configuration } from "../server/app.mjs";
import { parseModelAssistant } from "../shared/assistantSchema.mjs";
import { collectCompletion } from "../server/providerStream.mjs";
const config = configuration(process.env);
if (
  !config.local ||
  config.provider === "gemini" ||
  new URL(config.base).port !== "11434"
)
  throw Error(
    "This diagnostic requires the local Ollama profile, never a hosted provider.",
  );
const inspections = [];
const server = createPlannerServer(config, async (url, options) => {
  const response = await fetch(url, options);
  if (!String(url).endsWith("/chat/completions") || !response.ok)
    return response;
  const rawCopy = response.clone(),
    assemblyCopy = response.clone();
  inspections.push(
    (async () => {
      const events = (await rawCopy.text()).replace(/\r/g, "").split("\n\n");
      let content = "",
        finish = null,
        chunks = 0;
      for (const event of events) {
        const text = event
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        if (!text || text === "[DONE]") continue;
        const data = JSON.parse(text);
        const choice = data.choices?.[0];
        if (typeof choice?.delta?.content === "string") {
          content += choice.delta.content;
          chunks++;
        }
        if (choice?.finish_reason) finish = choice.finish_reason;
      }
      let classification;
      try {
        const plan = parseModelAssistant(content);
        classification = { valid: true, kind: plan.kind };
        classification.floors = plan.design?.floors;
        classification.stairs = plan.design?.stairs?.length ?? 0;
        classification.balconies = plan.design?.balconies?.length ?? 0;
      } catch (error) {
        classification = {
          valid: false,
          type: error.name,
          issues: error.issues?.map((i) => ({
            code: i.code,
            path: i.path.join("."),
            expected: i.expected,
          })),
          syntaxPosition: error.message?.match(/position (\d+)/)?.[1],
        };
      }
      let copy, assemblyError;
      try {
        copy = await collectCompletion(assemblyCopy, () => {});
      } catch (error) {
        assemblyError = error.kind ?? "stream-invalid";
      }
      const diagnostics = {
        finish: ["stop", "length", "tool_calls", "content_filter"].includes(
          finish,
        )
          ? finish
          : "other-or-missing",
        usage: copy?.usage ?? null,
        chunks,
        characters: content.length,
        assemblyEqual: copy
          ? copy.choices[0].message.content === content
          : false,
        ...(assemblyError ? { assemblyError } : {}),
        ...classification,
      };
      console.log(JSON.stringify(diagnostics));
      if (!copy || !diagnostics.assemblyEqual) process.exitCode = 1;
    })().catch(() => {
      process.exitCode = 1;
      console.log(JSON.stringify({ diagnostic: "observation-failed" }));
    }),
  );
  return response;
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
try {
  const r = await fetch(
    `http://127.0.0.1:${server.address().port}/api/planner/assistant`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        prompt: "generate a 2 story house including a balcony and stairs",
        context: { selected: null, structures: [] },
      }),
      signal: AbortSignal.timeout(130000),
    },
  );
  const text = await r.text();
  await Promise.all(inspections);
  const last = text
    .split("\n\n")
    .findLast((e) => /^event: (result|error)/.test(e));
  const terminal = last
    ? JSON.parse(
        last
          .split("\n")
          .find((line) => line.startsWith("data:"))
          .slice(5),
      )
    : null;
  console.log(
    JSON.stringify({
      http: r.status,
      event: last?.split("\n")[0],
      kind: terminal?.plan?.kind ?? terminal?.kind,
      requestId: terminal?.requestId,
      timings: terminal?.timings,
    }),
  );
  if (!last?.startsWith("event: result")) process.exitCode = 1;
} finally {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
