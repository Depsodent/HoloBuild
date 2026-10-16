import { GestureStatus } from "../ui/GestureStatus";
import { useAdvancedStore } from "../../interaction/advancedStore";
import { Accordion } from "../ui/Accordion";
import {
  CAMERA_PROFILES,
  useCameraSettings,
  saveCameraExecution,
  type CameraProfile,
} from "../../vision/cameraSettings";
import { GESTURE_CONFIG } from "../../vision/calibration";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
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
  const mode = useAdvancedStore((s) => s.mode);
  const handCount = useHandsStore((s) => s.hands.length);
  const video = useRef<HTMLVideoElement>(null);
  const tracker = useRef<HandTracker | null>(null);
  const state = useTrackingStore();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [device, setDevice] = useState("");
  const [visible, setVisible] = useState(true);
  const [overlay, setOverlay] = useState(true);
  const settings = useCameraSettings();
  const [applying, setApplying] = useState(false);
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
    const stop = () => instance.stop();
    window.addEventListener("holobuild:stop-camera", stop);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("holobuild:stop-camera", stop);
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
            <span>{handCount} hands</span>
            <span>
              {gesture === "none" ? "No hand" : gesture.replace("-", " ")}
            </span>
            <span title={`Active gesture mode: ${mode}`}>{mode}</span>
          </span>
        )}
        <button
          className="camera-capture"
          aria-label={active ? "Stop Gesture Input camera" : "Start camera"}
          title={active ? "Stop camera" : "Start camera"}
          onClick={() => (active ? tracker.current?.stop() : void start())}
        >
          {active ? "Stop camera" : "Start"}
        </button>
        <button
          aria-label={docked ? "Undock Gesture Input" : "Dock Gesture Input"}
          title={docked ? "Undock Gesture Input" : "Dock Gesture Input"}
          onClick={() => update({ cameraDocked: !docked })}
        >
          {docked ? <ExternalLink size={14} /> : <PanelLeft size={14} />}
        </button>
        <button
          aria-label={
            minimized ? "Expand Gesture Input" : "Minimize Gesture Input"
          }
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
          {overlay && (
            <HandLandmarkOverlay
              active={
                visible && !minimized && (!layout.leftCollapsed || !docked)
              }
            />
          )}
        </div>
        <p className="camera-message" role="status">
          {state.message}
        </p>
        <Accordion id="camera.settings" title="Camera settings">
          <label className="field">
            Tracking quality
            <select
              aria-label="Tracking quality"
              value={settings.profile}
              disabled={applying}
              title="Changing quality cancels uncommitted gestures but keeps capture running"
              onChange={async (e) => {
                setApplying(true);
                try {
                  await tracker.current?.setProfile(
                    e.target.value as CameraProfile,
                  );
                } finally {
                  setApplying(false);
                }
              }}
            >
              {Object.entries(CAMERA_PROFILES).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label} · {p.width}×{p.height} · up to {p.hz} Hz
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Inference execution
            <select
              aria-label="Inference execution"
              value={settings.execution}
              disabled={active}
              onChange={(e) =>
                saveCameraExecution(e.target.value as "main" | "worker")
              }
            >
              <option value="main">Main thread CPU (default)</option>
              <option value="worker">Worker CPU (experimental)</option>
            </select>
          </label>
          <p className="muted">
            Stop capture to switch execution. Compare inference Hz and latency;
            a faster renderer does not imply faster tracking.
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
          <label>
            <input
              type="checkbox"
              checked={overlay}
              onChange={(e) => setOverlay(e.target.checked)}
            />
            Landmarks
          </label>
        </Accordion>
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
        <Accordion id="camera.calibration" title="Pinch calibration">
          <PinchCalibrationReadings />
        </Accordion>
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
function PinchCalibrationReadings() {
  const pinchRatio = useGestureStore((s) => s.pinchRatio);
  return (
    <p className="muted">
      Palm-normalized distance: {pinchRatio?.toFixed(3) ?? "unavailable"}.
      Activate below {GESTURE_CONFIG.pinchOn}; release above{" "}
      {GESTURE_CONFIG.pinchOff}. Dwell {GESTURE_CONFIG.pinchDwellMs} ms.
      Thresholds are unchanged.
    </p>
  );
}
