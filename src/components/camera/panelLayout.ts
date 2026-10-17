export interface PanelLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
}
export interface WorkspaceSize {
  width: number;
  height: number;
}
export const PANEL_KEY = "holobuild.gesture-window.v1";
export const BAR_HEIGHT = 54;
export function defaultLayout(size: WorkspaceSize): PanelLayout {
  return clampLayout(
    { x: 24, y: size.height - 450, width: 300, height: 426, minimized: false },
    size,
  );
}
export function clampLayout(
  layout: PanelLayout,
  size: WorkspaceSize,
  minimizedHeight = BAR_HEIGHT,
): PanelLayout {
  const width = Math.min(Math.max(270, layout.width), Math.max(1, size.width));
  const height = Math.min(
    Math.max(220, layout.height),
    Math.max(1, size.height),
  );
  return {
    ...layout,
    width,
    height,
    x: Math.max(0, Math.min(layout.x, size.width - width)),
    y: Math.max(
      0,
      Math.min(
        layout.y,
        size.height - (layout.minimized ? minimizedHeight : height),
      ),
    ),
  };
}
export function parseLayout(value: string | null): PanelLayout | null {
  try {
    const p: unknown = JSON.parse(value ?? "null");
    if (!p || typeof p !== "object") return null;
    const l = p as PanelLayout;
    if (
      ![l.x, l.y, l.width, l.height].every(
        (v) => typeof v === "number" && Number.isFinite(v),
      ) ||
      l.width <= 0 ||
      l.height <= 0 ||
      typeof l.minimized !== "boolean"
    )
      return null;
    return {
      x: l.x,
      y: l.y,
      width: l.width,
      height: l.height,
      minimized: l.minimized,
    };
  } catch {
    return null;
  }
}
