import { GestureStatus } from "../ui/GestureStatus";
import { AdvancedGestures } from "../ui/AdvancedGestures";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Eye,
  EyeOff,
  Minus,
  Maximize2,
  RotateCcw,
  ChevronDown,
  Grip,
  ExternalLink,
  PanelLeft,
} from "lucide-react";
import { useFloatingPanel } from "./useFloatingPanel";
import { useWorkspaceLayout } from "../../workspace/layoutStore";
import { useGestureStore } from "../../vision/gesturePipeline";
import { useHandsStore } from "../../vision/handsStream";
import { HandTracker } from "../../vision/handTracker";
import { useTrackingStore } from "../../vision/trackingStore";
import { HandLandmarkOverlay } from "./HandLandmarkOverlay";
import "./WebcamPreview.css";
export function WebcamPreview() {
  const panel = useRef<HTMLElement>(null);
  const { layout, update } = useWorkspaceLayout();
  const floating = useFloatingPanel(panel, {
    boundarySelector: ".workspace",
    minimized: layout.cameraMinimized,
  });
  const minimized = layout.cameraMinimized;
  const docked = layout.cameraDocked;
  const gesture = useGestureStore((s) => s.gesture);
  const handCount = useHandsStore((s) => s.hands.length);
  const video = useRef<HTMLVideoElement>(null);
  const tracker = useRef<HandTracker | null>(null);
  const state = useTrackingStore();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [device, setDevice] = useState("");
  const [visible, setVisible] = useState(true);
  const [overlay, setOverlay] = useState(true);
  useEffect(() => {
    const instance = new HandTracker();
    tracker.current = instance;
    const hide = () => {
      if (document.hidden)
        instance.stop(
          "Camera paused because the tab is hidden. Press Start camera to resume.",
        );
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      instance.stop();
    };
  }, []);
  const active = state.status === "running" || state.status === "starting";
  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      useTrackingStore.setState({
        status: "error",
        message:
          "Camera access needs localhost or HTTPS and a supported browser.",
      });
      return;
    }
    if (video.current)
      await tracker.current?.start(video.current, device || undefined);
    try {
      setDevices(
        (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === "videoinput",
        ),
      );
    } catch {
      /* Camera selection is optional. */
    }
  }
  return (
    <section
      ref={panel}
      style={docked ? undefined : floating.style}
      className={`webcam-panel floating-camera ${docked ? "docked-camera" : "undocked-camera"} ${minimized ? "minimized" : ""}`}
      aria-label="Gesture camera"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="camera-title">
        <Camera size={16} />
        {docked ? (
          <strong className="camera-heading">Gesture input</strong>
        ) : (
          <div
            className="camera-drag-handle"
            role="button"
            tabIndex={0}
            aria-label="Move Gesture Input window"
            title="Drag to move · Arrow keys move · Shift moves faster"
            data-layout-handle
            {...floating.handle("move")}
          >
            <strong>Gesture input</strong>
          </div>
        )}
        <span className={`badge ${active ? "live" : ""}`}>
          {state.status.toUpperCase()}
        </span>
        {minimized && (
          <span
            className="camera-compact-status"
            title={`${handCount} tracked hands · ${gesture === "none" ? "No hand" : gesture}`}
          >
            {handCount > 0 && <span>{handCount}H</span>}
            <span>{gesture === "none" ? "No hand" : gesture.replace("-", " ")}</span>
          </span>
        )}
        <button
          aria-label={docked ? "Undock Gesture Input" : "Dock Gesture Input"}
          title={docked ? "Undock Gesture Input" : "Dock Gesture Input"}
          onClick={() => update({ cameraDocked: !docked })}
        >
          {docked ? <ExternalLink size={14} /> : <PanelLeft size={14} />}
        </button>
        <button
          aria-label={minimized ? "Expand Gesture Input" : "Minimize Gesture Input"}
          title={minimized ? "Expand Gesture Input" : "Minimize Gesture Input"}
          onClick={() => update({ cameraMinimized: !minimized })}
        >
          {minimized ? <ChevronDown size={14} /> : <Minus size={14} />}
        </button>
      </div>
      <div className="camera-body" hidden={minimized}>
        <div
          className="camera-feed"
          style={{ display: visible && active ? "block" : "none" }}
        >
          <video ref={video} muted playsInline aria-label="Webcam preview" />
          {overlay && <HandLandmarkOverlay />}
        </div>
        <p className="camera-message" role="status">
          {state.message}
        </p>
        {devices.length > 1 && (
          <select
            aria-label="Camera device"
            disabled={active}
            value={device}
            onChange={(e) => setDevice(e.target.value)}
          >
            <option value="">Default camera</option>
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        )}
        <div className="camera-actions">
          {active ? (
            <button onClick={() => tracker.current?.stop()}>
              <CameraOff size={14} />
              Stop camera
            </button>
          ) : (
            <button className="primary" onClick={start}>
              <Camera size={14} />
              Start camera
            </button>
          )}
          <label>
            <input
              type="checkbox"
              checked={overlay}
              onChange={(e) => setOverlay(e.target.checked)}
            />
            Landmarks
          </label>
        </div>
        <div className="camera-view-actions">
          <button
            aria-label={visible ? "Hide camera preview" : "Show camera preview"}
            title={visible ? "Hide camera preview" : "Show camera preview"}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff size={14} /> : <Eye size={14} />}
            {visible ? "Hide preview" : "Show preview"}
          </button>
          {!docked && (
            <>
              <button
                aria-label="Maximize or restore Gesture Input"
                title="Maximize or restore Gesture Input"
                onClick={floating.maximize}
              >
                <Maximize2 size={14} />
              </button>
              <button
                aria-label="Reset Gesture Input layout"
                title="Reset Gesture Input layout"
                onClick={floating.reset}
              >
                <RotateCcw size={14} />
              </button>
            </>
          )}
        </div>
        <GestureStatus />
        <AdvancedGestures />
        <div className="camera-meta">
          {state.status === "running"
            ? `${handCount ? `${handCount} hands · ${handCount * 21} landmarks` : "No hand"} · ${state.inferenceHz} Hz · ${state.inferenceMs} ms`
            : "Private by design · frames stay on device"}
        </div>
      </div>
      {!docked && !minimized && (
        <button
          className="camera-resize"
          aria-label="Resize Gesture Input window"
          title="Drag to resize · Arrow keys resize"
          data-layout-handle
          {...floating.handle("resize")}
        >
          <Grip size={16} />
        </button>
      )}
    </section>
  );
}
