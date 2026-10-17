// Compatible SSE collector: no unvalidated model text is sent to the application.
export async function collectCompletion(
  response,
  onToken,
  provider = "compatible",
) {
  if (!response.headers.get("content-type")?.includes("text/event-stream"))
    throw Error("Expected compatible event stream.");
  const reader = response.body?.getReader();
  if (!reader) throw Error("Provider returned no stream.");
  const decoder = new TextDecoder();
  let pending = "",
    content = "",
    bytes = 0,
    finished = provider !== "gemini";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4194304) throw Error("Provider stream exceeds limit.");
      pending += decoder.decode(value, { stream: true }).replace(/\r/g, "");
      if (pending.length > 262144) throw Error("Provider event exceeds limit.");
      let boundary;
      while ((boundary = pending.indexOf("\n\n")) >= 0) {
        const event = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        const text = event
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        if (!text || text === "[DONE]") continue;
        const data = JSON.parse(text);
        if (data.error) throw Error("Provider returned an error.");
        if (
          provider === "gemini" &&
          (data.promptFeedback?.blockReason ||
            (data.candidates?.[0]?.finishReason &&
              data.candidates[0].finishReason !== "STOP"))
        )
          throw Error("Gemini generation failed or was truncated.");
        if (
          provider === "gemini" &&
          data.candidates?.[0]?.finishReason === "STOP"
        )
          finished = true;
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        if (
          provider === "gemini" &&
          parts.some((p) => p.functionCall || p.executableCode)
        )
          throw Error("Unexpected tool output.");
        const part =
          provider === "gemini"
            ? parts
                .filter((p) => !p.thought && typeof p.text === "string")
                .map((p) => p.text)
                .join("")
            : data.choices?.[0]?.delta?.content;
        if (typeof part === "string" && part) {
          content += part;
          if (content.length > 131072) throw Error("Model plan exceeds limit.");
          onToken(content.length);
        }
      }
    }
    if (pending.trim() || !finished)
      throw Error("Incomplete provider event or generation.");
    return { choices: [{ message: { content } }] };
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
}
