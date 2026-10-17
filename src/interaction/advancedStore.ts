import { AUTO_THRESHOLDS, type AutoThresholds } from "./autoIntent";
import { create } from "zustand";
export type AdvancedMode = "auto" | "move" | "scale" | "rotate" | "navigate";
export const MODE_INSTRUCTIONS: Record<AdvancedMode, string> = {
  auto: "Point and pinch to move. Pinch both hands, then separate to scale or turn the hand line for yaw.",
  move: "Point at an object, pinch to grab, move, then release.",
  scale:
    "Keep the selected object. Show each hand open once, then pinch both within 4 s. Release to confirm.",
  rotate:
    "Keep the selected object. Open each pinch once, then pinch both within 4 s. Tilt the hand line; release to confirm.",
  navigate:
    "Use one hand. Open pinch, then pinch and move to pan the camera. Release confirms; hand loss restores the starting view.",
};
export const useAdvancedStore = create<{
  mode: AdvancedMode;
  active: boolean;
  intent: "detect" | "scale" | "rotate" | null;
  autoThresholds: AutoThresholds;
  readyHands: number;
  menuEnabled: boolean;
  factor: number;
  angle: number;
  rotationSensitivity: number;
  navigationSensitivity: number;
  message: string;
}>(() => ({
  mode: "auto",
  intent: null,
  autoThresholds: { ...AUTO_THRESHOLDS },
  active: false,
  readyHands: 0,
  menuEnabled: false,
  factor: 1,
  angle: 0,
  rotationSensitivity: 1,
  navigationSensitivity: 1,
  message: MODE_INSTRUCTIONS.auto,
}));
