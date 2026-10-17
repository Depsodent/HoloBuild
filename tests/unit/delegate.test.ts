import { it, expect, vi } from "vitest";
import {
  delegateDetector,
  serializedDetector,
} from "../../src/vision/delegateDetector";
import {
  autoUsesGpu,
  isSoftwareRenderer,
  useGraphicsInfo,
} from "../../src/vision/graphicsInfo";
import type { Detector } from "../../src/vision/handTracker";
const result = {
  landmarks: [],
  handedness: [],
  handednesses: [],
  worldLandmarks: [],
};
const source = {} as HTMLVideoElement;
const detector = (): Detector => ({
  detectForVideo: vi.fn(() => result),
  close: vi.fn(),
});
it("GPU is reported only after successful creation and owns exactly one resource", async () => {
  const gpu = detector(),
    create = vi.fn(async () => gpu);
  const d = await delegateDetector(create, true);
  expect(create).toHaveBeenCalledWith("GPU");
  expect(d.engine).toBe("main-thread GPU");
  expect(await d.detectForVideo(source, 1)).toEqual(result);
  d.close();
  d.close();
  expect(gpu.close).toHaveBeenCalledTimes(1);
});
it("failed GPU initialization creates a working CPU fallback", async () => {
  const cpu = detector(),
    create = vi.fn(async (delegate: string) => {
      if (delegate === "GPU") throw Error("unsupported");
      return cpu;
    });
  const d = await delegateDetector(create, true);
  expect(create.mock.calls.map((c) => c[0])).toEqual(["GPU", "CPU"]);
  expect(d.engine).toContain("CPU (GPU initialization unavailable)");
  expect(await d.detectForVideo(source, 1)).toEqual(result);
  d.close();
});
it("GPU runtime failure closes GPU before CPU creation and falls back once", async () => {
  const gpu = detector(),
    cpu = detector(),
    fallback = vi.fn();
  gpu.detectForVideo = () => {
    throw Error("context lost");
  };
  const create = vi.fn(async (delegate: string) => {
    if (delegate === "CPU") expect(gpu.close).toHaveBeenCalledTimes(1);
    return delegate === "GPU" ? gpu : cpu;
  });
  const d = await delegateDetector(create, true, undefined, fallback);
  expect(await d.detectForVideo(source, 1)).toEqual(result);
  await d.detectForVideo(source, 2);
  expect(create).toHaveBeenCalledTimes(2);
  expect(fallback).toHaveBeenCalledTimes(1);
  expect(d.engine).toContain("runtime fallback");
  d.close();
  expect(cpu.close).toHaveBeenCalledTimes(1);
});
it("stopped GPU initialization closes a late detector without starting CPU", async () => {
  const abort = new AbortController(),
    gpu = detector();
  let resolve!: (d: Detector) => void;
  const create = vi.fn(() => new Promise<Detector>((r) => (resolve = r)));
  const loading = delegateDetector(create, true, abort.signal);
  abort.abort();
  resolve(gpu);
  await expect(loading).rejects.toThrow("stopped");
  expect(gpu.close).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenCalledTimes(1);
});
it("stop during runtime fallback closes the late CPU and never publishes it", async () => {
  const abort = new AbortController(),
    gpu = detector(),
    cpu = detector();
  gpu.detectForVideo = () => {
    throw Error();
  };
  let resolve!: (d: Detector) => void;
  const create = async (delegate: string) =>
    delegate === "GPU"
      ? gpu
      : await new Promise<Detector>((r) => (resolve = r));
  const d = await delegateDetector(create, true, abort.signal);
  const inference = d.detectForVideo(source, 1);
  abort.abort();
  d.close();
  resolve(cpu);
  await expect(inference).rejects.toThrow("stopped");
  expect(cpu.close).toHaveBeenCalledTimes(1);
  expect(gpu.close).toHaveBeenCalledTimes(1);
});
it("CPU failures remain errors rather than looping delegate creation", async () => {
  const cpu = detector();
  cpu.detectForVideo = () => {
    throw Error("CPU failed");
  };
  const create = vi.fn(async () => cpu),
    d = await delegateDetector(create, false);
  await expect(d.detectForVideo(source, 1)).rejects.toThrow("CPU failed");
  expect(create).toHaveBeenCalledTimes(1);
  d.close();
});
it("detector initialization is serialized even when starts overlap", async () => {
  let resolve!: (d: Detector) => void;
  const second = vi.fn(async () => detector());
  const first = serializedDetector(
    () => new Promise<Detector>((r) => (resolve = r)),
  );
  const next = serializedDetector(second);
  await Promise.resolve();
  expect(second).not.toHaveBeenCalled();
  resolve(detector());
  await first;
  await next;
  expect(second).toHaveBeenCalledTimes(1);
});
it("Auto avoids known software renderers and uses compatible reported WebGL2", () => {
  expect(isSoftwareRenderer("ANGLE SwiftShader")).toBe(true);
  expect(isSoftwareRenderer("AMD Radeon")).toBe(false);
  useGraphicsInfo.setState({ webgl2: true, software: false });
  expect(autoUsesGpu()).toBe(true);
  useGraphicsInfo.setState({ software: true });
  expect(autoUsesGpu()).toBe(false);
  useGraphicsInfo.setState({ webgl2: false, software: false });
  expect(autoUsesGpu()).toBe(false);
});
