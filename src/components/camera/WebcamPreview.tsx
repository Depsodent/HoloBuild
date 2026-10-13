import { GestureStatus } from "../ui/GestureStatus";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Eye, EyeOff } from "lucide-react";
import { HandTracker } from "../../vision/handTracker";
import { useTrackingStore } from "../../vision/trackingStore";
import { HandLandmarkOverlay } from "./HandLandmarkOverlay";
export function WebcamPreview() {
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
    <section className="webcam-panel" aria-label="Gesture camera">
      <div className="camera-title">
        <Camera size={16} />
        <strong>Gesture input</strong>
        <span className={`badge ${active ? "live" : ""}`}>
          {state.status.toUpperCase()}
        </span>
        <button
          aria-label={visible ? "Hide camera preview" : "Show camera preview"}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
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
      <div className="camera-meta">
        {state.status === "running"
          ? `${state.handVisible ? "21 landmarks" : "No hand"} · ${state.inferenceHz} Hz · ${state.inferenceMs} ms`
          : "Private by design · frames stay on device"}
      </div>
    </section>
  );
}
