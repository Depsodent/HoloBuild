import { create } from "zustand";
export const CAMERA_PROFILES = {
  balanced: { label: "Balanced", width: 640, height: 480, hz: 30 },
  performance: { label: "Performance", width: 480, height: 360, hz: 20 },
  quality: { label: "Quality", width: 960, height: 720, hz: 30 },
} as const;
export type CameraProfile = keyof typeof CAMERA_PROFILES;
function initial(): CameraProfile {
  try {
    const p = localStorage.getItem("holobuild.camera-profile.v1");
    if (p && Object.hasOwn(CAMERA_PROFILES, p)) return p as CameraProfile;
  } catch {
    /* Optional preference. */
  }
  return "balanced";
}
function initialExecution(): "main" | "worker" | "gpu" {
  try {
    const saved = localStorage.getItem("holobuild.camera-execution.v1");
    if (saved === "gpu") return "gpu";
    return saved === "worker" ? "worker" : "main";
  } catch {
    return "main";
  }
}
export const useCameraSettings = create(() => ({
  profile: initial(),
  execution: initialExecution(),
}));
export function saveCameraExecution(execution: "main" | "worker" | "gpu") {
  useCameraSettings.setState({ execution });
  try {
    localStorage.setItem("holobuild.camera-execution.v1", execution);
  } catch {
    /* Optional preference. */
  }
}
export function saveCameraProfile(profile: CameraProfile) {
  useCameraSettings.setState({ profile });
  try {
    localStorage.setItem("holobuild.camera-profile.v1", profile);
  } catch {
    /* Optional preference. */
  }
}
export function cameraConstraints(
  profile: CameraProfile,
): MediaTrackConstraints {
  const p = CAMERA_PROFILES[profile];
  return {
    width: { ideal: p.width },
    height: { ideal: p.height },
    frameRate: { ideal: 30, max: 30 },
  };
}
export class FramePacer {
  private last = -Infinity;
  private due = -Infinity;
  reset() {
    this.last = this.due = -Infinity;
  }
  claim(
    mediaTime: number,
    now: number,
    hz: number,
  ): "ready" | "duplicate" | "paced" {
    const frame = Math.round(mediaTime * 1000);
    if (frame === this.last) return "duplicate";
    if (now + 0.5 < this.due) return "paced";
    const period = 1000 / hz;
    this.due = now - this.due > period ? now + period : this.due + period;
    this.last = frame;
    return "ready";
  }
}
