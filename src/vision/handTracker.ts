import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { landmarkStream } from "./landmarkStream";
import { useTrackingStore } from "./trackingStore";
import { performanceMetrics } from "./performanceStore";
import { usePerformanceStore } from "./performanceStore";
import {
  CAMERA_PROFILES,
  cameraConstraints,
  FramePacer,
  saveCameraProfile,
  useCameraSettings,
  type CameraProfile,
} from "./cameraSettings";
export interface Detector {
  detectForVideo: (
    source: Parameters<HandLandmarker["detectForVideo"]>[0],
    timestamp: number,
  ) =>
    | ReturnType<HandLandmarker["detectForVideo"]>
    | Promise<ReturnType<HandLandmarker["detectForVideo"]>>;
  close: () => void;
  engine?: string;
  inferenceMs?: number;
}
export interface TrackerDependencies {
  getStream: (
    deviceId?: string,
    profile?: CameraProfile,
  ) => Promise<MediaStream>;
  load: (signal?: AbortSignal) => Promise<Detector>;
}
const defaults: TrackerDependencies = {
  getStream: (deviceId, profile = "balanced") =>
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        ...cameraConstraints(profile),
        ...(deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: "user" }),
      },
    }),
  async load(signal) {
    if (
      useCameraSettings.getState().execution === "worker" &&
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined" &&
      typeof createImageBitmap === "function"
    ) {
      try {
        const { WorkerDetector } = await import("./workerDetector");
        return await WorkerDetector.create(signal);
      } catch {
        if (signal?.aborted)
          throw Error(
            "Camera stopped.",
          ); /* Unsupported worker initialization uses the existing local CPU path. */
      }
    }
    const { FilesetResolver, HandLandmarker } =
      await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks("/vision/wasm");
    const detector = await HandLandmarker.createFromOptions(files, {
      baseOptions: {
        modelAssetPath: "/vision/hand_landmarker.task",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    return {
      detectForVideo: detector.detectForVideo.bind(detector),
      close: () => detector.close(),
      engine:
        useCameraSettings.getState().execution === "worker"
          ? "main-thread CPU (worker unavailable)"
          : "main-thread CPU",
    };
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
  private videoFrame = 0;
  private configuration = 0;
  private loading: AbortController | null = null;
  private busy = false;
  private pacer = new FramePacer();
  constructor(private deps: TrackerDependencies = defaults) {}
  stop(message = "Camera is off. Mouse controls are ready.") {
    this.generation++;
    this.loading?.abort();
    this.loading = null;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.videoFrame && this.video?.cancelVideoFrameCallback)
      this.video.cancelVideoFrameCallback(this.videoFrame);
    this.videoFrame = 0;
    this.busy = false;
    this.pacer.reset();
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
      const stream = await this.deps.getStream(
        deviceId,
        useCameraSettings.getState().profile,
      );
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
      this.loading = new AbortController();
      const detector = await this.deps.load(this.loading.signal);
      if (generation !== this.generation) {
        detector.close();
        return;
      }
      this.detector = detector;
      performanceMetrics.resetCamera(
        stream.getVideoTracks()[0]?.getSettings?.(),
      );
      usePerformanceStore.setState({
        engine: detector.engine ?? "main-thread CPU",
        scheduler:
          typeof video.requestVideoFrameCallback === "function"
            ? "video callback + RAF watchdog"
            : "requestAnimationFrame fallback",
      });
      useTrackingStore.setState({
        status: "running",
        message: `Local tracking · ${detector.engine ?? "CPU"} · up to two hands`,
      });
      let lastVideoCallback = performance.now(),
        periodStart = performance.now(),
        frames = 0,
        totalMs = 0;
      const processFrame = async (metadata?: VideoFrameCallbackMetadata) => {
        if (generation !== this.generation || this.busy || video.readyState < 2)
          return;
        const started = performance.now();
        const claim = this.pacer.claim(
          video.currentTime,
          started,
          CAMERA_PROFILES[useCameraSettings.getState().profile].hz,
        );
        if (claim === "duplicate") performanceMetrics.duplicate();
        if (claim !== "ready") return;
        this.busy = true;
        const configuration = this.configuration;
        const presentationKnown =
          !!metadata &&
          Math.abs(metadata.mediaTime - video.currentTime) < 0.002;
        const captureTime = presentationKnown
          ? metadata!.captureTime
          : undefined;
        try {
          const result = await detector.detectForVideo(video, started);
          if (
            generation !== this.generation ||
            configuration !== this.configuration
          )
            return;
          const completed = performance.now();
          const inferenceMs = detector.inferenceMs ?? completed - started;
          performanceMetrics.inference(
            completed,
            inferenceMs,
            Math.max(0, completed - started - inferenceMs),
            presentationKnown,
          );
          const landmarks = result.landmarks[0] ?? [];
          landmarkStream.publish({
            landmarks,
            hands: result.landmarks.map((points, i) => ({
              landmarks: points,
              handedness: result.handedness[i]?.[0]?.categoryName,
              handednessScore: result.handedness[i]?.[0]?.score,
            })),
            timestamp: started,
            inferenceMs,
            aspectRatio: video.videoWidth / video.videoHeight || 1,
            source: "camera",
            captureTime,
          });
          frames++;
          totalMs += inferenceMs;
          if (completed - periodStart >= 500) {
            useTrackingStore.setState({
              inferenceMs: Math.round(totalMs / frames),
              inferenceHz: Math.round(
                (frames * 1000) / (completed - periodStart),
              ),
              handVisible: landmarks.length === 21,
            });
            periodStart = completed;
            frames = 0;
            totalMs = 0;
          }
        } catch (error) {
          if (generation === this.generation) this.fail(error);
        } finally {
          if (generation === this.generation) this.busy = false;
        }
      };
      if (typeof video.requestVideoFrameCallback === "function") {
        const observe = (now: number, metadata: VideoFrameCallbackMetadata) => {
          if (generation !== this.generation) return;
          lastVideoCallback = performance.now();
          performanceMetrics.camera(now, metadata.presentedFrames);
          void processFrame(metadata);
          if (generation === this.generation)
            this.videoFrame = video.requestVideoFrameCallback(observe);
        };
        this.videoFrame = video.requestVideoFrameCallback(observe);
      }
      const watchdog = () => {
        if (generation !== this.generation) return;
        // Some browsers suspend video callbacks for CSS-hidden previews. The
        // fallback shares the same pacer, so it never processes a frame twice.
        if (
          typeof video.requestVideoFrameCallback !== "function" ||
          performance.now() - lastVideoCallback > 100
        )
          void processFrame();
        if (generation === this.generation)
          this.raf = requestAnimationFrame(watchdog);
      };
      this.raf = requestAnimationFrame(watchdog);
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }
  async setProfile(profile: CameraProfile) {
    const previous = useCameraSettings.getState().profile,
      generation = this.generation;
    if (profile === previous) return true;
    const track = this.stream?.getVideoTracks()[0];
    try {
      if (track) {
        this.configuration++;
        landmarkStream.publish({
          landmarks: [],
          timestamp: performance.now(),
          inferenceMs: 0,
        });
      }
      if (track) await track.applyConstraints(cameraConstraints(profile));
      if (generation !== this.generation) return false;
      saveCameraProfile(profile);
      this.pacer.reset();
      if (track) {
        landmarkStream.publish({
          landmarks: [],
          timestamp: performance.now(),
          inferenceMs: 0,
        });
        const { engine, scheduler } = usePerformanceStore.getState();
        performanceMetrics.resetCamera(track.getSettings());
        usePerformanceStore.setState({ engine, scheduler });
        useTrackingStore.setState({
          message: `Local tracking · ${this.detector?.engine ?? "CPU"} · ${CAMERA_PROFILES[profile].label}`,
        });
      }
      return true;
    } catch {
      useTrackingStore.setState({
        message:
          "Camera rejected these quality settings. Previous profile retained; tracking continues.",
      });
      return false;
    }
  }
  private fail(error: unknown) {
    this.stop();
    useTrackingStore.setState({ status: "error", message: cameraError(error) });
  }
}
