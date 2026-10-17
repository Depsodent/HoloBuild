import { providerSchema } from "./providerSchema.mjs";
const base = "https://generativelanguage.googleapis.com/v1beta";
const verified = new WeakMap();
export function geminiSchema(schema) {
  const project = (value) => {
    if (Array.isArray(value)) return value.map(project);
    if (!value || typeof value !== "object") return value;
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (["$schema", "default"].includes(key)) continue;
      // Large array maxima exceed Gemini's constrained-decoder complexity budget.
      // Keep exact short tuples; the original Zod schema enforces every scene budget.
      if (key === "maxItems" && item > 16) continue;
      if (key === "const") output.enum = [item];
      else output[key === "oneOf" ? "anyOf" : key] = project(item);
    }
    return output;
  };
  return project(providerSchema(schema));
}
export async function verifyGeminiModel(config, fetcher, signal) {
  const previous = verified.get(config);
  if (previous && Date.now() - previous < 300000) return true;
  const response = await fetcher(`${base}/models/${config.models[0]}`, {
    headers: { "x-goog-api-key": config.apiKey },
    signal,
    redirect: "error",
  });
  if (!response.ok) throw Error("Gemini model verification failed.");
  const reader = response.body?.getReader();
  if (!reader) throw Error("Missing model metadata.");
  let text = "",
    bytes = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 65536) throw Error("Model metadata limit.");
      text += decoder.decode(value, { stream: true });
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  const model = JSON.parse(text + decoder.decode());
  if (
    model.name !== `models/${config.models[0]}` ||
    !model.supportedGenerationMethods?.includes("generateContent")
  )
    throw Error("Configured Gemini model is unavailable for generation.");
  verified.set(config, Date.now());
  return true;
}
export function geminiRequest(
  config,
  model,
  system,
  input,
  schema,
  editing,
  stream,
  signal,
) {
  return {
    url: `${base}/models/${model}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey,
      },
      signal,
      redirect: "error",
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: input }] }],
        generationConfig: {
          // Gemini 3+ deprecates sampling parameters. The verified Flash model
          // uses low thinking for interactive edits/plans within the fixed time budget.
          ...(/^gemini-[34](?:[.-]|$)/.test(model) ? {} : { temperature: 0.2 }),
          ...(model === "gemini-3.8-flash"
            ? { thinkingConfig: { thinkingLevel: "low" } }
            : {}),
          maxOutputTokens: editing ? 2048 : 10000,
          responseMimeType: "application/json",
          responseJsonSchema: geminiSchema(schema),
        },
      }),
    },
  };
}
export function geminiText(data) {
  if (data.error || data.promptFeedback?.blockReason)
    throw Error("Gemini rejected generation.");
  const candidate = data.candidates?.[0];
  if (!candidate) throw Error("Gemini returned no candidate.");
  if (candidate.finishReason !== "STOP")
    throw Error("Gemini generation did not finish successfully.");
  const parts = candidate.content?.parts ?? [];
  if (parts.some((p) => p.functionCall || p.executableCode))
    throw Error("Unexpected Gemini tool output.");
  return parts
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}
export function isGeminiModelVerified(config) {
  return !!verified.get(config) && Date.now() - verified.get(config) < 300000;
}
