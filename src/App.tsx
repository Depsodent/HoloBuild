import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { GestureCursor } from "./components/ui/GestureCursor";
import { GestureMenu } from "./components/ui/GestureMenu";
import { InteractionStatus } from "./components/ui/InteractionStatus";
import {
  Box,
  Undo2,
  Redo2,
  Download,
  Upload,
  CircleHelp,
  RotateCcw,
  PanelsTopLeft,
  Activity,
  CameraOff,
} from "lucide-react";
import { Scene } from "./components/viewport/Scene";
import { useSceneStore } from "./scene/sceneStore";
import { execute, undo, redo } from "./scene/commandManager";
import { loadProject } from "./assets/projectIO";
import { saveProject } from "./assets/saveProject";
import { MAX_PROJECT_CHARS } from "./assets/assetTypes";
import { startModelCleanup } from "./assets/modelRegistry";
import type { Tool } from "./scene/objectTypes";
import { startGesturePipeline } from "./vision/gesturePipeline";
import { useInteractionStore } from "./interaction/interactionStore";
import { HandGuides } from "./components/ui/HandGuides";
import { WorkspaceLayout } from "./workspace/WorkspaceLayout";
import { CompactHint } from "./workspace/CompactHint";
import { useWorkspaceLayout } from "./workspace/layoutStore";
import { useTrackingStore } from "./vision/trackingStore";
export default function App() {
  const cameraActive = useTrackingStore(
    (s) => s.status === "running" || s.status === "starting",
  );
  useEffect(startGesturePipeline, []);
  useEffect(startModelCleanup, []);
  const s = useSceneStore(
    useShallow(({ objects, past, future, status, fps, tool }) => ({
      objects,
      past,
      future,
      status,
      fps,
      tool,
    })),
  );
  const file = useRef<HTMLInputElement>(null);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    function keys(e: KeyboardEvent) {
      if (
        (e.target as HTMLElement).closest("input,select,textarea") ||
        e.altKey
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.ctrlKey || e.metaKey) return;
      const tool = { v: "select", g: "translate", r: "rotate", s: "scale" }[
        e.key
      ] as Tool | undefined;
      if (tool) useSceneStore.getState().setTool(tool);
      if (e.key === "Escape") useSceneStore.getState().select(null);
      if (e.key === "Delete" && useSceneStore.getState().selectedId)
        execute({ type: "delete", id: useSceneStore.getState().selectedId! });
    }
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);
  async function save() {
    try {
      await saveProject();
    } catch (error) {
      useSceneStore.setState({
        status: `Could not save: ${error instanceof Error ? error.message : "Check storage permissions."}`,
      });
    }
  }
  return (
    <main>
      <header>
        <div className="brand">
          <Box size={30} />
          <div>
            HOLO<span>BUILD</span>
            <small>SPATIAL CONSTRUCTION STUDIO</small>
          </div>
        </div>
        <div className="project">
          <span className="status-dot" />
          Untitled workspace <span className="badge">LOCAL</span>
        </div>
        <nav aria-label="Project actions">
          {cameraActive && (
            <button
              className="stop-camera"
              aria-label="Stop camera"
              title="Stop camera immediately"
              onClick={() =>
                window.dispatchEvent(new Event("holobuild:stop-camera"))
              }
            >
              <CameraOff size={17} />
            </button>
          )}
          <button
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            disabled={!s.past.length}
            onClick={undo}
          >
            <Undo2 size={17} />
          </button>
          <button
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            disabled={!s.future.length}
            onClick={redo}
          >
            <Redo2 size={17} />
          </button>
          <i />
          <button
            aria-label="Load"
            title="Load scene JSON"
            onClick={() => file.current?.click()}
          >
            <Upload size={16} />
            <span className="project-action-label">Load</span>
          </button>
          <button
            className="primary"
            aria-label="Save project"
            title="Save project"
            onClick={save}
          >
            <Download size={16} />
            <span className="project-action-label">Save project</span>
          </button>
          <button
            title="Reset scene"
            aria-label="Reset scene"
            onClick={() => {
              if (confirm("Clear the scene? You can undo this action."))
                execute({ type: "reset" });
            }}
          >
            <RotateCcw size={17} />
          </button>
          <button aria-label="Help" onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
          </button>
          <button
            aria-label="Toggle Gesture Diagnostics"
            title="Show or hide Gesture Diagnostics"
            onClick={() =>
              useWorkspaceLayout.getState().update({
                diagnosticsVisible:
                  !useWorkspaceLayout.getState().layout.diagnosticsVisible,
              })
            }
          >
            <Activity size={17} />
          </button>
          <button
            aria-label="Reset Workspace Layout"
            title="Reset Workspace Layout"
            onClick={() => useWorkspaceLayout.getState().reset()}
          >
            <PanelsTopLeft size={17} />
          </button>
        </nav>
        <input
          ref={file}
          hidden
          type="file"
          accept=".json"
          onChange={async (e) => {
            try {
              const f = e.target.files?.[0];
              if (f) {
                if (f.size > MAX_PROJECT_CHARS)
                  throw Error("Project exceeds 30 MiB.");
                useSceneStore.setState({
                  status: "Loading project and model assets…",
                });
                await loadProject(await f.text());
              }
            } catch (error) {
              useSceneStore.setState({
                status: `Invalid scene file: ${error instanceof Error ? error.message : "Load valid HoloBuild JSON."}`,
              });
            }
            e.target.value = "";
          }}
        />
      </header>
      <WorkspaceLayout>
        <section className="viewport" aria-label="3D construction viewport">
          <Scene />
          <div className="viewport-heading">
            <div>
              <span className="eyebrow">WORKSPACE / 01</span>
              <h1>
                A new dimension
                <br />
                <span>for your ideas.</span>
              </h1>
            </div>
            <span className="view-label">
              PERSPECTIVE <span>⌖</span>
            </span>
          </div>
          <div className="viewport-bottom">
            <span>
              <span className="status-dot" /> LIVE WORKSPACE
            </span>
            <span>Drag to orbit · Scroll to zoom · Right-drag to pan</span>
          </div>
          <GestureCursor />
          <GestureMenu />
          <HandGuides />
          <InteractionStatus />
        </section>
      </WorkspaceLayout>
      <footer>
        <span className="status">
          <span className="status-dot" />
          {s.status}
        </span>
        <span title="Three.js rendering only; camera and inference rates are in Gesture Diagnostics">
          {s.fps} RENDER FPS
        </span>
        <span>{s.objects.length} OBJECTS</span>
        <span>{s.tool.toUpperCase()}</span>
        <CompactHint />
        <span className="credit">
          Made by <b>Aaryan</b>
        </span>
      </footer>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace help"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="eyebrow">QUICK START</div>
            <h2>Your spatial workspace</h2>
            <p>
              Create a cube, sphere, cylinder, cone, wall, or floor from the
              right panel. Select it, then use Move, Rotate, or Scale to show
              its 3D handles. The inspector provides precise numeric transforms.
            </p>
            <p>
              Drag empty space to orbit. Scroll to zoom. Right-drag to pan. V
              selects; G moves; R rotates; S scales. Delete removes the
              selection. Ctrl+Z undoes an action.
            </p>
            <p>
              Save project downloads JSON and stores a local copy. Load imports
              validated JSON. Camera use is optional.
            </p>
            <p>
              Start camera and hold one hand in view. Point at an object, pinch
              thumb and index to grab, move, then reopen your hand to place.
              Movement stays at the cube’s current height. A red preview means
              placement is blocked. Losing your hand or closing it into a fist
              cancels the move.
            </p>
            <p>
              The gesture menu opens from Help or the optional sustained-palm
              setting. Point and pinch a card to confirm a tool. Automatic
              activation is disabled by default and requires a fresh palm hold
              after neutral rearming; releasing a pinch never opens it.
            </p>
            <p>
              Select an object and choose Gesture mode in the camera panel.
              Scale: pinch both hands and change their separation. Rotation:
              pinch both and tilt the line between them; only world-Y yaw
              changes. Camera pan: choose its mode and pinch one hand to move
              the view. Release to confirm. Hand loss, mouse takeover and scene
              edits cancel active operations.
            </p>
            <button
              onClick={() => {
                setHelp(false);
                useInteractionStore.setState({ menuOpen: true });
              }}
            >
              Open gesture tools
            </button>
            <button className="primary" onClick={() => setHelp(false)}>
              Let’s build
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
