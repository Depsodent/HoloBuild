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
} from "lucide-react";
import { useFloatingPanel } from "./useFloatingPanel";
import { useGestureStore } from "../../vision/gesturePipeline";
import { useHandsStore } from "../../vision/handsStream";
import { HandTracker } from "../../vision/handTracker";
import { useTrackingStore } from "../../vision/trackingStore";
import { HandLandmarkOverlay } from "./HandLandmarkOverlay";
export function WebcamPreview() {
  const panel = useRef<HTMLElement>(null);
  const floating = useFloatingPanel(panel);
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
      style={floating.style}
      className={`webcam-panel floating-camera ${floating.layout.minimized ? "minimized" : ""}`}
      aria-label="Gesture camera"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="camera-title">
        <Camera size={16} />
        <div
          className="camera-drag-handle"
          role="button"
          tabIndex={0}
          aria-label="Move Gesture Input window"
          title="Drag to move · Arrow keys move · Shift moves faster"
          {...floating.handle("move")}
        >
          <strong>Gesture input</strong>
          {floating.layout.minimized && (
            <small>{gesture === "none" ? "No hand" : gesture}</small>
          )}
        </div>
        <span className={`badge ${active ? "live" : ""}`}>
          {state.status.toUpperCase()}
        </span>
        <button
          aria-label={visible ? "Hide camera preview" : "Show camera preview"}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button
          aria-label={
            floating.layout.minimized
              ? "Expand Gesture Input"
              : "Minimize Gesture Input"
          }
          onClick={floating.minimize}
        >
          {floating.layout.minimized ? (
            <ChevronDown size={14} />
          ) : (
            <Minus size={14} />
          )}
        </button>
        {!floating.layout.minimized && (
          <button
            aria-label="Maximize or restore Gesture Input"
            onClick={floating.maximize}
          >
            <Maximize2 size={14} />
          </button>
        )}
        <button
          aria-label="Reset Gesture Input layout"
          onClick={floating.reset}
        >
          <RotateCcw size={14} />
        </button>
      </div>
      <div className="camera-body" hidden={floating.layout.minimized}>
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
        <GestureStatus />
        <AdvancedGestures />
        <div className="camera-meta">
          {state.status === "running"
            ? `${handCount ? `${handCount} hands · ${handCount * 21} landmarks` : "No hand"} · ${state.inferenceHz} Hz · ${state.inferenceMs} ms`
            : "Private by design · frames stay on device"}
        </div>
      </div>
      {!floating.layout.minimized && (
        <button
          className="camera-resize"
          aria-label="Resize Gesture Input window"
          title="Drag to resize · Arrow keys resize"
          {...floating.handle("resize")}
        >
          <Grip size={16} />
        </button>
      )}
    </section>
  );
}
