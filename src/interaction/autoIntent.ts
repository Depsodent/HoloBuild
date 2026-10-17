export interface AutoThresholds {
  radial: number;
  angular: number;
  dominance: number;
  dwellMs: number;
}
export const AUTO_THRESHOLDS: AutoThresholds = {
  radial: 0.1,
  angular: Math.PI / 18,
  dominance: 1.35,
  dwellMs: 120,
};
export class AutoIntent {
  private candidate: "scale" | "rotate" | null = null;
  private since = 0;
  private frames = 0;
  update(
    logDistance: number,
    angle: number,
    time: number,
    settings: AutoThresholds,
  ): "scale" | "rotate" | null {
    const radial = Math.abs(logDistance) / settings.radial,
      angular = Math.abs(angle) / settings.angular;
    const next =
      radial >= 1 && radial > angular * settings.dominance
        ? "scale"
        : angular >= 1 && angular > radial * settings.dominance
          ? "rotate"
          : null;
    // Below the release margin or conflicting evidence must restart the stable window.
    if (!next) {
      if (
        Math.max(radial, angular) < 0.75 ||
        Math.min(radial, angular) >
          Math.max(radial, angular) / settings.dominance
      ) {
        this.candidate = null;
        this.frames = 0;
      }
      return null;
    }
    if (next !== this.candidate) {
      this.candidate = next;
      this.since = time;
      this.frames = 1;
      return null;
    }
    this.frames++;
    return this.frames >= 3 && time - this.since >= settings.dwellMs
      ? next
      : null;
  }
}
