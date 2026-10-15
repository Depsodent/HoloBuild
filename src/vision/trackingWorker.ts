import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
export type WorkerRequest =
  | { type: "init" }
  | { type: "detect"; bitmap: ImageBitmap; timestamp: number; id: number }
  | { type: "close" };
export type WorkerResponse =
  | { type: "ready" }
  | { type: "closed" }
  | {
      type: "result";
      result: HandLandmarkerResult;
      inferenceMs: number;
      id: number;
    }
  | { type: "error"; message: string; id?: number };
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (data: WorkerResponse) => void;
};
let detector: HandLandmarker | null = null;
scope.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      const files = await FilesetResolver.forVisionTasks(
        new URL("/vision/wasm", self.location.origin).href,
        true,
      );
      detector = await HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: new URL(
            "/vision/hand_landmarker.task",
            self.location.origin,
          ).href,
          delegate: "CPU",
        },
        canvas: new OffscreenCanvas(1, 1),
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      scope.postMessage({ type: "ready" });
    } else if (data.type === "detect") {
      try {
        if (!detector) throw Error("Worker detector is unavailable.");
        const start = performance.now();
        const result = detector.detectForVideo(data.bitmap, data.timestamp);
        scope.postMessage({
          type: "result",
          result,
          inferenceMs: performance.now() - start,
          id: data.id,
        });
      } finally {
        data.bitmap.close();
      }
    } else {
      detector?.close();
      detector = null;
      scope.postMessage({ type: "closed" });
    }
  } catch (error) {
    scope.postMessage({
      type: "error",
      message:
        error instanceof Error ? error.message : "Worker inference failed.",
      id: data.type === "detect" ? data.id : undefined,
    });
  }
};
