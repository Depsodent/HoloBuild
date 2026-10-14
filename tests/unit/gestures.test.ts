import { describe, it, expect } from "vitest";
import { GestureDetector, pinchRatio } from "../../src/vision/gestureDetector";
import { LandmarkSmoother } from "../../src/vision/smoothing";
import { hand } from "../fixtures/landmarks";
describe("temporal gesture recognition", () => {
  it("requires stable pointing and open palm", () => {
    const d = new GestureDetector();
    expect(d.update(hand(), 0).gesture).toBe("none");
    expect(d.update(hand(), 130).gesture).toBe("pointing");
    d.update(hand("open-palm"), 140);
    d.update(hand("open-palm"), 300);
    expect(d.update(hand("open-palm"), 500).gesture).toBe("open-palm");
  });
  it("pinch normalizes by palm size independent of hand size", () => {
    const p = hand("pinch");
    expect(pinchRatio(p)).toBeCloseTo(
      pinchRatio(p.map((v) => ({ x: v.x * 0.5, y: v.y * 0.5, z: v.z * 0.5 }))),
    );
  });
  it("debounces activation and uses separate release threshold", () => {
    const d = new GestureDetector();
    expect(d.update(hand("pinch"), 0).gesture).toBe("none");
    expect(d.update(hand("pinch"), 100).gesture).toBe("pinch");
    expect(d.update(hand("pinch", 0.4), 150).gesture).toBe("pinch");
    expect(d.update(hand("pinch", 0.55), 180).gesture).toBe("pinch");
    expect(d.update(hand("pinch", 0.55), 280).gesture).not.toBe("pinch");
  });
  it("resets immediately on lost or malformed landmarks", () => {
    const d = new GestureDetector();
    d.update(hand("pinch"), 0);
    d.update(hand("pinch"), 100);
    expect(d.update([], 110).cursor).toBeNull();
    expect(d.update(hand("pinch"), 120).gesture).toBe("none");
    const bad = hand();
    bad[4].x = NaN;
    expect(d.update(bad, 150).gesture).toBe("none");
  });
  it("requires fresh dwell after a long frame gap", () => {
    const d = new GestureDetector();
    d.update(hand("pinch"), 0);
    d.update(hand("pinch"), 100);
    expect(d.update(hand("pinch"), 500).gesture).toBe("none");
  });
  it("recognizes a held fist without interpreting it as a pinch", () => {
    const d = new GestureDetector();
    d.update(hand("fist"), 0);
    expect(d.update(hand("fist"), 230).gesture).toBe("fist");
  });
});
it("smooths motion consistently and resets after loss", () => {
  const s = new LandmarkSmoother(50);
  s.update([{ x: 0, y: 0, z: 0 }], 0);
  const result = s.update([{ x: 1, y: 1, z: 1 }], 50);
  expect(result[0].x).toBeCloseTo(1 - Math.exp(-1));
  s.update([], 100);
  expect(s.update([{ x: 1, y: 1, z: 1 }], 110)[0].x).toBe(1);
});

it("debounces a live-style pinch independently of changing release poses", () => {
  const d = new GestureDetector();
  const relaxed = hand("open-palm");
  // A relaxed two-finger aim is unknown, not the strict pointing classifier.
  for (let i = 13; i < 21; i++) relaxed[i] = hand()[i];
  d.update(relaxed, 0);
  expect(d.update(relaxed, 200).gesture).toBe("unknown");
  const closed = structuredClone(relaxed);
  closed[4] = { ...closed[8], x: closed[8].x + 0.05, z: 0.02 };
  expect(d.update(closed, 240).pinchActive).toBe(false);
  expect(d.update(closed, 340).pinchActive).toBe(true);
  d.update(relaxed, 380);
  d.update(hand("open-palm"), 420);
  expect(d.update(relaxed, 480).pinchActive).toBe(false);
});
it("short threshold crossings cannot chatter into grabs or releases", () => {
  const d = new GestureDetector();
  for (let t = 0; t < 300; t += 30)
    expect(d.update(hand(t % 60 ? "pointing" : "pinch"), t).pinchActive).toBe(
      false,
    );
  d.update(hand("pinch"), 330);
  expect(d.update(hand("pinch"), 430).pinchActive).toBe(true);
  d.update(hand(), 460);
  expect(d.update(hand("pinch"), 490).pinchActive).toBe(true);
});
it("normalizes webcam aspect ratio without changing mirrored cursor coordinates", () => {
  const p = hand("pinch", 0.28);
  const wide = p.map((v) => ({ ...v, y: (v.y * 4) / 3 }));
  const a = new GestureDetector().update(p, 0);
  const b = new GestureDetector().update(wide, 0, 4 / 3);
  expect(b.pinchRatio).toBeCloseTo(a.pinchRatio!);
  expect(b.cursor).toEqual({ x: 1 - wide[8].x, y: wide[8].y });
});
