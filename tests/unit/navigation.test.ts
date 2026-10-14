import { beforeEach, expect, it, vi } from "vitest";
import { NavigationController } from "../../src/interaction/navigationController";
import { useAdvancedStore } from "../../src/interaction/advancedStore";
import { useInteractionStore } from "../../src/interaction/interactionStore";
import { recognized } from "../fixtures/advanced";
import type { HandsFrame } from "../../src/vision/handRecognizer";
const frame = (time: number, pinch: boolean, x = 0.5): HandsFrame => ({
  hands: [recognized(1, x, pinch)],
  timestamp: time,
  aspectRatio: 1,
  ambiguous: false,
});
beforeEach(() => {
  useAdvancedStore.setState({
    mode: "navigate",
    active: false,
    navigationSensitivity: 1,
  });
  useInteractionStore.setState({ menuOpen: false, phase: "idle" });
});
it("only explicit navigation pans, release finishes, and no object command is issued", () => {
  const pan = vi.fn(() => true),
    restore = vi.fn();
  const c = new NavigationController({ capture: () => "view", pan, restore });
  c.update(frame(0, false));
  c.update(frame(100, true));
  expect(c.active).toBe(true);
  c.update(frame(150, true, 0.6));
  expect(pan).toHaveBeenCalled();
  c.update(frame(200, false, 0.6));
  expect(c.active).toBe(false);
  expect(restore).not.toHaveBeenCalled();
  useAdvancedStore.setState({ mode: "move" });
  c.update(frame(250, false));
  c.update(frame(350, true));
  expect(c.active).toBe(false);
});
it("navigation loss, mode change and out-of-bounds pan restore the initial view", () => {
  for (const end of ["loss", "mode", "bounds"] as const) {
    useAdvancedStore.setState({ mode: "navigate" });
    const restore = vi.fn();
    const c = new NavigationController({
      capture: () => 42,
      pan: () => end !== "bounds",
      restore,
    });
    c.update(frame(0, false));
    c.update(frame(100, true));
    if (end === "mode") useAdvancedStore.setState({ mode: "scale" });
    c.update(
      end === "loss"
        ? { ...frame(150, true), hands: [] }
        : frame(150, true, 0.6),
    );
    expect(c.active).toBe(false);
    expect(restore).toHaveBeenCalledWith(42);
    c.update(frame(200, true));
    expect(c.active).toBe(false);
  }
});
