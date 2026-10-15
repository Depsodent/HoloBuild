import { create } from "zustand";
export type AdvancedMode = "move" | "scale" | "rotate" | "navigate";
export const MODE_INSTRUCTIONS: Record<AdvancedMode, string> = {
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
  readyHands: number;
  menuEnabled: boolean;
  factor: number;
  angle: number;
  rotationSensitivity: number;
  navigationSensitivity: number;
  message: string;
}>(() => ({
  mode: "move",
  active: false,
  readyHands: 0,
  menuEnabled: false,
  factor: 1,
  angle: 0,
  rotationSensitivity: 1,
  navigationSensitivity: 1,
  message:
    "Move: point and pinch. Scale: select, open both hands, then pinch both.",
}));
