import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  HandTracker,
  cameraError,
  type Detector,
} from "../../src/vision/handTracker";
import { useTrackingStore } from "../../src/vision/trackingStore";
beforeEach(() => {
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
});
afterEach(() => vi.unstubAllGlobals());
function fixtures() {
  const stop = vi.fn();
  const track = { stop, onended: null };
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream;
  const video = {
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    srcObject: null,
  } as unknown as HTMLVideoElement;
  const detector = { close: vi.fn(), detectForVideo: vi.fn() } as Detector;
  return { stop, stream, video, detector };
}
it("releases tracks and detector on stop", async () => {
  const f = fixtures();
  const tracker = new HandTracker({
    getStream: async () => f.stream,
    load: async () => f.detector,
  });
  await tracker.start(f.video);
  expect(useTrackingStore.getState().status).toBe("running");
  tracker.stop();
  expect(f.stop).toHaveBeenCalledOnce();
  expect(f.detector.close).toHaveBeenCalledOnce();
  expect(f.video.srcObject).toBe(null);
});
it("cancels permission requests safely when Stop is pressed before permission resolves", async () => {
  const f = fixtures();
  let resolve!: (s: MediaStream) => void;
  const load = vi.fn(async () => f.detector);
  const tracker = new HandTracker({
    getStream: () =>
      new Promise((r) => {
        resolve = r;
      }),
    load,
  });
  const start = tracker.start(f.video);
  tracker.stop();
  resolve(f.stream);
  await start;
  expect(f.stop).toHaveBeenCalledOnce();
  expect(load).not.toHaveBeenCalled();
  expect(useTrackingStore.getState().status).toBe("off");
});
it("closes a model which finishes loading after stop", async () => {
  const f = fixtures();
  let resolve!: (d: Detector) => void;
  const tracker = new HandTracker({
    getStream: async () => f.stream,
    load: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  const start = tracker.start(f.video);
  await vi.waitFor(() => expect(resolve).toBeDefined());
  tracker.stop();
  resolve(f.detector);
  await start;
  expect(f.detector.close).toHaveBeenCalledOnce();
  expect(f.stop).toHaveBeenCalledOnce();
});
it("handles denial without starting inference", async () => {
  const f = fixtures();
  const error = new Error("denied");
  error.name = "NotAllowedError";
  const tracker = new HandTracker({
    getStream: async () => {
      throw error;
    },
    load: async () => f.detector,
  });
  await tracker.start(f.video);
  expect(useTrackingStore.getState().status).toBe("error");
  expect(cameraError(error)).toContain("site settings");
  expect(f.detector.detectForVideo).not.toHaveBeenCalled();
});
