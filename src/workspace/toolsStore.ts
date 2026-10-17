import { create } from "zustand";
import { useWorkspaceLayout } from "./layoutStore";
export type ToolsTab = "build" | "edit" | "ai" | "scene";
function initial(): ToolsTab {
  try {
    const t = localStorage.getItem("holobuild.tools-tab.v1");
    if (t && ["build", "edit", "ai", "scene"].includes(t)) return t as ToolsTab;
  } catch {
    /* Optional preference. */
  }
  return "build";
}
export const useToolsStore = create<{
  tab: ToolsTab;
  aiView: "main" | "settings" | "help";
  setTab: (tab: ToolsTab) => void;
}>((set) => ({
  tab: initial(),
  aiView: "main",
  setTab(tab) {
    set({ tab });
    try {
      localStorage.setItem("holobuild.tools-tab.v1", tab);
    } catch {
      /* Session navigation remains usable. */
    }
  },
}));
export function openTools(tab: ToolsTab) {
  useToolsStore.getState().setTab(tab);
  const s = useWorkspaceLayout.getState();
  s.update({
    rightCollapsed: false,
    ...(window.innerWidth < 780 ? { mobileDrawer: "right" as const } : {}),
  });
}
