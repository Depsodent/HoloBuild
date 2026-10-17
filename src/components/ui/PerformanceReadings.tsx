import { useGraphicsInfo } from "../../vision/graphicsInfo";
import { usePerformanceStore } from "../../vision/performanceStore";
export function PerformanceReadings() {
  const graphics = useGraphicsInfo();
  const m = usePerformanceStore();
  const number = (v: number | null, digits = 1) =>
    v === null ? "unavailable" : v.toFixed(digits);
  return (
    <>
      <dl>
        <dt>Browser-reported WebGL renderer</dt>
        <dd style={{ overflowWrap: "anywhere" }}>{graphics.renderer}</dd>
        <dt>WebGL acceleration indicators</dt>
        <dd>
          {graphics.webgl2 ? "WebGL 2" : "Not reported"} ·{" "}
          {graphics.software
            ? "software renderer detected"
            : "no known software renderer reported"}
        </dd>
        <dt>Render FPS</dt>
        <dd>{number(m.renderFps)}</dd>
        <dt>Render frame p95 / variation</dt>
        <dd>
          {number(m.renderP95Ms)} / {number(m.renderStdMs)} ms (std)
        </dd>
        <dt>Main-thread tasks over 50 ms · last 2 s</dt>
        <dd>
          {number(m.mainThreadLongTasks, 0)} · {number(m.mainThreadBlockedMs)}{" "}
          ms total
        </dd>
        <dt>Camera presentation FPS</dt>
        <dd>{number(m.cameraFps)}</dd>
        <dt>Camera reported settings</dt>
        <dd>
          {m.width}×{m.height} · {number(m.reportedFps, 0)} FPS
        </dd>
        <dt>Inference rate</dt>
        <dd>{number(m.inferenceHz)} Hz</dd>
        <dt>Inference average / p95</dt>
        <dd>
          {number(m.inferenceMeanMs)} / {number(m.inferenceP95Ms)} ms
        </dd>
        <dt>Bitmap / worker overhead</dt>
        <dd>{number(m.transferMeanMs)} ms</dd>
        <dt>Gesture updates / processing</dt>
        <dd>
          {number(m.gestureHz)} Hz / {number(m.gestureMeanMs, 2)} ms
        </dd>
        <dt>Processing → render callback</dt>
        <dd>{number(m.pipelineToRenderMs)} ms</dd>
        <dt>Result → render callback</dt>
        <dd>{number(m.resultToRenderMs)} ms</dd>
        <dt>Capture → render estimate</dt>
        <dd>
          {number(m.captureToRenderMs)}
          {m.captureToRenderMs === null ? "" : " ms"}
        </dd>
        <dt>Presented frames not inferred</dt>
        <dd>{number(m.skippedFrames, 0)} (session estimate)</dd>
        <dt>Repeated video times ignored</dt>
        <dd>{m.duplicatesAvoided}</dd>
        <dt>Execution / scheduler</dt>
        <dd>
          {m.engine} · {m.scheduler}
        </dd>
      </dl>
      <p className="muted">
        Renderer strings are browser reports, not proof of a physical adapter or
        OS acceleration settings. Rates are separate two-second windows. Render
        timings exclude exposure, smoothing, GPU presentation and physical hand
        motion. Capture time is only estimated when the browser supplies it;
        hidden previews may not report presentation FPS.
      </p>
    </>
  );
}
