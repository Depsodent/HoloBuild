import { it, expect } from "vitest";
import { FramePacer } from "../../src/vision/cameraSettings";
import {
  sampleStats,
  performanceMetrics,
  usePerformanceStore,
} from "../../src/vision/performanceStore";
import {
  parseAccordions,
  ACCORDION_DEFAULTS,
} from "../../src/workspace/accordionStore";
it("paces video frames without duplicates, backlog or 24-to-15 Hz quantization", () => {
  const p = new FramePacer();
  let accepted = 0;
  for (let frame = 0; frame < 30; frame++)
    if (p.claim(frame / 30, (frame * 1000) / 30, 24) === "ready") accepted++;
  expect(accepted).toBe(24);
  expect(p.claim(29 / 30, 1001, 24)).toBe("duplicate");
  expect(p.claim(2, 2000, 24)).toBe("ready");
  expect(p.claim(2, 2001, 24)).toBe("duplicate");
});
it("separates camera, inference, gesture rates, timing variation and missing capture latency", () => {
  performanceMetrics.resetCamera({ width: 640, height: 480, frameRate: 30 });
  for (let t = 0; t <= 1000; t += 50) {
    performanceMetrics.camera(t, t / 50 + 1);
    if (t % 100 === 0) {
      performanceMetrics.inference(t, 20, 2);
      performanceMetrics.gesture(t, t + 22, undefined, t + 20);
      performanceMetrics.render(t + 25, 50);
    }
  }
  performanceMetrics.flush(1025, true);
  const m = usePerformanceStore.getState();
  expect(m.cameraFps).toBeCloseTo(20);
  expect(m.inferenceHz).toBeCloseTo(10);
  expect(m.gestureHz).toBeCloseTo(10);
  expect(m.inferenceMeanMs).toBe(20);
  expect(m.gestureMeanMs).toBe(2);
  expect(m.captureToRenderMs).toBeNull();
  expect(m.pipelineToRenderMs).toBe(25);
  expect(m.skippedFrames).toBe(10);
  expect(sampleStats([10, 20, 30]).std).toBeCloseTo(Math.sqrt(200 / 3));
});
it("accordion preferences reject unknown/invalid values and keep independent defaults", () => {
  const parsed = parseAccordions(
    '{"tools.shapes":false,"inspector.materials":true,"camera.settings":"yes","extra":true}',
  );
  expect(parsed["tools.shapes"]).toBe(false);
  expect(parsed["inspector.materials"]).toBe(true);
  expect(parsed["camera.settings"]).toBe(false);
  expect(parsed.extra).toBeUndefined();
  expect(parseAccordions("bad")).toEqual(ACCORDION_DEFAULTS);
});
