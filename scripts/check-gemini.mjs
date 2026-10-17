import fs from "node:fs/promises";
// Run with --env-file-if-exists=.env.gemini.local. Never logs credentials.
const key = process.env.GEMINI_API_KEY,
  selected = process.env.GEMINI_MODEL;
if (!key) {
  console.error(
    "Set GEMINI_API_KEY in the ignored local environment or secure host settings; never paste it into chat.",
  );
  process.exitCode = 1;
} else {
  try {
    const models = [];
    let token = "";
    for (let page = 0; page < 5; page++) {
      const endpoint = new URL(
        "https://generativelanguage.googleapis.com/v1beta/models",
      );
      endpoint.searchParams.set("pageSize", "100");
      if (token) endpoint.searchParams.set("pageToken", token);
      const response = await fetch(endpoint, {
        headers: { "x-goog-api-key": key },
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      });
      if (!response.ok) throw Error("Metadata request failed.");
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let text = "",
        bytes = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 1048576) {
          await reader.cancel();
          throw Error("Metadata size limit.");
        }
        text += decoder.decode(value, { stream: true });
      }
      const data = JSON.parse(text + decoder.decode());
      for (const model of data.models ?? []) {
        if (
          model.supportedGenerationMethods?.includes("generateContent") &&
          /^models\/gemini-[a-zA-Z0-9_.-]+$/.test(model.name)
        )
          models.push(model.name.slice(7));
      }
      token = data.nextPageToken;
      if (!token) break;
    }
    const available = [...new Set(models)];
    if (process.argv.includes("--write"))
      await fs.writeFile(
        "docs/GEMINI_MODELS.json",
        JSON.stringify(
          {
            checkedAt: new Date().toISOString(),
            availableModels: available,
            configuredModel: selected || null,
            configuredModelVerified: available.includes(selected),
            generationPerformed: false,
          },
          null,
          2,
        ) + "\n",
      );
    console.log(
      JSON.stringify(
        {
          availableModels: available,
          configuredModel: selected || null,
          configuredModelVerified: selected
            ? available.includes(selected)
            : false,
          generationPerformed: false,
        },
        null,
        2,
      ),
    );
    if (selected && !available.includes(selected)) process.exitCode = 1;
  } catch {
    console.error(
      "Gemini metadata verification failed. Check the key, account permissions and network; credentials and provider response bodies are redacted.",
    );
    process.exitCode = 1;
  }
}
