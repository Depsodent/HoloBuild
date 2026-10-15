import { useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

export function ResizeHandle({
  label,
  orientation,
  value,
  min,
  max,
  direction = 1,
  onResize,
}: {
  label: string;
  orientation: "horizontal" | "vertical";
  value: number;
  min: number;
  max: number;
  direction?: number;
  onResize: (value: number) => void;
}) {
  const drag = useRef<{ id: number; start: number; value: number } | null>(
    null,
  );
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const coordinate = (e: PointerEvent) =>
    orientation === "vertical" ? e.clientX : e.clientY;
  const end = (e: PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };
  function key(e: KeyboardEvent) {
    const step = e.shiftKey ? 40 : 10;
    const delta =
      orientation === "vertical"
        ? { ArrowLeft: -step, ArrowRight: step }[e.key]
        : { ArrowUp: -step, ArrowDown: step }[e.key];
    if (delta === undefined && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    e.stopPropagation();
    onResize(
      e.key === "Home"
        ? min
        : e.key === "End"
          ? max
          : clamp(value + delta! * direction),
    );
  }
  return (
    <div
      className={`workspace-resizer ${orientation}`}
      data-layout-handle
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={Math.round(value)}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      title={`${label} · Arrow keys resize · Shift for larger steps`}
      onKeyDown={key}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        drag.current = { id: e.pointerId, start: coordinate(e), value };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d?.id === e.pointerId)
          onResize(clamp(d.value + (coordinate(e) - d.start) * direction));
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <span />
    </div>
  );
}
