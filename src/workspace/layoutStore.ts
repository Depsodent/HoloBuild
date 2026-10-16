import { create } from "zustand";

export interface WorkspacePreferences {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  cameraHeight: number;
  cameraMinimized: boolean;
  cameraDocked: boolean;
  inspectorMinimized: boolean;
  diagnosticsVisible: boolean;
  mobileDrawer: "left" | "right" | null;
}
export const WORKSPACE_KEY = "holobuild.workspace.v1";
export const DEFAULT_WORKSPACE: WorkspacePreferences = {
  leftWidth: 320,
  rightWidth: 234,
  leftCollapsed: false,
  rightCollapsed: false,
  cameraHeight: 280,
  cameraMinimized: false,
  cameraDocked: true,
  inspectorMinimized: false,
  diagnosticsVisible: false,
  mobileDrawer: null,
};
const bounded = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function parseWorkspace(value: string | null): WorkspacePreferences {
  try {
    const parsed: unknown = JSON.parse(value ?? "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return { ...DEFAULT_WORKSPACE };
    const result = { ...DEFAULT_WORKSPACE };
    const drawer = (parsed as Record<string, unknown>).mobileDrawer;
    if (drawer === "left" || drawer === "right") result.mobileDrawer = drawer;
    for (const key of Object.keys(result) as (keyof WorkspacePreferences)[]) {
      const candidate = (parsed as Record<string, unknown>)[key];
      if (typeof result[key] === "boolean" && typeof candidate === "boolean")
        Object.assign(result, { [key]: candidate });
    }
    for (const [key, min, max] of [
      ["leftWidth", 280, 440],
      ["rightWidth", 166, 360],
      ["cameraHeight", 54, 1000],
    ] as const) {
      const candidate = (parsed as Record<string, unknown>)[key];
      if (typeof candidate === "number" && Number.isFinite(candidate))
        result[key] = bounded(candidate, min, max);
    }
    return result;
  } catch {
    return { ...DEFAULT_WORKSPACE };
  }
}

export function fitSidebars(width: number, left: number, right: number) {
  // Shrink sidebars before taking the center below a useful 300px. Small
  // screens use overlay drawers instead and do not consume these widths.
  const available = Math.max(0, width - 312);
  let l = left;
  let r = right;
  let excess = Math.max(0, l + r - available);
  const reduceRight = Math.min(excess, Math.max(0, r - 166));
  r -= reduceRight;
  excess -= reduceRight;
  l -= Math.min(excess, Math.max(0, l - 280));
  return { left: l, right: r };
}

export function cameraHeightRange(height: number) {
  const available = Math.max(0, height);
  const min = Math.min(
    180,
    Math.max(54, (available - 47) / 2),
    Math.max(0, available - 47),
  );
  const max = Math.min(
    1000,
    Math.max(min, available - Math.min(154, Math.max(47, available / 3))),
  );
  return { min, max };
}
export function fitCameraHeight(height: number, desired: number) {
  const { min, max } = cameraHeightRange(height);
  return bounded(desired, min, max);
}

function read() {
  try {
    return parseWorkspace(localStorage.getItem(WORKSPACE_KEY));
  } catch {
    return { ...DEFAULT_WORKSPACE };
  }
}
function persist(layout: WorkspacePreferences) {
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(layout));
  } catch {
    // Restricted browser storage must not prevent layout controls from working.
  }
}
export const useWorkspaceLayout = create<{
  layout: WorkspacePreferences;
  update: (patch: Partial<WorkspacePreferences>) => void;
  reset: () => void;
}>((set) => ({
  layout: read(),
  update: (patch) =>
    set((s) => {
      const layout = parseWorkspace(JSON.stringify({ ...s.layout, ...patch }));
      persist(layout);
      return { layout };
    }),
  reset: () => {
    const layout = { ...DEFAULT_WORKSPACE };
    persist(layout);
    set({ layout });
    window.dispatchEvent(new Event("holobuild:reset-layout"));
  },
}));
