import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, KeyboardEvent, RefObject } from "react";
import {
  BAR_HEIGHT,
  PANEL_KEY,
  clampLayout,
  defaultLayout,
  parseLayout,
} from "./panelLayout";
import type { PanelLayout, WorkspaceSize } from "./panelLayout";
export interface FloatingPanelOptions {
  storageKey?: string;
  boundarySelector?: string;
  initialLayout?: (size: WorkspaceSize) => PanelLayout;
  minimized?: boolean;
}
function readLayout(storageKey: string) {
  try {
    return parseLayout(localStorage.getItem(storageKey));
  } catch {
    return null;
  }
}
export function useFloatingPanel(
  panel: RefObject<HTMLElement | null>,
  {
    storageKey = PANEL_KEY,
    boundarySelector,
    initialLayout = defaultLayout,
    minimized,
  }: FloatingPanelOptions = {},
) {
  const [storedLayout, setLayout] = useState(
    () => readLayout(storageKey) ?? initialLayout({ width: 800, height: 600 }),
  );
  const layout = useMemo(
    () =>
      minimized === undefined ? storedLayout : { ...storedLayout, minimized },
    [storedLayout, minimized],
  );
  const size = useRef<WorkspaceSize>({ width: 800, height: 600 });
  const initialized = useRef(false);
  const previous = useRef<PanelLayout | null>(null);
  const drag = useRef<{
    id: number;
    mode: "move" | "resize";
    x: number;
    y: number;
    layout: PanelLayout;
  } | null>(null);
  useEffect(() => {
    const workspace = boundarySelector
      ? (panel.current?.closest<HTMLElement>(boundarySelector) ??
        panel.current?.parentElement)
      : panel.current?.parentElement;
    if (!workspace) return;
    const observer = new ResizeObserver(() => {
      size.current = {
        width: workspace.clientWidth,
        height: workspace.clientHeight,
      };
      const saved = readLayout(storageKey);
      const first = !initialized.current && !saved;
      setLayout((current) =>
        clampLayout(
          {
            ...(first ? initialLayout(size.current) : current),
            ...(minimized === undefined ? {} : { minimized }),
          },
          size.current,
        ),
      );
      initialized.current = true;
    });
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [panel, boundarySelector, storageKey, initialLayout, minimized]);
  useEffect(() => {
    if (!initialized.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch {
      /* Storage can be disabled. */
    }
  }, [layout, storageKey]);
  const reset = useCallback(() => {
    previous.current = null;
    drag.current = null;
    setLayout(clampLayout(initialLayout(size.current), size.current));
  }, [initialLayout]);
  useEffect(() => {
    window.addEventListener("holobuild:reset-layout", reset);
    return () => window.removeEventListener("holobuild:reset-layout", reset);
  }, [reset]);
  function start(e: PointerEvent<HTMLElement>, mode: "move" | "resize") {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    previous.current = null;
    drag.current = {
      id: e.pointerId,
      mode,
      x: e.clientX,
      y: e.clientY,
      layout,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    setLayout(
      clampLayout(
        d.mode === "move"
          ? { ...d.layout, x: d.layout.x + dx, y: d.layout.y + dy }
          : {
              ...d.layout,
              width: Math.min(
                d.layout.width + dx,
                size.current.width - d.layout.x,
              ),
              height: Math.min(
                d.layout.height + dy,
                size.current.height - d.layout.y,
              ),
            },
        size.current,
      ),
    );
  }
  function end(e: PointerEvent<HTMLElement>) {
    if (drag.current?.id === e.pointerId) drag.current = null;
  }
  function keyboard(e: KeyboardEvent<HTMLElement>, mode: "move" | "resize") {
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[e.key];
    if (!direction) return;
    e.preventDefault();
    e.stopPropagation();
    previous.current = null;
    const step = e.shiftKey ? 40 : 10;
    setLayout((l) =>
      clampLayout(
        mode === "move"
          ? { ...l, x: l.x + direction[0] * step, y: l.y + direction[1] * step }
          : {
              ...l,
              width: l.width + direction[0] * step,
              height: l.height + direction[1] * step,
            },
        size.current,
      ),
    );
  }
  const handle = (mode: "move" | "resize") => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => start(e, mode),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => keyboard(e, mode),
  });
  return {
    layout,
    style: {
      left: layout.x,
      top: layout.y,
      width: layout.width,
      height: layout.minimized ? BAR_HEIGHT : layout.height,
    },
    handle,
    minimize: () =>
      setLayout((l) =>
        clampLayout({ ...l, minimized: !l.minimized }, size.current),
      ),
    reset,
    maximize: () => {
      if (previous.current) {
        setLayout(clampLayout(previous.current, size.current));
        previous.current = null;
      } else {
        previous.current = layout;
        setLayout(
          clampLayout(
            {
              x: 12,
              y: 12,
              width: Math.min(600, size.current.width - 24),
              height: size.current.height - 24,
              minimized: false,
            },
            size.current,
          ),
        );
      }
    },
  };
}
