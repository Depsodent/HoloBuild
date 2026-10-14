import { beforeEach, expect, it } from "vitest";
import { GestureMenuController } from "../../src/interaction/gestureMenuController";
import { useAdvancedStore } from "../../src/interaction/advancedStore";
import { useInteractionStore } from "../../src/interaction/interactionStore";
import { recognized } from "../fixtures/advanced";
import type { HandsFrame } from "../../src/vision/handRecognizer";
const frame = (timestamp: number, palm = true): HandsFrame => {
  const h = recognized(1, 0.5, false);
  if (palm)
    h.gesture = { ...h.gesture, gesture: "open-palm", candidate: "open-palm" };
  return { hands: [h], timestamp, aspectRatio: 1, ambiguous: false };
};
beforeEach(() => {
  useAdvancedStore.setState({ active: false, menuEnabled: true });
  useInteractionStore.setState({ phase: "idle", menuOpen: false });
});
it("sustained palm opens once; brief palms, disabled activation and held-palm reopening do nothing", () => {
  const c = new GestureMenuController();
  c.update(frame(0));
  for (let t = 100; t <= 1100; t += 100) c.update(frame(t));
  expect(useInteractionStore.getState().menuOpen).toBe(false);
  c.update(frame(1200));
  expect(useInteractionStore.getState().menuOpen).toBe(true);
  useInteractionStore.setState({ menuOpen: false });
  for (let t = 1300; t < 10000; t += 200) c.update(frame(t));
  expect(useInteractionStore.getState().menuOpen).toBe(false);
  useAdvancedStore.setState({ menuEnabled: false });
  const disabled = new GestureMenuController();
  disabled.update(frame(0));
  disabled.update(frame(2000));
  expect(useInteractionStore.getState().menuOpen).toBe(false);
});
it("pinch release never opens the menu until neutral rearm and a fresh sustained palm", () => {
  const c = new GestureMenuController();
  useInteractionStore.setState({ phase: "dragging" });
  c.update(frame(0));
  useInteractionStore.setState({ phase: "idle" });
  for (let t = 100; t < 10000; t += 100) c.update(frame(t));
  expect(useInteractionStore.getState().menuOpen).toBe(false);
  c.update(frame(10000, false));
  for (let t = 10100; t <= 10600; t += 100) c.update(frame(t, false));
  c.update(frame(10700));
  for (let t = 10800; t <= 12000; t += 100) c.update(frame(t));
  expect(useInteractionStore.getState().menuOpen).toBe(true);
});

it("mouse/UI suppression blocks a held palm until deliberate neutral rearm", () => {
  const c = new GestureMenuController();
  c.update(frame(0));
  c.suppress(100);
  for (let t = 200; t < 5000; t += 100) c.update(frame(t));
  expect(useInteractionStore.getState().menuOpen).toBe(false);
});
