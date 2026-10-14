import type { Landmark } from "../../src/vision/landmarkStream";
export function hand(
  kind: "pointing" | "pinch" | "open-palm" | "fist" = "pointing",
  ratio = 0.15,
): Landmark[] {
  const p = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.65, z: 0 }));
  p[0] = { x: 0.5, y: 0.84, z: 0 };
  for (const [i, x] of [
    [5, 0.4],
    [9, 0.49],
    [13, 0.57],
    [17, 0.65],
  ]) {
    const extended =
      kind === "open-palm" ||
      ((kind === "pointing" || kind === "pinch") && i === 5);
    p[i] = { x, y: 0.62, z: 0 };
    p[i + 1] = { x, y: extended ? 0.46 : 0.55, z: 0 };
    p[i + 2] = { x, y: extended ? 0.34 : 0.6, z: 0 };
    p[i + 3] = { x, y: extended ? 0.22 : 0.68, z: 0 };
  }
  p[1] = { x: 0.35, y: 0.77, z: 0 };
  p[2] = { x: 0.29, y: 0.72, z: 0 };
  p[3] = { x: 0.25, y: 0.66, z: 0 };
  p[4] = { x: 0.22, y: 0.6, z: 0 };
  if (kind === "pinch") p[4] = { ...p[8], x: p[8].x + ratio * 0.25 };
  return p;
}

// Synthetic live-style variation: relaxed middle finger, non-zero depth,
// gradual thumb closure. These are reproducible fixtures, not webcam recordings.
export function relaxedHand(ratio = 0.9): Landmark[] {
  const p = hand("pinch", ratio);
  const open = hand("open-palm");
  for (let i = 9; i <= 12; i++) p[i] = { ...open[i] };
  p[4].z = 0.012;
  p[8].z = -0.006;
  return p;
}
