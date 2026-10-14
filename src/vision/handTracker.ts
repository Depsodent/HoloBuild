import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { landmarkStream } from "./landmarkStream";
import { useTrackingStore } from "./trackingStore";
export interface Detector {
  detectForVideo: HandLandmarker["detectForVideo"];
  close: () => void;
}
export interface TrackerDependencies {
  getStream: (deviceId?: string) => Promise<MediaStream>;
  load: () => Promise<Detector>;
}
const defaults: TrackerDependencies = {
  getStream: (deviceId) =>
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 },
        ...(deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: "user" }),
      },
    }),
  async load() {
    const { FilesetResolver, HandLandmarker } =
      await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks("/vision/wasm");
    return HandLandmarker.createFromOptions(files, {
      baseOptions: {
        modelAssetPath: "/vision/hand_landmarker.task",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
  },
};
export function cameraError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera permission denied. Allow camera access in browser site settings, then try Start camera again.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "Camera not found. Connect a webcam or choose a different camera, then retry.";
  if (name === "NotReadableError")
    return "Camera is busy. Close other camera apps and retry.";
  return "Tracking could not start. Run npm.cmd run setup:vision, check camera availability, then retry.";
}
export class HandTracker {
  private generation = 0;
  private stream: MediaStream | null = null;
  private detector: Detector | null = null;
  private video: HTMLVideoElement | null = null;
  private raf = 0;
  constructor(private deps: TrackerDependencies = defaults) {}
  stop(message = "Camera is off. Mouse controls are ready.") {
    this.generation++;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.stream = null;
    this.detector?.close();
    this.detector = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }
    landmarkStream.publish({
      landmarks: [],
      timestamp: performance.now(),
      inferenceMs: 0,
    });
    useTrackingStore.setState({
      status: "off",
      message,
      handVisible: false,
      inferenceHz: 0,
      inferenceMs: 0,
    });
  }
  async start(video: HTMLVideoElement, deviceId?: string) {
    this.stop();
    const generation = this.generation;
    useTrackingStore.setState({
      status: "starting",
      message: "Waiting for permission and loading the local hand model…",
    });
    try {
      const stream = await this.deps.getStream(deviceId);
      if (generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      this.video = video;
      video.srcObject = stream;
      stream.getVideoTracks().forEach((track) => {
        track.onended = () =>
          this.stop(
            "Camera disconnected. Reconnect it and press Start camera.",
          );
      });
      await video.play();
      if (generation !== this.generation) return;
      const detector = await this.deps.load();
      if (generation !== this.generation) {
        detector.close();
        return;
      }
      this.detector = detector;
      useTrackingStore.setState({
        status: "running",
        message: "Local tracking · CPU · one hand",
      });
      let lastVideoTime = -1,
        lastInference = 0,
        periodStart = performance.now(),
        frames = 0,
        totalMs = 0,
        interval = 1000 / 24;
      const tick = (now: number) => {
        if (generation !== this.generation) return;
        try {
          if (
            video.readyState >= 2 &&
            video.currentTime !== lastVideoTime &&
            now - lastInference >= interval
          ) {
            lastVideoTime = video.currentTime;
            lastInference = now;
            const start = performance.now();
            const result = detector.detectForVideo(video, now);
            const inferenceMs = performance.now() - start;
            const landmarks = result.landmarks[0] ?? [];
            landmarkStream.publish({
              landmarks,
              timestamp: now,
              inferenceMs,
              aspectRatio: video.videoWidth / video.videoHeight || 1,
            });
            frames++;
            totalMs += inferenceMs;
            // Leave room for rendering when synchronous inference is expensive.
            interval = Math.max(1000 / 24, Math.min(160, inferenceMs * 1.8));
            if (now - periodStart >= 500) {
              useTrackingStore.setState({
                inferenceMs: Math.round(totalMs / frames),
                inferenceHz: Math.round((frames * 1000) / (now - periodStart)),
                handVisible: landmarks.length === 21,
              });
              periodStart = now;
              frames = 0;
              totalMs = 0;
            }
          }
          this.raf = requestAnimationFrame(tick);
        } catch (error) {
          this.fail(error);
        }
      };
      this.raf = requestAnimationFrame(tick);
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }
  private fail(error: unknown) {
    this.stop();
    useTrackingStore.setState({ status: "error", message: cameraError(error) });
  }
}
