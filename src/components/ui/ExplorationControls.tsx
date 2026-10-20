import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useViewStore, resetWalkthrough } from "../../exploration/viewStore";
import { enterExploration, exitExploration } from "../../exploration/actions";
function WalkingPosition() {
  const feet = useViewStore((s) => s.feet);
  return (
    <output aria-label="Walking position">
      X {feet[0].toFixed(2)} · feet {feet[1].toFixed(2)} m · Z{" "}
      {feet[2].toFixed(2)}
    </output>
  );
}
export function ExplorationControls() {
  const s = useViewStore(
    useShallow(({ walking, looking, paused, guide, message, approximate }) => ({
      walking,
      looking,
      paused,
      guide,
      message,
      approximate,
    })),
  );
  const first = useRef<HTMLButtonElement>(null),
    controls = useRef<HTMLButtonElement>(null),
    was = useRef(false);
  useEffect(() => {
    if (s.walking && !was.current) first.current?.focus();
    if (!s.walking && was.current)
      document
        .querySelector<HTMLButtonElement>('[aria-label="Enter Walkthrough"]')
        ?.focus();
    was.current = s.walking;
  }, [s.walking]);
  function resume(lock: boolean) {
    const canvas = document.querySelector<HTMLCanvasElement>(
      "canvas[data-engine]",
    );
    if (!canvas) return;
    canvas.tabIndex = 0;
    canvas.focus();
    const declined = () => {
      if (useViewStore.getState().walking)
        useViewStore.setState({
          paused: true,
          looking: false,
          guide: true,
          message:
            "Mouse lock unavailable or declined. Use keyboard/touch in Controls.",
        });
    };
    if (!lock) {
      useViewStore.setState({
        paused: false,
        looking: false,
        message: "Keyboard/touch active · arrows move/turn · Escape pauses.",
      });
      return;
    }
    if (!canvas.requestPointerLock) {
      declined();
      return;
    }
    try {
      Promise.resolve(canvas.requestPointerLock()).catch(declined);
    } catch {
      declined();
    }
  }
  const release = () =>
    useViewStore.setState({ virtual: { forward: 0, right: 0, turn: 0 } });
  const hold = (forward: number, right: number, turn = 0) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      useViewStore.setState({ virtual: { forward, right, turn } });
    },
    onPointerUp: release,
    onPointerCancel: release,
    onLostPointerCapture: release,
  });
  function closeHelp() {
    release();
    useViewStore.setState({ guide: false });
    controls.current?.focus();
  }
  if (!s.walking)
    return (
      <div className="viewport-mode-entry" aria-label="Explore scene">
        <button
          aria-label="Enter Walkthrough"
          onClick={() => enterExploration()}
        >
          Walkthrough
        </button>
        {s.message && <p role="status">{s.message}</p>}
      </div>
    );
  return (
    <section className="exploration-controls" aria-label="Exploration controls">
      <div
        className="exploration-toolbar"
        role="toolbar"
        aria-label="Walkthrough controls"
      >
        <button
          ref={first}
          aria-pressed={s.looking}
          onClick={() => resume(true)}
        >
          Look Around
        </button>
        <button onClick={exitExploration}>Exit Walkthrough</button>
        <button onClick={resetWalkthrough}>Reset Position</button>
        <button
          ref={controls}
          aria-expanded={s.guide}
          aria-controls="walkthrough-help"
          onClick={() => {
            release();
            useViewStore.setState({ guide: !s.guide });
          }}
        >
          Controls
        </button>
      </div>
      <p role="status">
        {s.message ||
          (s.paused
            ? "Paused · Look Around to begin; keyboard/touch in Controls."
            : "Mouse look active · WASD move · Escape pauses.")}
      </p>
      {s.guide && (
        <div
          id="walkthrough-help"
          role="region"
          aria-label="Walkthrough help"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              closeHelp();
            }
          }}
        >
          <p>
            WASD move. Arrow Up/Down move; Left/Right turn. Look Around locks
            the mouse; Escape unlocks and pauses. Tab to Exit Walkthrough to
            return to the editor. Reset Position restores the safe starting
            position.
          </p>
          <p>
            Native doors act as open portals; windows and rails stay solid.
            {s.approximate > 0
              ? " Imported, curved and tilted shapes use conservative bounds; mesh interiors are not navigable."
              : ""}
          </p>
          <div className="walk-help-actions">
            <button onClick={() => resume(false)}>Use keyboard / touch</button>
            <button onClick={closeHelp}>Close controls</button>
          </div>
          <div className="walk-touch-controls" aria-label="Movement controls">
            <button disabled={s.paused} {...hold(1, 0)}>
              Forward
            </button>
            <button disabled={s.paused} {...hold(0, -1)}>
              Left
            </button>
            <button disabled={s.paused} {...hold(-1, 0)}>
              Back
            </button>
            <button disabled={s.paused} {...hold(0, 1)}>
              Right
            </button>
            <button disabled={s.paused} {...hold(0, 0, 1)}>
              Turn left
            </button>
            <button disabled={s.paused} {...hold(0, 0, -1)}>
              Turn right
            </button>
          </div>
          <WalkingPosition />
        </div>
      )}
    </section>
  );
}
