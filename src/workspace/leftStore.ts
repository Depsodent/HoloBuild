import { useWorkspaceLayout } from "./layoutStore";
import { create } from "zustand";
export type LeftTab = "gesture" | "inspector" | "collection";
function initial(): LeftTab {
  try {
    const tab = localStorage.getItem("holobuild.left-tab.v1");
    if (tab && ["gesture", "inspector", "collection"].includes(tab))
      return tab as LeftTab;
  } catch {
    /* Optional preference. */
  }
  return "gesture";
}
export const useLeftStore = create<{
  tab: LeftTab;
  setTab: (tab: LeftTab) => void;
}>((set) => ({
  tab: initial(),
  setTab(tab) {
    set({ tab });
    try {
      localStorage.setItem("holobuild.left-tab.v1", tab);
    } catch {
      /* Optional preference. */
    }
  },
}));

export function openLeft(tab: LeftTab) {
  useLeftStore.getState().setTab(tab);
  useWorkspaceLayout
    .getState()
    .update({
      leftCollapsed: false,
      ...(window.innerWidth < 780 ? { mobileDrawer: "left" as const } : {}),
    });
}
