import { usePerformanceStore } from "../../vision/performanceStore";
export function CompactPerformance() {
  const m = usePerformanceStore();
  const n = (v: number | null) => (v === null ? "n/a" : v.toFixed(1));
  return (
    <div
      className="compact-performance"
      aria-label="Compact performance readings"
    >
      <span>Render {n(m.renderFps)} FPS</span>
      <span>Camera {n(m.cameraFps)} FPS¹</span>
      <span>Inference {n(m.inferenceHz)} Hz</span>
      <span>p95 {n(m.inferenceP95Ms)} ms</span>
      <span>Gesture {n(m.gestureHz)} Hz</span>
      <span>Process → render {n(m.pipelineToRenderMs)} ms²</span>
      <small>
        ¹ Presentation, not sensor FPS. ² Next callback; excludes
        exposure/smoothing.
      </small>
    </div>
  );
}
