import { create } from "zustand";
interface TrackingState {
  status: "off" | "starting" | "running" | "error";
  message: string;
  inferenceMs: number;
  inferenceHz: number;
  handVisible: boolean;
}
export const useTrackingStore = create<TrackingState>(() => ({
  status: "off",
  message: "Camera is off. Mouse controls are ready.",
  inferenceMs: 0,
  inferenceHz: 0,
  handVisible: false,
}));
