import { expect, it } from "vitest";
import { HandRecognizer } from "../../src/vision/handRecognizer";
import { hand } from "../fixtures/landmarks";
const at = (x: number) => ({
  landmarks: hand().map((p) => ({ ...p, x: p.x + x })),
});
it("spatial hand IDs survive reversed result order and misleading handedness labels", () => {
  const r = new HandRecognizer();
  const first = r.update([at(-0.2), at(0.2)], 0);
  const second = r.update(
    [
      { ...at(0.19), handedness: "Left" },
      { ...at(-0.19), handedness: "Right" },
    ],
    40,
  );
  expect(second.hands.map((h) => h.id)).toEqual(first.hands.map((h) => h.id));
  expect(second.hands[0].landmarks[0].x).toBeLessThan(
    second.hands[1].landmarks[0].x,
  );
});
it("hand loss does not transfer its identity to a new hand; gaps reset tracks", () => {
  const r = new HandRecognizer();
  const a = r.update([at(-0.2), at(0.2)], 0);
  const b = r.update([at(0.2)], 50);
  expect(b.hands[0].id).toBe(a.hands[1].id);
  const c = r.update([at(-0.2), at(0.2)], 100);
  expect(c.hands.some((h) => h.id === a.hands[0].id)).toBe(false);
  const d = r.update([at(0.2)], 500);
  expect(d.hands[0].id).not.toBe(b.hands[0].id);
});
it("crossing/overlapping hands report ambiguity and each hand has independent pinch dwell", () => {
  const r = new HandRecognizer();
  expect(r.update([at(0), at(0.02)], 0).ambiguous).toBe(true);
  const left = {
    landmarks: hand("pinch").map((p) => ({ ...p, x: p.x - 0.2 })),
  };
  const independent = new HandRecognizer();
  independent.update([left, at(0.2)], 40);
  const stable = independent.update([left, at(0.2)], 160);
  expect(stable.hands.filter((h) => h.gesture.pinchActive)).toHaveLength(1);
});
