import { test, expect } from "@playwright/test";
import { hold, poseAt, target } from "../helpers/gestureInput";
test("two tracked IDs survive detection order changes and one-hand movement still works", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  await hold(page, poseAt("pointing", start.cursor));
  const pair = [
    poseAt("pointing", start.cursor),
    poseAt("pointing", { x: 0.8, y: 0.3 }),
  ];
  await page.evaluate(
    (pair) =>
      window.__HOLO_TEST__!.repeatHands(
        pair.map((landmarks) => ({ landmarks })),
      ),
    pair,
  );
  await page.clock.runFor(500);
  const first = await page.evaluate(() => window.__HOLO_TEST__!.hands());
  expect(first.hands).toHaveLength(2);
  await page.evaluate(
    (pair) =>
      window.__HOLO_TEST__!.repeatHands(
        [...pair].reverse().map((landmarks) => ({ landmarks })),
      ),
    pair,
  );
  await page.clock.runFor(300);
  const reversed = await page.evaluate(() => window.__HOLO_TEST__!.hands());
  expect(reversed.hands.map((h) => h.id)).toEqual(first.hands.map((h) => h.id));
  expect(reversed.hands[0].gesture.cursor!.x).toBeCloseTo(start.cursor.x, 2);
  await hold(page, poseAt("pointing", start.cursor));
  await hold(page, poseAt("pinch", start.cursor));
  await expect(page.locator(".gesture-cursor")).toHaveClass(/dragging/);
});

async function holdPair(
  page: import("@playwright/test").Page,
  distance: number,
  pinch: boolean,
  ms = 600,
) {
  const hands = [
    poseAt(pinch ? "pinch" : "pointing", { x: 0.5 - distance / 2, y: 0.35 }),
    poseAt(pinch ? "pinch" : "pointing", { x: 0.5 + distance / 2, y: 0.35 }),
  ];
  await page.evaluate(
    (hands) =>
      window.__HOLO_TEST__!.repeatHands(
        hands.map((landmarks) => ({ landmarks })),
      ),
    hands,
  );
  await page.clock.runFor(ms);
}
test("two-hand scale previews, commits once, and uses normal undo/redo", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  await page.getByLabel("Gesture mode", { exact: true }).selectOption("scale");
  await hold(page, [], 50);
  await holdPair(page, 0.25, false);
  await holdPair(page, 0.25, true);
  await expect(page.locator(".advanced-gestures")).toContainText("ACTIVE");
  await holdPair(page, 0.4, true, 1000);
  const preview = await page.evaluate(() => window.__HOLO_TEST__!.snapshot());
  expect(preview.history).toBe(0);
  expect(preview.preview?.scale![0]).toBeGreaterThan(1.4);
  await holdPair(page, 0.4, false);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(1);
  await hold(page, [], 50);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene()[0])).scale,
  ).toEqual(start.object.scale);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene()[0])).scale[0],
  ).toBeGreaterThan(1.4);
});
test("lost hand and Undo during two-hand scaling cancel safely", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  await page.getByRole("button", { name: "Cube 1 × 1 × 1 m" }).click();
  await page.getByLabel("Gesture mode", { exact: true }).selectOption("scale");
  await hold(page, [], 50);
  await holdPair(page, 0.25, false);
  await holdPair(page, 0.25, true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await holdPair(page, 0.3, true);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).preview,
  ).toBeNull();
  await page.locator(".scene-list button").click();
  await holdPair(page, 0.25, false);
  await holdPair(page, 0.25, true);
  await hold(page, poseAt("pinch", { x: 0.4, y: 0.35 }));
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).preview,
  ).toBeNull();
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(0);
});

test("explicit rotation mode changes yaw without scaling and commits once", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  await page.getByLabel("Gesture mode", { exact: true }).selectOption("rotate");
  await hold(page, [], 50);
  await holdPair(page, 0.3, false);
  await holdPair(page, 0.3, true);
  const hands = [
    poseAt("pinch", { x: 0.425, y: 0.22 }),
    poseAt("pinch", { x: 0.575, y: 0.48 }),
  ];
  await page.evaluate(
    (hands) =>
      window.__HOLO_TEST__!.repeatHands(
        hands.map((landmarks) => ({ landmarks })),
      ),
    hands,
  );
  await page.clock.runFor(1000);
  const during = await page.evaluate(() => window.__HOLO_TEST__!.snapshot());
  expect(during.preview?.rotation![1]).toBeGreaterThan(0.8);
  expect(during.preview?.scale).toEqual([1, 1, 1]);
  const open = [
    poseAt("pointing", { x: 0.425, y: 0.22 }),
    poseAt("pointing", { x: 0.575, y: 0.48 }),
  ];
  await page.evaluate(
    (hands) =>
      window.__HOLO_TEST__!.repeatHands(
        hands.map((landmarks) => ({ landmarks })),
      ),
    open,
  );
  await page.clock.runFor(600);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(1);
});

