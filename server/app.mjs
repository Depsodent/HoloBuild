import { createServer } from "node:http";
import { z } from "zod";
import {
  planSchema,
  parseModelPlan,
  cleanPrompt,
} from "../shared/planSchema.mjs";
export function configuration(env = process.env) {
  const base = new URL(env.LLM_BASE_URL || "http://127.0.0.1:11434/v1");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    (!local &&
      (env.LLM_ALLOW_REMOTE !== "true" || base.protocol !== "https:")) ||
    !["http:", "https:"].includes(base.protocol)
  )
    throw Error(
      "Provider URL must be loopback HTTP(S), or explicitly enabled remote HTTPS, without embedded credentials/query.",
    );
  const models = (env.LLM_MODELS || env.LLM_MODEL || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (
    models.length > 8 ||
    models.some((m) => !m.match(/^[a-zA-Z0-9_.:/-]{1,120}$/))
  )
    throw Error("Invalid configured model list.");
  const timeoutMs = Number(env.LLM_TIMEOUT_MS || 30000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000)
    throw Error("Timeout must be 1000–120000 ms.");
  const origins = (
    env.APP_ORIGINS || "http://127.0.0.1:5175,http://127.0.0.1:5173"
  )
    .split(",")
    .map((v) => v.trim());
  return {
    base: base.href.replace(/\/$/, ""),
    local,
    models,
    timeoutMs,
    apiKey: env.LLM_API_KEY || "",
    jsonMode: env.LLM_JSON_MODE !== "false",
    origins,
  };
}
const requestSchema = z
  .object({
    prompt: z.string().max(1200),
    model: z.string().max(120).optional(),
    timeoutMs: z.number().int().min(1000).max(120000).optional(),
  })
  .strict();
const system = `You are a HoloBuild construction planner. Return ONLY one JSON object matching this schema: ${JSON.stringify(z.toJSONSchema(planSchema))}. Use meters for final physical dimensions, not scales; rotations are radians. Primitive base dimensions: cube/sphere/cylinder/cone 1x1x1, wall 3x2x0.25, floor 4x0.2x4. Every dimensions/base ratio must be 0.1–20. At most 120 parts; whole assembly at most 32m wide, 40m high, 32m deep. Begin at ground y=0 (center positions account for half-height). All parts must form a connected grounded assembly. Walls stand on slabs, slabs on walls/pillars. Segment walls around real door/window openings; never overlay windows into solid walls. Prefer orthogonal boxes and flat roofs. Components should touch without deep overlap. contacts may allow only <=0.08m shallow, <=25% smaller-volume joints, never intersecting entire panels. Use unique ASCII component IDs, meaningful names, existing materials and hex colors. Report unsupported details in warnings. Never include code, tools, URLs, asset references or instructions; only construction data. This is a visual model, not building engineering.`;
async function boundedJson(response, max = 262144) {
  if (!response.body) throw Error("Provider returned no response.");
  const reader = response.body.getReader(),
    chunks = [];
  let count = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > max) throw Error("Provider response exceeds size limit.");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export function createPlannerServer(config = configuration(), fetcher = fetch) {
  let inFlight = 0;
  const recent = [];
  return createServer(async (req, res) => {
    const send = (code, data) => {
      if (res.destroyed) return;
      res.writeHead(code, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(data));
    };
    if (
      !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
        req.socket.remoteAddress,
      ) ||
      ![
        `127.0.0.1:${req.socket.localPort}`,
        `localhost:${req.socket.localPort}`,
      ].includes(req.headers.host) ||
      (req.headers.origin && !config.origins.includes(req.headers.origin))
    )
      return send(403, {
        error: "Only the configured local app may use this service.",
      });
    const url = new URL(req.url, "http://localhost");
    const status = {
      configured: !!config.models.length,
      models: config.models,
      model: config.models[0] ?? "",
      timeoutMs: config.timeoutMs,
      provider: config.local
        ? "Local compatible endpoint"
        : "Explicit remote HTTPS provider",
      connection: "not checked",
    };
    if (req.method === "GET" && url.pathname === "/api/planner/status")
      return send(200, status);
    if (
      !["/api/planner/plan", "/api/planner/connection"].includes(
        url.pathname,
      ) ||
      req.method !== "POST"
    )
      return send(404, { error: "Not found." });
    if (!config.models.length)
      return send(503, {
        error:
          "No model configured. Set LLM_MODEL on the backend, or use Offline.",
      });
    const now = Date.now();
    while (recent[0] < now - 60000) recent.shift();
    if (inFlight >= 2 || recent.length >= 10)
      return send(429, {
        error: "Planner busy or rate limited. Try again shortly.",
      });
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return send(415, { error: "JSON request required." });
    recent.push(now);
    inFlight++;
    const abort = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abort.abort();
    });
    let timer;
    try {
      let bytes = 0;
      const chunks = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 8192) throw Error("Request exceeds 8 KiB.");
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const headers = {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      };
      if (url.pathname.endsWith("/connection")) {
        z.object({}).strict().parse(body);
        timer = setTimeout(
          () => abort.abort(),
          Math.min(config.timeoutMs, 5000),
        );
        const response = await fetcher(`${config.base}/models`, {
          headers,
          signal: abort.signal,
          redirect: "error",
        });
        if (!response.ok) throw Error("Provider connection failed.");
        const data = await boundedJson(response);
        const available = Array.isArray(data.data)
          ? data.data.map((m) => m.id)
          : [];
        return send(200, {
          ...status,
          connection: available.includes(config.models[0])
            ? "connected"
            : "reachable; configured model not listed",
        });
      }
      const args = requestSchema.parse(body),
        prompt = cleanPrompt(args.prompt),
        model = args.model || config.models[0];
      if (!config.models.includes(model))
        throw Error("Model is not in the backend allowlist.");
      timer = setTimeout(
        () => abort.abort(),
        Math.min(args.timeoutMs ?? config.timeoutMs, config.timeoutMs),
      );
      const response = await fetcher(`${config.base}/chat/completions`, {
        method: "POST",
        headers,
        redirect: "error",
        signal: abort.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          stream: false,
          temperature: 0.2,
          max_tokens: 10000,
          ...(config.jsonMode
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
      });
      if (!response.ok) throw Error("Provider rejected the request.");
      const data = await boundedJson(response),
        plan = parseModelPlan(data.choices?.[0]?.message?.content);
      send(200, { source: "llm", model, plan });
    } catch (error) {
      // Never echo provider response bodies, credentials, URLs or prompts.
      const validation =
        error instanceof z.ZodError || error instanceof SyntaxError;
      send(abort.signal.aborted ? 504 : validation ? 422 : 502, {
        error: abort.signal.aborted
          ? "Generation timed out or was cancelled."
          : validation
            ? "Provider/request JSON failed strict validation."
            : "Planner failed. Check backend configuration, model availability and response limits.",
      });
    } finally {
      clearTimeout(timer);
      inFlight--;
    }
  });
}
