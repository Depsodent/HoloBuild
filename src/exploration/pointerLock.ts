import { useViewStore } from "./viewStore";
let generation = 0;
let heldLock = false;
let expectedRelease = false;
let unlocking: Element | null = null;
const canvas = () =>
  document.querySelector?.<HTMLCanvasElement>("canvas[data-engine]");
export function releaseLook() {
  generation++;
  heldLock = false;
  expectedRelease = true;
  if (!document.pointerLockElement) unlocking = null;
  if (
    document.pointerLockElement &&
    unlocking !== document.pointerLockElement
  ) {
    unlocking = document.pointerLockElement;
    document.exitPointerLock?.();
  }
}
export function lookUnavailable() {
  if (!useViewStore.getState().walking) return;
  useViewStore.setState({
    looking: false,
    paused: true,
    message:
      "Mouse lock unavailable or declined. Click Look Around to retry, or use keyboard/touch in Controls.",
  });
}
export function requestLook() {
  const el = canvas(),
    state = useViewStore.getState();
  if (!el || !state.walking || state.furnishing || state.manipulating) return;
  if (unlocking && document.pointerLockElement === unlocking) {
    lookUnavailable();
    return;
  }
  if (document.pointerLockElement === el && state.looking) return;
  if (!document.pointerLockElement) unlocking = null;
  const epoch = ++generation;
  el.tabIndex = 0;
  el.focus();
  if (!el.requestPointerLock) {
    lookUnavailable();
    return;
  }
  try {
    const pending = el.requestPointerLock();
    Promise.resolve(pending)
      .then(() => {
        if (
          epoch !== generation ||
          !useViewStore.getState().walking ||
          useViewStore.getState().furnishing
        ) {
          if (
            !useViewStore.getState().walking &&
            document.pointerLockElement === el
          )
            document.exitPointerLock?.();
          return;
        }
        if (document.pointerLockElement === el) syncLook();
      })
      .catch(() => {
        if (epoch === generation) lookUnavailable();
      });
  } catch {
    if (epoch === generation) lookUnavailable();
  }
}
/** Returns true only for an unrequested loss of a previously acquired lock (native Escape). */
export function syncLook() {
  const state = useViewStore.getState(),
    locked = !!canvas() && document.pointerLockElement === canvas();
  if (locked && unlocking === document.pointerLockElement) return false;
  if (locked && state.walking && !state.furnishing) {
    heldLock = true;
    expectedRelease = false;
    useViewStore.setState({
      looking: true,
      paused: false,
      message:
        "Mouse look active · WASD move · E catalog · Ctrl + right-drag moves · Escape exits.",
    });
    return false;
  }
  unlocking = null;
  const wasHeld = heldLock;
  const deliberate = expectedRelease;
  const exit = heldLock && !deliberate && state.walking;
  heldLock = false;
  expectedRelease = false;
  if (state.walking && (wasHeld || deliberate))
    useViewStore.setState({
      looking: false,
      ...(!deliberate ? { paused: true } : {}),
    });
  return exit;
}
export function keyboardLook() {
  releaseLook();
  useViewStore.setState({
    paused: false,
    looking: false,
    message:
      "Keyboard/touch active · WASD move · Space jump · E catalog · Escape exits.",
  });
  canvas()?.focus();
}
