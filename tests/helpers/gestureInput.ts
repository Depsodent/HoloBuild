import type { Page } from "@playwright/test";
import type { Landmark } from "../../src/vision/landmarkStream";
import { hand, relaxedHand } from "../fixtures/landmarks";
const clockedPages = new WeakSet<Page>();
export function poseAt(
  kind: Parameters<typeof hand>[0],
  cursor: { x: number; y: number },
) {
  const points = hand(kind);
  const index = { ...points[8] };
  return points.map((p) => ({
    x: 1 - cursor.x + (p.x - index.x) * 0.45,
    y: cursor.y + (p.y - index.y) * 0.45,
    z: p.z * 0.45,
  }));
}
export function livePoseAt(ratio: number, cursor: { x: number; y: number }) {
  const points = relaxedHand(ratio);
  const index = points[8];
  return points.map((p) => ({
    x: 1 - cursor.x + (p.x - index.x) * 0.45,
    y: cursor.y + ((p.y - index.y) * 0.45 * 4) / 3,
    z: p.z * 0.45,
  }));
}
export async function hold(
  page: Page,
  points: Landmark[],
  ms = 600,
  aspectRatio = 1,
) {
  if (!clockedPages.has(page)) {
    // Gesture timing is simulated; rendering, raycasts and scene commands are real.
    // CPU load must not turn a continuous fixture into accidental hand loss.
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
    clockedPages.add(page);
  }
  await page.evaluate(
    ({ points, aspectRatio }) =>
      window.__HOLO_TEST__!.repeat(points, aspectRatio),
    { points, aspectRatio },
  );
  await page.clock.runFor(ms);
}
export async function target(page: Page, index = 0) {
  await page.waitForFunction(() => !!window.__HOLO_TEST__?.project);
  return page.evaluate((index) => {
    const api = window.__HOLO_TEST__!;
    const o = api.scene()[index];
    return { object: o, cursor: api.project!(o.id)! };
  }, index);
}
