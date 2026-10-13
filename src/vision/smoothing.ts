import type { Landmark } from "./landmarkStream";
export class LandmarkSmoother {
  private previous: Landmark[] = [];
  private time = 0;
  constructor(
    private timeConstantMs = 45,
    private resetGapMs = 250,
  ) {}
  reset() {
    this.previous = [];
    this.time = 0;
  }
  update(points: Landmark[], now: number) {
    if (!points.length) {
      this.reset();
      return [];
    }
    const elapsed = now - this.time;
    const alpha =
      this.previous.length !== points.length || elapsed > this.resetGapMs
        ? 1
        : 1 - Math.exp(-Math.max(0, elapsed) / this.timeConstantMs);
    this.previous = points.map((p, i) => {
      const last = this.previous[i] ?? p;
      return {
        x: last.x + alpha * (p.x - last.x),
        y: last.y + alpha * (p.y - last.y),
        z: last.z + alpha * (p.z - last.z),
      };
    });
    this.time = now;
    return this.previous;
  }
}
