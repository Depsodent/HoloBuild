import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import type { Detector } from "./handTracker";
import type { WorkerRequest, WorkerResponse } from "./trackingWorker";
export class WorkerDetector implements Detector {
  readonly engine = "worker CPU";
  inferenceMs = 0;
  private closed = false;
  private sequence = 0;
  private pending: ((response: WorkerResponse) => void) | null = null;
  private rejectPending: ((error: Error) => void) | null = null;
  private constructor(private worker: Worker) {}
  static async create(signal?: AbortSignal) {
    const worker = new Worker(new URL("./trackingWorker.ts", import.meta.url), {
      type: "module",
    });
    const detector = new WorkerDetector(worker);
    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.type === "closed") {
        worker.terminate();
        return;
      }
      detector.pending?.(data);
    };
    worker.onerror = (event) =>
      detector.rejectPending?.(Error(event.message || "Worker failed."));
    const abort = () => detector.close();
    signal?.addEventListener("abort", abort, { once: true });
    try {
      if (signal?.aborted) throw Error("Camera stopped.");
      await detector.request({ type: "init" }, 30000);
      return detector;
    } catch (error) {
      detector.close();
      throw error;
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  }
  private request(
    message: WorkerRequest,
    timeoutMs = 3000,
  ): Promise<WorkerResponse> {
    if (this.closed) return Promise.reject(Error("Detector stopped."));
    return new Promise((resolve, reject) => {
      const clear = () => {
        clearTimeout(timeout);
        this.pending = this.rejectPending = null;
      };
      const fail = (error: Error) => {
        clear();
        reject(error);
      };
      const timeout = setTimeout(
        () => fail(Error("Inference worker timed out.")),
        timeoutMs,
      );
      this.rejectPending = fail;
      this.pending = (response) => {
        if (response.type === "error") {
          fail(Error(response.message));
          return;
        }
        if (
          response.type === "result" &&
          message.type === "detect" &&
          response.id !== message.id
        )
          return;
        clear();
        resolve(response);
      };
      try {
        this.worker.postMessage(
          message,
          message.type === "detect" ? [message.bitmap] : [],
        );
      } catch (error) {
        if (message.type === "detect") message.bitmap.close();
        fail(error instanceof Error ? error : Error("Worker message failed."));
      }
    });
  }
  async detectForVideo(
    source: Parameters<Detector["detectForVideo"]>[0],
    timestamp: number,
  ): Promise<HandLandmarkerResult> {
    const bitmap = await createImageBitmap(source as HTMLVideoElement);
    if (this.closed) {
      bitmap.close();
      throw Error("Detector stopped.");
    }
    const response = await this.request({
      type: "detect",
      bitmap,
      timestamp,
      id: ++this.sequence,
    });
    if (response.type !== "result") throw Error("Invalid worker result.");
    this.inferenceMs = response.inferenceMs;
    return response.result;
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.rejectPending?.(Error("Detector stopped."));
    this.worker.postMessage({ type: "close" } satisfies WorkerRequest);
    const worker = this.worker;
    setTimeout(() => worker.terminate(), 200);
  }
}
