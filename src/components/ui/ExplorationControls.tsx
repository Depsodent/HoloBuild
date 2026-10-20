import { useEffect, useRef, useState } from "react";
import {
  useViewStore,
  viewPreferences,
  viewRequest,
} from "../../exploration/viewStore";
import { enterExploration, exitExploration } from "../../exploration/actions";
import { useTrackingStore } from "../../vision/trackingStore";
export function ExplorationControls() {
  const s = useViewStore(),
    [name, setName] = useState(""),
    active = s.walking || s.presentation;
  const first = useRef<HTMLButtonElement>(null),
    was = useRef(false);
  const cameraActive = useTrackingStore(
    (s) => s.status === "running" || s.status === "starting",
  );
  useEffect(() => {
    if (active && !was.current) first.current?.focus();
    if (!active && was.current)
      document
        .querySelector<HTMLButtonElement>('[aria-label="Enter Walkthrough"]')
        ?.focus();
    was.current = active;
  }, [active]);
  function resume(lock: boolean) {
    const canvas = document.querySelector<HTMLCanvasElement>(
      "canvas[data-engine]",
    );
    if (!canvas) return;
    canvas.tabIndex = 0;
    canvas.focus();
    if (!lock) {
      useViewStore.setState({
        paused: false,
        message:
          "Keyboard/touch movement active. Arrow keys move/turn; Escape pauses.",
      });
      return;
    }
    if (!canvas.requestPointerLock) {
      useViewStore.setState({
        message: "Mouse lock is unavailable. Choose keyboard/touch controls.",
      });
      return;
    }
    try {
      Promise.resolve(canvas.requestPointerLock()).catch(() =>
        useViewStore.setState({
          paused: true,
          message:
            "Mouse lock was declined. Retry with a click or use keyboard/touch controls.",
        }),
      );
    } catch {
      useViewStore.setState({
        message: "Mouse lock was declined. Use keyboard/touch controls.",
      });
    }
  }
  const hold = (forward: number, right: number, turn = 0) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      useViewStore.setState({ virtual: { forward, right, turn } });
    },
    onPointerUp: () =>
      useViewStore.setState({ virtual: { forward: 0, right: 0, turn: 0 } }),
    onPointerCancel: () =>
      useViewStore.setState({ virtual: { forward: 0, right: 0, turn: 0 } }),
    onLostPointerCapture: () =>
      useViewStore.setState({ virtual: { forward: 0, right: 0, turn: 0 } }),
  });
  if (!active)
    return (
      <div className="viewport-mode-entry" aria-label="Explore scene">
        <button
          aria-label="Enter Walkthrough"
          onClick={() => enterExploration(true)}
        >
          Walkthrough
        </button>
        <button
          aria-label="Enter Presentation"
          onClick={() => enterExploration(false)}
        >
          Present
        </button>
        {s.message && <p role="status">{s.message}</p>}
      </div>
    );
  return (
    <section className="exploration-controls" aria-label="Exploration controls">
      <div className="exploration-toolbar">
        <strong>{s.walking ? "Walkthrough" : "Presentation · Overview"}</strong>
        {s.walking ? (
          <>
            <button ref={first} onClick={() => resume(true)}>
              Look around
            </button>
            <button onClick={() => resume(false)}>Use keyboard / touch</button>
            <button
              onClick={() => {
                document.exitPointerLock?.();
                useViewStore.setState({
                  paused: true,
                  message: "Paused. Choose controls to resume.",
                  virtual: { forward: 0, right: 0, turn: 0 },
                });
              }}
            >
              Pause
            </button>
            <button
              onClick={() => {
                document.exitPointerLock?.();
                if (!s.presentation) exitExploration();
                else
                  useViewStore.setState({
                    walking: false,
                    paused: true,
                    message: "Read-only overview",
                  });
              }}
            >
              Exit Walkthrough
            </button>
          </>
        ) : (
          <button ref={first} onClick={() => enterExploration(true)}>
            Walkthrough
          </button>
        )}
        {s.presentation && (
          <button
            onClick={() => {
              document.exitPointerLock?.();
              useViewStore.setState({ walking: false, paused: true });
            }}
          >
            Overview
          </button>
        )}
        <button onClick={() => viewRequest(s.walking ? "reset" : "fit")}>
          {s.walking ? "Reset position" : "Fit scene"}
        </button>
        <button onClick={exitExploration}>
          {s.presentation ? "Exit Presentation" : "Return to editor"}
        </button>
        {cameraActive && (
          <button
            aria-label="Stop camera while exploring"
            onClick={() =>
              window.dispatchEvent(new Event("holobuild:stop-camera"))
            }
          >
            Stop camera
          </button>
        )}
        <button
          onClick={() => useViewStore.setState({ guide: !s.guide })}
          aria-expanded={s.guide}
        >
          Controls
        </button>
      </div>
      {s.guide && (
        <p className="muted">
          {s.walking
            ? "WASD move · arrows move/turn · mouse lock looks · Escape pauses. Native static door panels act as open portals. Windows stay solid."
            : "Drag to orbit · scroll to zoom. Presentation is read-only; Exit restores your editor view and panels."}{" "}
          {s.approximate > 0 && s.walking
            ? "Imported, curved and tilted geometry uses conservative solid bounds; mesh interiors are not navigable."
            : ""}
        </p>
      )}
      <p role="status">
        {s.message ||
          (s.walking
            ? s.paused
              ? "Paused — choose mouse look or keyboard/touch."
              : "Walking · scene editing is paused."
            : "Read-only overview")}
      </p>
      <details>
        <summary>View settings and saved viewpoints</summary>
        <div className="precision-grid">
          <label>
            Speed (m/s)
            <input
              aria-label="Walking speed"
              type="number"
              min=".5"
              max="6"
              step=".1"
              value={s.speed}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 0.5 && n <= 6) viewPreferences({ speed: n });
              }}
            />
          </label>
          <label>
            Eye height (m)
            <input
              aria-label="Eye height"
              type="number"
              min="1.2"
              max="1.9"
              step=".05"
              value={s.eyeHeight}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 1.2 && n <= 1.9) viewPreferences({ eyeHeight: n });
              }}
            />
          </label>
        </div>
        <div className="saved-view-composer">
          <input
            aria-label="Viewpoint name"
            value={name}
            maxLength={50}
            placeholder="Saved locally in this browser"
            onChange={(e) => setName(e.target.value)}
          />
          <button
            disabled={!name.trim() || s.views.length >= 12}
            onClick={() => {
              viewRequest("save", name.trim());
              setName("");
            }}
          >
            Save viewpoint
          </button>
        </div>
        <ul className="saved-view-list">
          {s.views.map((v) => (
            <li key={v.id}>
              <button onClick={() => viewRequest("recall", v.id)}>
                Go to {v.name}
              </button>
              <button
                aria-label={"Remove viewpoint " + v.name}
                onClick={() =>
                  viewPreferences({
                    views: s.views.filter((x) => x.id !== v.id),
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        {document.fullscreenEnabled && (
          <button
            onClick={() => {
              const element = document.querySelector<HTMLElement>(".viewport");
              if (document.fullscreenElement)
                void document.exitFullscreen().catch(() => {});
              else
                void element?.requestFullscreen().catch(() =>
                  useViewStore.setState({
                    message:
                      "Fullscreen unavailable; presentation still works in this window.",
                  }),
                );
            }}
          >
            Toggle fullscreen
          </button>
        )}
      </details>
      {s.walking && (
        <>
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
          <output aria-label="Walking position">
            X {s.feet[0].toFixed(2)} · feet {s.feet[1].toFixed(2)} m · Z{" "}
            {s.feet[2].toFixed(2)}
          </output>
        </>
      )}
    </section>
  );
}
