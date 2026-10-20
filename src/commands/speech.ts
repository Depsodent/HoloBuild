export interface SpeechResults {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
export interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechResults) => void) | null;
  onnomatch: (() => void) | null;
  start(): void;
  stop?(): void;
  abort(): void;
}
export type RecognitionConstructor = new () => Recognition;
export function recognitionConstructor(): RecognitionConstructor | undefined {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}
export type SpeechState = {
  status: "idle" | "starting" | "listening" | "error" | "unsupported";
  message: string;
  transcript: string;
};
export class SpeechController {
  private recognition: Recognition | null = null;
  private generation = 0;
  private transcript = "";
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private factory: RecognitionConstructor | undefined,
    private change: (state: SpeechState) => void,
    private final: (text: string) => void,
  ) {}
  start() {
    if (this.recognition) return;
    if (globalThis.isSecureContext === false) {
      this.change({
        status: "error",
        message:
          "Microphone requires HTTPS or localhost. Open the secure website, or type your request.",
        transcript: this.transcript,
      });
      return;
    }
    if (!this.factory) {
      this.change({
        status: "unsupported",
        message: "Speech recognition is unavailable. Type a command instead.",
        transcript: "",
      });
      return;
    }
    clearTimeout(this.timer);
    const generation = ++this.generation;
    let r: Recognition;
    try {
      r = new this.factory();
    } catch {
      this.change({
        status: "error",
        message:
          "Microphone recognition could not initialize. Text commands remain available.",
        transcript: "",
      });
      return;
    }
    this.recognition = r;
    const seen = new Set<number>();
    let transcript = "",
      failed = false;
    const current = () =>
      generation === this.generation && this.recognition === r;
    r.continuous = false;
    r.interimResults = true;
    r.lang = "en-US";
    r.maxAlternatives = 1;
    this.change({
      status: "starting",
      message: "Starting microphone…",
      transcript,
    });
    r.onstart = () => {
      if (current())
        this.change({ status: "listening", message: "Listening…", transcript });
    };
    r.onresult = (e) => {
      if (!current() || failed) return;
      transcript = Array.from(e.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .slice(-500);
      this.change({ status: "listening", message: "Listening…", transcript });
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal || seen.has(i)) continue;
        seen.add(i); // Result indices are stable within one recognition session.
        const text = e.results[i][0]?.transcript.trim();
        if (text) {
          this.transcript = text;
          clearTimeout(this.timer);
          this.recognition = null;
          this.generation++;
          r.onstart = r.onend = r.onnomatch = null;
          r.onresult = r.onerror = null;
          try {
            r.abort();
          } catch {
            /* Already finalized. */
          }
          this.change({
            status: "idle",
            message: "Final transcript ready.",
            transcript: text,
          });
          this.final(text);
          break;
        }
      }
    };
    r.onnomatch = () => {
      if (current())
        this.change({
          status: "listening",
          message: "Speech not understood. Try again or type a command.",
          transcript,
        });
    };
    r.onerror = (e) => {
      if (!current()) return;
      failed = true;
      const errors: Record<string, string> = {
        "not-allowed":
          "Microphone permission denied. Allow microphone access in browser settings or use text.",
        "service-not-allowed":
          "Speech service denied access. Use text commands.",
        "audio-capture":
          "Microphone unavailable or busy. Check your input device.",
        network: "Speech service network error. Text commands still work.",
        "no-speech": "No speech detected. Press Start listening to retry.",
        aborted: "Listening cancelled.",
        "language-not-supported":
          "English recognition is unavailable in this browser.",
      };
      this.change({
        status: "error",
        message:
          errors[e.error] ??
          "Speech recognition failed. Use text or press Start listening to retry.",
        transcript,
      });
      this.recognition = null;
      this.generation++;
      clearTimeout(this.timer);
      try {
        r.abort();
      } catch {
        /* Service already ended. */
      }
    };
    r.onend = () => {
      if (current()) {
        clearTimeout(this.timer);
        this.recognition = null;
        this.change({
          status: "idle",
          message: "Listening ended. Press Start listening to resume.",
          transcript,
        });
      }
    };
    try {
      r.start();
    } catch {
      if (current()) {
        this.recognition = null;
        this.generation++;
        this.change({
          status: "error",
          message:
            "Could not start microphone. Check permissions and use text if unavailable.",
          transcript,
        });
      }
    }
  }
  stop() {
    const r = this.recognition;
    if (!r) return;
    if (!r.stop) {
      this.cancel();
      return;
    }
    this.change({
      status: "listening",
      message:
        "Finishing captured speech… Final text will remain available to send.",
      transcript: this.transcript,
    });
    try {
      r.stop();
    } catch {
      this.cancel(
        "Microphone ended. Finalized text is preserved; restart or type your request.",
      );
      return;
    }
    clearTimeout(this.timer);
    if(this.recognition===r)this.timer = setTimeout(
      () =>
        this.cancel(
          "Speech service did not finalize. Finalized text is preserved; retry or use text.",
        ),
      4000,
    );
  }
  cancel(message = "Microphone paused. Finalized text is preserved.") {
    clearTimeout(this.timer);
    const r = this.recognition;
    if(!r)return;
    this.recognition = null;
    this.generation++;
    if (r) {
      r.onstart = r.onend = r.onnomatch = null;
      r.onresult = r.onerror = null;
      try {
        r.abort();
      } catch {
        /* Already ended. */
      }
    }
    this.change({
      status: this.factory ? "idle" : "unsupported",
      message,
      transcript: this.transcript,
    });
  }
}

/** Read-only checks: never opens a second recording stream or promises recognition support. */
export async function microphonePrecheck(): Promise<string | null> {
  if (!recognitionConstructor())
    return "Speech recognition is unavailable in this browser. Type your request instead.";
  if (!window.isSecureContext)
    return "Use HTTPS or localhost for microphone access.";
  try {
    const result = await navigator.permissions?.query({
      name: "microphone" as PermissionName,
    });
    if (result?.state === "denied")
      return "Microphone permission denied. Allow this site's microphone in browser settings, then retry; text remains available.";
  } catch {
    /* Some compatible browsers cannot query microphone permissions. */
  }
  return null;
}
