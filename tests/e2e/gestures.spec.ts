import { test, expect, type Page } from "@playwright/test";
import { hand } from "../fixtures/landmarks";
import type { Landmark } from "../../src/vision/landmarkStream";
export async function hold(page: Page, points: Landmark[], ms = 500) {
  await page.evaluate(
    async ({ points, ms }) => {
      const start = performance.now();
      do {
        window.__HOLO_TEST__!.feed(points);
        await new Promise((r) => setTimeout(r, 35));
      } while (performance.now() - start < ms);
    },
    { points, ms },
  );
}
test("mock landmarks exercise smoothing, dwell, classification and hand loss", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await page.waitForFunction(() => !!window.__HOLO_TEST__);
  await hold(page, hand());
  await expect(page.getByLabel("Gesture recognition status")).toContainText(
    "pointing",
  );
  await hold(page, hand("pinch"));
  await expect(page.getByLabel("Gesture recognition status")).toContainText(
    "pinch",
  );
  await hold(page, hand("open-palm"), 800);
  await expect(page.getByLabel("Gesture recognition status")).toContainText(
    "open palm",
  );
  await hold(page, [], 50);
  await expect(page.getByLabel("Gesture recognition status")).toContainText(
    "No hand",
  );
});
