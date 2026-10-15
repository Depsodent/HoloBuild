import { hold } from "../helpers/gestureInput";
import { test, expect } from "../helpers/editorTest";
import { hand } from "../fixtures/landmarks";
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
