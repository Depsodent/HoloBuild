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
} from "lucide-react";
import { Scene } from "./components/viewport/Scene";
import { Toolbar } from "./components/ui/Toolbar";
import { ObjectInspector } from "./components/ui/ObjectInspector";
import { useSceneStore } from "./scene/sceneStore";
import { execute, undo, redo } from "./scene/commandManager";
import { serialize, deserialize } from "./scene/sceneSerializer";
import { WebcamPreview } from "./components/camera/WebcamPreview";
import type { Tool } from "./scene/objectTypes";
import { startGesturePipeline } from "./vision/gesturePipeline";
export default function App() {
  useEffect(startGesturePipeline, []);
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
  function save() {
    try {
      const json = serialize(s.objects);
      localStorage.setItem("holobuild.scene", json);
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "holobuild-scene.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      useSceneStore.setState({
        status: "Saved locally and exported scene JSON.",
      });
    } catch {
      useSceneStore.setState({
        status: "Could not save. Check browser storage permissions.",
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
          <button onClick={() => file.current?.click()}>
            <Upload size={16} />
            Load
          </button>
          <button className="primary" onClick={save}>
            <Download size={16} />
            Save project
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
                if (f.size > 1_000_000) throw Error();
                execute({
                  type: "replace",
                  objects: deserialize(await f.text()),
                });
              }
            } catch {
              useSceneStore.setState({
                status:
                  "Invalid scene file. Load a HoloBuild version 1 JSON with valid object values.",
              });
            }
            e.target.value = "";
          }}
        />
      </header>
      <div className="workspace">
        <Toolbar />
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
          <WebcamPreview />
          <GestureCursor />
          <GestureMenu />
          <InteractionStatus />
        </section>
        <ObjectInspector />
      </div>
      <footer>
        <span className="status">
          <span className="status-dot" />
          {s.status}
        </span>
        <span>{s.fps} FPS</span>
        <span>{s.objects.length} OBJECTS</span>
        <span>{s.tool.toUpperCase()}</span>
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
              Create a cube from the left panel. Select it, then use Move,
              Rotate, or Scale to show its 3D handles. The inspector provides
              precise numeric transforms.
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
              Start camera and hold one hand in view. Point at a cube, pinch
              thumb and index to grab, move, then reopen your hand to place.
              Movement stays at the cube’s current height. A red preview means
              placement is blocked. Losing your hand or closing it into a fist
              cancels the move.
            </p>
            <p>
              Hold an open palm to open the gesture menu. Point and pinch a card
              to create a cube, undo, or close. Rotate and scale remain
              available through the mouse controls.
            </p>
            <button className="primary" onClick={() => setHelp(false)}>
              Let’s build
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
