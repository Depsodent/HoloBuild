import { create } from "zustand";
export function sampleStats(samples: number[]) {
  if (!samples.length) return { mean: 0, p95: 0, std: 0 };
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return {
    mean,
    p95: [...samples].sort((a, b) => a - b)[
      Math.ceil(samples.length * 0.95) - 1
    ],
    std: Math.sqrt(
      samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length,
    ),
  };
}
type Sample = { time: number; value: number };
function append(samples: Sample[], time: number, value: number) {
  samples.push({ time, value });
  while (samples.length > 180 || samples[0]?.time < time - 2000)
    samples.shift();
}
function rate(samples: Sample[]) {
  return samples.length < 2
    ? 0
    : ((samples.length - 1) * 1000) /
        (samples.at(-1)!.time - samples[0].time || 1);
}
const empty = {
  mainThreadLongTasks: null as number | null,
  mainThreadBlockedMs: null as number | null,
  renderFps: 0,
  renderP95Ms: 0,
  renderStdMs: 0,
  cameraFps: null as number | null,
  inferenceHz: 0,
  inferenceMeanMs: 0,
  inferenceP95Ms: 0,
  transferMeanMs: 0,
  gestureHz: 0,
  gestureMeanMs: 0,
  pipelineToRenderMs: 0,
  resultToRenderMs: 0,
  captureToRenderMs: null as number | null,
  skippedFrames: null as number | null,
  duplicatesAvoided: 0,
  scheduler: "requestAnimationFrame",
  engine: "off",
  width: 0,
  height: 0,
  reportedFps: null as number | null,
};
export const usePerformanceStore = create(() => ({ ...empty }));
let longTasksSupported = false;
const longTasks: Sample[] = [];
const render: Sample[] = [],
  camera: Sample[] = [],
  inference: Sample[] = [],
  transfer: Sample[] = [],
  gesture: Sample[] = [],
  pipeline: Sample[] = [],
  resultWait: Sample[] = [],
  capture: Sample[] = [];
let lastUi = 0,
  latest: { started: number; completed: number; capture?: number } | null =
    null,
  cameraBase: number | null = null,
  presented = 0,
  processed = 0,
  duplicates = 0,
  skipReliable = true;
export const performanceMetrics = {
  longTaskSupport(value: boolean) {
    longTasksSupported = value;
  },
  longTask(time: number, duration: number) {
    append(longTasks, time, duration);
  },
  resetCamera(settings?: MediaTrackSettings) {
    for (const s of [
      camera,
      inference,
      transfer,
      gesture,
      pipeline,
      resultWait,
      capture,
    ])
      s.length = 0;
    latest = null;
    cameraBase = null;
    presented = processed = duplicates = 0;
    skipReliable = true;
    usePerformanceStore.setState({
      ...empty,
      renderFps: usePerformanceStore.getState().renderFps,
      width: settings?.width ?? 0,
      height: settings?.height ?? 0,
      reportedFps: settings?.frameRate ?? null,
    });
  },
  camera(time: number, frames: number) {
    if (cameraBase === null) cameraBase = frames - 1;
    presented = frames - cameraBase;
    append(camera, time, frames);
  },
  duplicate() {
    duplicates++;
  },
  inference(
    time: number,
    duration: number,
    overhead = 0,
    presentationKnown = true,
  ) {
    processed++;
    if (!presentationKnown) skipReliable = false;
    append(inference, time, duration);
    append(transfer, time, overhead);
    this.flush(time);
  },
  gesture(
    started: number,
    completed: number,
    captureTime?: number,
    processingStart = started,
  ) {
    append(gesture, completed, completed - processingStart);
    latest = { started, completed, capture: captureTime };
    this.flush(completed);
  },
  render(time: number, delta: number) {
    append(render, time, delta);
    if (latest) {
      append(pipeline, time, time - latest.started);
      append(resultWait, time, time - latest.completed);
      if (latest.capture !== undefined)
        append(capture, time, time - latest.capture);
      latest = null;
    }
    this.flush(time);
  },
  flush(time: number, force = false) {
    if (!force && time - lastUi < 500) return;
    lastUi = time;
    const stats = (s: Sample[]) =>
      sampleStats(s.filter((v) => v.time >= time - 2000).map((v) => v.value));
    const active = (s: Sample[]) => s.filter((v) => v.time >= time - 2000);
    const cam = active(camera),
      inf = active(inference),
      ges = active(gesture),
      rs = stats(render);
    const blocked = active(longTasks);
    usePerformanceStore.setState({
      mainThreadLongTasks: longTasksSupported ? blocked.length : null,
      mainThreadBlockedMs: longTasksSupported
        ? blocked.reduce((sum, s) => sum + s.value, 0)
        : null,
      renderFps: rs.mean ? 1000 / rs.mean : 0,
      renderP95Ms: rs.p95,
      renderStdMs: rs.std,
      cameraFps:
        cam.length > 1
          ? ((cam.at(-1)!.value - cam[0].value) * 1000) /
            (cam.at(-1)!.time - cam[0].time)
          : null,
      inferenceHz: rate(inf),
      inferenceMeanMs: stats(inference).mean,
      inferenceP95Ms: stats(inference).p95,
      transferMeanMs: stats(transfer).mean,
      gestureHz: rate(ges),
      gestureMeanMs: stats(gesture).mean,
      pipelineToRenderMs: stats(pipeline).mean,
      resultToRenderMs: stats(resultWait).mean,
      captureToRenderMs: active(capture).length ? stats(capture).mean : null,
      skippedFrames:
        cameraBase === null || cam.length < 2 || !skipReliable
          ? null
          : Math.max(0, presented - processed),
      duplicatesAvoided: duplicates,
    });
  },
};
