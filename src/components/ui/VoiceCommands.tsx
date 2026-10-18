import { useToolsStore } from "../../workspace/toolsStore";
import { PlannerActivity } from "./PlannerActivity";
import { plannerStage } from "../../generation/plannerTransport";
import { StructureEditReview } from "./StructureEditReview";
import { isStructureEdit } from "../../generation/editPlanner";
import {
  requestEdit,
  useEditStore,
  cancelEdit,
} from "../../generation/editStore";
import { useSceneStore } from "../../scene/sceneStore";
import { cancelGeneration } from "../../generation/generationStore";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import type { PlannerMode } from "../../generation/planner";
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

import { StructureGenerator } from "./StructureGenerator";
import { routeInput } from "../../generation/planner";
import {
  planStructure,
  updateGeneration,
  cancelUnconfirmedGeneration,
  useGenerationStore,
} from "../../generation/generationStore";
export function VoiceCommands() {
  const generation = useGenerationStore();
  const editStatus = useEditStore((s) => s.status);
  const input = generation.prompt;
  const [commandsOnly, setCommandsOnly] = useState(false);
  const [heard, setHeard] = useState(""),
    [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CommandResult>({
    ok: true,
    message: "",
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
  const open = useToolsStore((s) => s.tab === "ai");
  const view = useToolsStore((s) => s.aiView);
  const [autoSubmit, setAutoSubmit] = useState(() => {
    try {
      return localStorage.getItem("holobuild.voice-auto-submit.v1") !== "false";
    } catch {
      return true;
    }
  });
  const autoSubmitRef = useRef(autoSubmit);
  autoSubmitRef.current = autoSubmit;
  const busyRef = useRef(false);

  async function dispatch(text: string): Promise<CommandResult> {
    const route = routeInput(text);
    if (
      isStructureEdit(text, !!useSceneStore.getState().selectedStructureId) ||
      (!commandsOnly && generation.mode !== "offline" && route === "clarify")
    ) {
      if (interpreter.awaitingConfirmation)
        return {
          ok: false,
          confirmation: true,
          message: "Confirm or cancel the pending quick command first.",
        };
      cancelGeneration("");
      const settings = useGenerationStore.getState();
      await requestEdit(text, {
        mode: commandsOnly ? "offline" : settings.mode,
        model: settings.model,
        timeoutMs: settings.timeoutMs,
      });
      return { ok: useEditStore.getState().status !== "error", message: "" };
    }
    cancelEdit();
    if (route === "structure" && commandsOnly)
      return {
        ok: false,
        message:
          "Building requests need Auto, LLM or Offline mode. Switch from Commands, then send the same text or transcript again.",
      };
    if (route === "structure" && !commandsOnly) {
      if (interpreter.awaitingConfirmation)
        return {
          ok: false,
          confirmation: true,
          message:
            "Confirm or cancel the pending quick command before planning.",
        };

      await planStructure(text);
      const state = useGenerationStore.getState();
      return { ok: state.status === "preview", message: "" };
    }
    if (route === "clarify")
      return {
        ok: false,
        confirmation: interpreter.awaitingConfirmation,
        message:
          "Unsupported or ambiguous command. Please clarify: use a supported quick command or Build/Generate <structure>. See examples.",
      };
    plannerStage("Idle");
    plannerStage("Complete", "Deterministic command");
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
        if (!mounted.current || busyRef.current) return;
        setHeard(text);
        updateGeneration({ prompt: text });
        if (!autoSubmitRef.current) return;
        busyRef.current = true;
        setBusy(true);
        void dispatchRef
          .current(text)
          .then((r) => {
            if (mounted.current) setResult(r);
          })
          .finally(() => {
            busyRef.current = false;
            if (mounted.current) setBusy(false);
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
    if (!open && active) controller.current?.stop();
  }, [open, active]);

  const [slowSpeech, setSlowSpeech] = useState(false);
  useEffect(() => {
    setSlowSpeech(false);
    if (!active) return;
    const timer = setTimeout(() => setSlowSpeech(true), 8000);
    return () => clearTimeout(timer);
  }, [active]);
  async function submit() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setHeard("");
    controller.current?.stop();
    try {
      const r = await dispatch(input);
      if (mounted.current) setResult(r);
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section aria-label="Ask HoloBuild tools">
      <div className="voice-commands">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="construction-command">Ask HoloBuild</label>
          <div className="ask-input-row">
            <input
              id="construction-command"
              value={input}
              maxLength={1200}
              placeholder="Create a cube or build a house"
              onChange={(e) => updateGeneration({ prompt: e.target.value })}
            />
            <button
              type="button"
              aria-label={active ? "Stop listening" : "Start listening"}
              title={
                active
                  ? "Stop listening"
                  : "Start microphone · audio may use your browser provider"
              }
              disabled={speech.status === "unsupported"}
              onClick={() =>
                active
                  ? controller.current?.stop()
                  : controller.current?.start()
              }
            >
              {active ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          </div>
          <label className="ask-mode">
            Mode
            <select
              aria-label="Planner mode"
              value={commandsOnly ? "commands" : generation.mode}
              onChange={(e) => {
                setCommandsOnly(e.target.value === "commands");
                if (e.target.value === "commands") updateGeneration({});
                if (e.target.value !== "commands")
                  updateGeneration({ mode: e.target.value as PlannerMode });
              }}
            >
              <option value="commands">Commands</option>
              <option value="offline">Offline</option>
              <option value="auto">Auto</option>
              <option value="llm">LLM</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={
              busy ||
              generation.status === "planning" ||
              editStatus === "planning" ||
              !input.trim()
            }
          >
            Send request
          </button>
        </form>
        <PlannerActivity />
        {(active || heard || busy) && (
          <button
            onClick={() => {
              controller.current?.stop();
              cancelUnconfirmedGeneration();
              setHeard("");
              setResult(interpreter.cancel());
            }}
          >
            Cancel voice request
          </button>
        )}
        <p role="status" aria-label="Listening status" className="muted">
          {speech.message}
        </p>
        {slowSpeech && active && (
          <p role="status" className="muted">
            Waiting for the browser speech service. You can stop and type
            instead.
          </p>
        )}
        {speech.transcript && active && (
          <p className="voice-transcript" aria-label="Live transcript">
            {speech.transcript}
          </p>
        )}
        {heard && <p className="voice-transcript">Heard: “{heard}”</p>}
        {result.message && (
          <p
            role="status"
            aria-label="Command result"
            className={result.ok ? "" : "command-error"}
          >
            {result.message}
          </p>
        )}
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
        <StructureEditReview />
        <nav className="ai-secondary-nav" aria-label="AI views">
          {(["main", "settings", "help"] as const).map((key) => (
            <button
              key={key}
              aria-pressed={view === key}
              onClick={() =>
                useToolsStore.setState({ aiView: view === key ? "main" : key })
              }
            >
              {key === "main"
                ? "Request"
                : key === "settings"
                  ? "AI Settings"
                  : "AI Help"}
            </button>
          ))}
        </nav>
        {view === "settings" && (
          <label className="toggle">
            <input
              type="checkbox"
              aria-label="Auto-submit final transcript"
              checked={autoSubmit}
              onChange={(e) => {
                setAutoSubmit(e.target.checked);
                try {
                  localStorage.setItem(
                    "holobuild.voice-auto-submit.v1",
                    String(e.target.checked),
                  );
                } catch {
                  /* Session preference. */
                }
              }}
            />
            Auto-submit final transcript
          </label>
        )}
        <StructureGenerator view={view} />
        {view === "help" && (
          <Accordion id="tools.voice-help" title="Help & examples">
            <p>
              Create a cube · Move it right by 2 meters · Rotate it by 45
              degrees · Make it red · Apply wood material · Undo · Save the
              scene · Build a house. Select the whole house · Move the entire
              house right by 2 meters · Change all walls to brick · Add another
              floor.
            </p>
            <p>
              Quick commands always use the deterministic interpreter. Structure
              requests use the chosen planner. One command per sentence; delete
              and clear require confirmation.
            </p>
            <p>
              World axes: right +X, up +Y, forward −Z. Rotation is world-Y yaw.
              Grid snapping and collision limits apply.
            </p>
            <p>
              Speech may send audio to your browser provider. Leaving AI
              HoloBuild stops listening; webcam tracking stays independent.
            </p>
          </Accordion>
        )}
      </div>
    </section>
  );
}
