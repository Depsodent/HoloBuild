import { useEffect, useRef } from "react";
import { gestureStream } from "../../vision/gesturePipeline";
import { useInteractionStore } from "../../interaction/interactionStore";
export function GestureCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const phase = useInteractionStore((s) => s.phase);
  useEffect(() => {
    let last = 0;
    const off = gestureStream.subscribe((frame) => {
      const element = ref.current;
      if (!element) return;
      last = performance.now();
      const p = frame.cursor;
      element.hidden = !p;
      if (p) {
        element.style.left = `${p.x * 100}%`;
        element.style.top = `${p.y * 100}%`;
        element.dataset.gesture = frame.gesture;
      }
    });
    const watchdog = setInterval(() => {
      if (ref.current && performance.now() - last > 250)
        ref.current.hidden = true;
    }, 125);
    return () => {
      off();
      clearInterval(watchdog);
    };
  }, []);
  return (
    <div
      ref={ref}
      hidden
      className={`gesture-cursor ${phase}`}
      aria-hidden="true"
    >
      <span />
      <small>
        {phase === "invalid"
          ? "INVALID"
          : phase === "dragging"
            ? "GRABBED"
            : "PINCH TO GRAB"}
      </small>
    </div>
  );
}
