import type { Detector } from "./handTracker";
// Serialize asynchronous creation, including stopped starts whose WASM initialization
// cannot be interrupted. A late instance is closed before the next one is created.
let initialization: Promise<unknown> = Promise.resolve();
export function serializedDetector(
  load: () => Promise<Detector>,
): Promise<Detector> {
  const next = initialization.then(load, load);
  initialization = next.catch(() => undefined);
  return next;
}
export async function delegateDetector(
  create: (delegate: "CPU" | "GPU") => Promise<Detector>,
  gpu: boolean,
  signal?: AbortSignal,
  onFallback?: () => void,
): Promise<Detector> {
  let current: Detector | null = null,
    closed = false,
    activeGpu = gpu;
  let engine = gpu ? "main-thread GPU" : "main-thread CPU";
  const check = () => {
    if (closed || signal?.aborted) throw Error("Camera stopped.");
  };
  const initialize = async (delegate: "CPU" | "GPU") => {
    check();
    const next = await create(delegate);
    if (closed || signal?.aborted) {
      next.close();
      throw Error("Camera stopped.");
    }
    current = next;
  };
  try {
    await initialize(gpu ? "GPU" : "CPU");
  } catch (error) {
    check();
    if (!gpu) throw error;
    activeGpu = false;
    engine = "main-thread CPU (GPU initialization unavailable)";
    await initialize("CPU");
  }
  return {
    get engine() {
      return engine;
    },
    async detectForVideo(source, time) {
      check();
      try {
        return await current!.detectForVideo(source, time);
      } catch (error) {
        check();
        if (!activeGpu) throw error;
        activeGpu = false;
        current?.close();
        current = null;
        engine = "main-thread CPU (GPU runtime fallback)";
        onFallback?.();
        await initialize("CPU");
        check();
        return await current!.detectForVideo(source, time);
      }
    },
    close() {
      closed = true;
      current?.close();
      current = null;
    },
  };
}