test("opt-in palm menu requires a hold, never reopens on held palm, and pinch confirms a tool", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  await page.getByLabel("Enable open-palm tool menu", { exact: true }).check();
  await hold(page, poseAt("open-palm", start.cursor), 200);
  await expect(page.getByLabel("Gesture tool menu")).toHaveCount(0);
  await hold(page, poseAt("pointing", start.cursor), 600);
  await hold(page, poseAt("open-palm", start.cursor), 2500);
  await expect(page.getByLabel("Gesture tool menu")).toBeVisible();
  await page.locator('[data-gesture-action="close"]').click();
  await hold(page, poseAt("open-palm", start.cursor), 5000);
  await expect(page.getByLabel("Gesture tool menu")).toHaveCount(0);
  await hold(page, poseAt("pointing", start.cursor), 1000);
  await hold(page, poseAt("open-palm", start.cursor), 2500);
  await expect(page.getByLabel("Gesture tool menu")).toBeVisible();
  const card = (await page
      .locator('[data-gesture-action="scale"]')
      .boundingBox())!,
    canvas = (await page.locator("canvas[data-engine]").boundingBox())!;
  const cursor = {
    x: (card.x + card.width / 2 - canvas.x) / canvas.width,
    y: (card.y + card.height / 2 - canvas.y) / canvas.height,
  };
  await hold(page, poseAt("pointing", cursor));
  await hold(page, poseAt("pinch", cursor));
  await expect(page.getByLabel("Gesture tool menu")).toHaveCount(0);
  await expect(page.getByLabel("Gesture mode", { exact: true })).toHaveValue(
    "scale",
  );
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(0);
});
test("pinch release into a held palm never invokes the opted-in menu", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  await page.getByLabel("Enable open-palm tool menu", { exact: true }).check();
  await hold(page, poseAt("pointing", start.cursor));
  await hold(page, poseAt("pinch", start.cursor));
  await hold(
    page,
    poseAt("pinch", { x: start.cursor.x + 0.1, y: start.cursor.y }),
  );
  await hold(
    page,
    poseAt("open-palm", { x: start.cursor.x + 0.1, y: start.cursor.y }),
    6000,
  );
  await expect(page.getByLabel("Gesture tool menu")).toHaveCount(0);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(1);
});

test("navigation pans the real camera without editing objects and loss restores the view", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  await page
    .getByLabel("Gesture mode", { exact: true })
    .selectOption("navigate");
  await hold(page, poseAt("pointing", { x: 0.5, y: 0.35 }));
  await hold(page, poseAt("pinch", { x: 0.5, y: 0.35 }));
  await hold(page, poseAt("pinch", { x: 0.62, y: 0.35 }), 1000);
  const moved = await target(page);
  expect(Math.abs(moved.cursor.x - start.cursor.x)).toBeGreaterThan(0.04);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene()[0])).position,
  ).toEqual(start.object.position);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(0);
  await hold(page, [], 50);
  const restored = await target(page);
  expect(restored.cursor.x).toBeCloseTo(start.cursor.x, 2);
  await hold(page, poseAt("pointing", { x: 0.5, y: 0.35 }));
  await hold(page, poseAt("pinch", { x: 0.5, y: 0.35 }));
  await hold(page, poseAt("pinch", { x: 0.6, y: 0.35 }));
  await hold(page, poseAt("pointing", { x: 0.6, y: 0.35 }));
  const confirmed = await target(page);
  expect(Math.abs(confirmed.cursor.x - start.cursor.x)).toBeGreaterThan(0.03);
  await hold(page, [], 50);
  const canvas = (await page.locator("canvas[data-engine]").boundingBox())!;
  await page.mouse.move(
    canvas.x + canvas.width * 0.75,
    canvas.y + canvas.height * 0.7,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvas.x + canvas.width * 0.85,
    canvas.y + canvas.height * 0.6,
    { steps: 5 },
  );
  await page.mouse.up();
  const mouse = await target(page);
  expect(
    Math.abs(mouse.cursor.x - confirmed.cursor.x) +
      Math.abs(mouse.cursor.y - confirmed.cursor.y),
  ).toBeGreaterThan(0.01);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(0);
});

test("two-hand visual guides and transform feedback remain visible with the camera minimized", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  await page.getByLabel("Gesture mode", { exact: true }).selectOption("scale");
  await page
    .getByRole("button", { name: "Minimize Gesture Input", exact: true })
    .click();
  await hold(page, [], 50);
  await holdPair(page, 0.25, false);
  await holdPair(page, 0.25, true);
  await holdPair(page, 0.35, true);
  await expect(page.getByLabel("Two-hand visual guide")).toBeVisible();
  await expect(page.getByLabel("Advanced gesture feedback")).toContainText(
    "2 tracked hands",
  );
  await expect(page.getByLabel("Advanced gesture feedback")).toContainText(
    "SCALE · ACTIVE",
  );
  await expect(page.getByLabel("Advanced gesture feedback")).toContainText(
    "scale",
  );
  await page.screenshot({ path: "test-results/two-hand-scale-feedback.png" });
});

test("opted-in palm menu stays closed during camera window dragging and after release", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  await page
    .getByRole("button", { name: "Undock Gesture Input", exact: true })
    .click();
  await page.getByLabel("Enable open-palm tool menu", { exact: true }).check();
  await hold(page, poseAt("open-palm", start.cursor), 600);
  const header = (await page
    .getByRole("button", { name: "Move Gesture Input window", exact: true })
    .boundingBox())!;
  await page.mouse.move(
    header.x + header.width / 2,
    header.y + header.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    header.x + header.width / 2 + 30,
    header.y + header.height / 2 - 20,
  );
  await page.clock.runFor(2500);
  await expect(page.getByLabel("Gesture tool menu")).toHaveCount(0);
  await page.mouse.up();
  await page.clock.runFor(2500);
  await expect(page.getByLabel("Gesture tool menu")).toHaveCount(0);
});
