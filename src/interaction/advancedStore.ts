import { create } from "zustand";
export type AdvancedMode = "move" | "scale" | "rotate" | "navigate";
export const MODE_INSTRUCTIONS: Record<AdvancedMode, string> = {
  move: "Point at an object, pinch to grab, move, then release.",
  scale:
    "Select an object. Open both pinches, then pinch both. Apart enlarges, together shrinks; release to confirm.",
  rotate:
    "Select an object. Open both pinches, then pinch both. Tilt the line between hands to rotate around world Y; release to confirm.",
  navigate:
    "Use one hand. Open pinch, then pinch and move to pan the camera. Release confirms; hand loss restores the starting view.",
};
export const useAdvancedStore = create<{
  mode: AdvancedMode;
  active: boolean;
  menuEnabled: boolean;
  factor: number;
  angle: number;
  rotationSensitivity: number;
  navigationSensitivity: number;
  message: string;
}>(() => ({
  mode: "move",
  active: false,
  menuEnabled: false,
  factor: 1,
  angle: 0,
  rotationSensitivity: 1,
  navigationSensitivity: 1,
  message:
    "Move: point and pinch. Scale: select, open both hands, then pinch both.",
}));
