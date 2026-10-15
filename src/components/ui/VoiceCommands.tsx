import { useEffect, useRef, useState } from "react";
import { Accordion } from "./Accordion";
import {
  CommandInterpreter,
  type CommandResult,
} from "../../commands/interpreter";
import {
  SpeechController,
  recognitionConstructor,
  type SpeechState,
} from "../../commands/speech";
import { saveProject } from "../../assets/saveProject";
import { useAccordionStore } from "../../workspace/accordionStore";
import { StructureGenerator } from "./StructureGenerator";
import { routeInput } from "../../generation/planner";
import {
  planStructure,
  cancelUnconfirmedGeneration,
  useGenerationStore,
} from "../../generation/generationStore";
export function VoiceCommands() {
  const [input, setInput] = useState(""),
    [heard, setHeard] = useState(""),
    [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CommandResult>({
    ok: true,
    message: "Type a command or explicitly start the microphone.",
  });
  const [speech, setSpeech] = useState<SpeechState>({
    status: recognitionConstructor() ? "idle" : "unsupported",
    message: recognitionConstructor()
      ? "Microphone is off."
      : "Speech recognition unavailable. Text commands are ready.",
    transcript: "",
  });
  const [interpreter] = useState(() => new CommandInterpreter(saveProject));
  const controller = useRef<SpeechController | null>(null),
    mounted = useRef(false);
  const open = useAccordionStore((s) => s.open["tools.voice"]);
  const quickOpen = useAccordionStore((s) => s.open["tools.quick"]);
  async function dispatch(text: string): Promise<CommandResult> {
    const route = routeInput(text);
    if (route === "structure") {
      if (interpreter.awaitingConfirmation)
        return {
          ok: false,
          confirmation: true,
          message:
            "Confirm or cancel the pending quick command before planning.",
        };
      useAccordionStore.getState().setOpen("tools.generator", true);
      await planStructure(text);
      const state = useGenerationStore.getState();
      return { ok: state.status === "preview", message: state.message };
    }
    if (route === "clarify")
      return {
        ok: false,
        confirmation: interpreter.awaitingConfirmation,
        message:
          "Unsupported or ambiguous command. Please clarify: use a supported quick command or Build/Generate <structure>. See examples.",
      };
    return interpreter.run(text);
  }
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  useEffect(() => {
    mounted.current = true;
    controller.current = new SpeechController(
      recognitionConstructor(),
      (s) => {
        if (mounted.current) setSpeech(s);
      },
      (text) => {
        setHeard(text);
        setBusy(true);
        void dispatchRef.current(text).then((r) => {
          if (mounted.current) {
            setResult(r);
            setBusy(false);
          }
        });
      },
    );
    const hide = () => {
      if (document.hidden) controller.current?.stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      mounted.current = false;
      controller.current?.stop();
      cancelUnconfirmedGeneration();
      document.removeEventListener("visibilitychange", hide);
    };
  }, [interpreter]);
  const active = speech.status === "starting" || speech.status === "listening";
  useEffect(() => {
    if ((!open || !quickOpen) && active) controller.current?.stop();
  }, [open, quickOpen, active]);
  useEffect(() => {
    if (!open) cancelUnconfirmedGeneration();
  }, [open]);
  async function submit() {
    setBusy(true);
    setHeard("");
    const r = await dispatch(input);
    if (mounted.current) {
      setResult(r);
      setBusy(false);
    }
  }
  return (
    <Accordion id="tools.voice" title="Voice & AI Commands">
      <div className="voice-commands">
        <Accordion id="tools.quick" title="Quick Commands">
          <p className="muted">
            Quick commands use the deterministic interpreter.
          </p>
          <div className="object-actions">
            <button
              disabled={active || speech.status === "unsupported"}
              onClick={() => controller.current?.start()}
            >
              Start listening
            </button>
            <button
              disabled={!active}
              onClick={() => controller.current?.stop()}
            >
              Stop listening
            </button>
          </div>
          <p role="status" aria-label="Listening status">
            {speech.message}
          </p>
          {speech.transcript && (
            <p className="voice-transcript" aria-label="Live transcript">
              {speech.transcript}
            </p>
          )}
          {heard && <p className="voice-transcript">Heard: “{heard}”</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label htmlFor="construction-command">Text command</label>
            <input
              id="construction-command"
              value={input}
              maxLength={240}
              placeholder="Create a cube"
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" disabled={busy || !input.trim()}>
              Execute command
            </button>
          </form>
          <p
            role="status"
            aria-label="Command result"
            className={result.ok ? "" : "command-error"}
          >
            {result.message}
          </p>
          {result.confirmation && (
            <div className="object-actions">
              <button
                onClick={() => {
                  controller.current?.stop();
                  setResult(interpreter.confirm());
                }}
              >
                Confirm command
              </button>
              <button onClick={() => setResult(interpreter.cancel())}>
                Cancel command
              </button>
            </div>
          )}
          <p className="muted">
            Speech may send audio to your browser provider's service. It is not
            guaranteed offline or private. Collapsing tools stops listening;
            camera tracking is independent.
          </p>
          <Accordion id="tools.voice-help" title="Command examples">
            <p>
              Create a cube · Add a sphere · Select last created object · Select
              Cube · Move it right by 2 meters · Rotate it by 45 degrees · Scale
              it by 1.5 · Duplicate it · Delete it · Make it red · Apply wood
              material · Undo · Redo · Save the scene · Clear selection
            </p>
            <p>
              World axes: right +X, up +Y, forward −Z. Rotation is positive
              world-Y yaw. Distances default to metres; cm, mm, feet and inches
              work. Grid snapping and collision limits still apply. One command
              per sentence. Delete/clear require the Confirm button.
            </p>
          </Accordion>
        </Accordion>
        <StructureGenerator />
      </div>
    </Accordion>
  );
}
