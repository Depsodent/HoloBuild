import { create } from "zustand";
export type Phase = "idle" | "targeting" | "dragging" | "invalid";
export type MenuAction = "create" | "undo" | "close";
export const useInteractionStore = create<{
  phase: Phase;
  hoveredId: string | null;
  menuOpen: boolean;
  message: string;
  rayTarget: string | null;
  rejection: string;
}>(() => ({
  phase: "idle",
  hoveredId: null,
  menuOpen: false,
  message: "Point at a cube, then pinch to grab.",
  rayTarget: null,
  rejection: "Open your pinch and aim at a cube.",
}));
