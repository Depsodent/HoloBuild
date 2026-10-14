import { GESTURE_CONFIG as config } from "./calibration";
import type { Landmark } from "./landmarkStream";
import type { Gesture, GestureFrame } from "./gestureTypes";
export const distance = (a: Landmark, b: Landmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function pinchRatio(points: Landmark[]) {
  return (
    distance(points[4], points[8]) /
    Math.max(distance(points[0], points[9]), distance(points[5], points[17]))
  );
}
export function isExtended(points: Landmark[], mcp: number) {
  const a = points[mcp],
    b = points[mcp + 1],
    c = points[mcp + 3];
  const ab = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z },
    cb = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const cosine =
    dot /
    Math.max(1e-8, Math.hypot(ab.x, ab.y, ab.z) * Math.hypot(cb.x, cb.y, cb.z));
  return (
    cosine < Math.cos((150 * Math.PI) / 180) &&
    distance(c, points[0]) > distance(b, points[0]) * 1.12
  );
}
export class GestureDetector {
  private pinching = false;
  private pinchActive = false;
  private pinchSince = 0;
  private current: Gesture = "none";
  private candidate: Gesture = "none";
  private since = 0;
  private lastTime: number | null = null;
  reset() {
    this.pinching = false;
    this.pinchActive = false;
    this.pinchSince = 0;
    this.current = "none";
    this.candidate = "none";
    this.since = 0;
    this.lastTime = null;
  }
  update(points: Landmark[], now: number, aspectRatio = 1): GestureFrame {
    if (this.lastTime !== null && now - this.lastTime > config.lossGapMs)
      this.reset();
    this.lastTime = now;
    const valid =
      points.length === 21 &&
      points.every(
        (p) =>
          Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z),
      );
    if (
      !valid ||
      Math.max(
        distance(points[0], points[9]),
        distance(points[5], points[17]),
      ) < config.minPalmSize
    ) {
      this.reset();
      return {
        gesture: "none",
        candidate: "none",
        timestamp: now,
        cursor: null,
        pinchRatio: null,
        pinchActive: false,
        pinchCandidate: false,
        pinchStable: false,
        stable: false,
        recognitionMs: 0,
      };
    }
    // MediaPipe x/z use image width, y uses image height. Measure in one
    // coordinate system while leaving normalized cursor coordinates untouched.
    const metric = points.map((p) => ({ ...p, y: p.y / aspectRatio }));
    const ratio = pinchRatio(metric);
    const pinching = ratio < (this.pinching ? config.pinchOff : config.pinchOn);
    if (pinching !== this.pinching) this.pinchSince = now;
    this.pinching = pinching;
    if (
      now - this.pinchSince >=
      (pinching ? config.pinchDwellMs : config.releaseDwellMs)
    )
      this.pinchActive = pinching;
    const extended = [5, 9, 13, 17].map((i) => isExtended(metric, i));
    const next: Gesture = this.pinching
      ? "pinch"
      : extended.every(Boolean)
        ? "open-palm"
        : extended[0] && !extended[1] && !extended[2] && !extended[3]
          ? "pointing"
          : extended.every((v) => !v)
            ? "fist"
            : "unknown";
    if (next !== this.candidate) {
      this.candidate = next;
      this.since = now;
    }
    const dwell =
      this.current === "pinch" && next !== "pinch"
        ? config.releaseDwellMs
        : next === "pinch"
          ? config.pinchDwellMs
          : next === "open-palm"
            ? config.palmDwellMs
            : next === "pointing"
              ? config.pointDwellMs
              : next === "fist"
                ? config.fistDwellMs
                : config.ambiguousDwellMs;
    if (now - this.since >= dwell) this.current = next;
    return {
      gesture: this.current,
      candidate: next,
      timestamp: now,
      cursor: { x: 1 - points[8].x, y: points[8].y },
      pinchRatio: ratio,
      pinchActive: this.pinchActive,
      pinchCandidate: pinching,
      pinchStable: this.pinchActive === pinching,
      stable: this.current === next,
      recognitionMs: 0,
    };
  }
}
