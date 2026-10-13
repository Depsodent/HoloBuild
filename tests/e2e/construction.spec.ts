import { test, expect } from "@playwright/test";
import { hold, poseAt, target } from "../helpers/gestureInput";
test("open-palm menu creates a cube through point/pinch without mouse input", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  await hold(page, poseAt("open-palm", start.cursor), 850);
  await expect(page.getByLabel("Gesture tool menu")).toBeVisible();
  const card = (await page
    .locator("[data-gesture-action=create]")
    .boundingBox())!;
  const canvas = (await page.locator("canvas[data-engine]").boundingBox())!;
  const cursor = {
    x: (card.x + card.width / 2 - canvas.x) / canvas.width,
    y: (card.y + card.height / 2 - canvas.y) / canvas.height,
  };
  await hold(page, poseAt("pointing", cursor));
  await hold(page, poseAt("pinch", cursor));
  await expect(page.locator(".scene-list button")).toHaveCount(2);
  await expect(page.getByLabel("Gesture tool menu")).toHaveCount(0);
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.snapshot().history),
  ).toBe(1);
});
test("real raycasting, pinch preview, release, single-step undo/redo and mouse editing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?testInput");
  const start = await target(page);
  const end = { x: start.cursor.x + 0.14, y: start.cursor.y };
  await hold(page, poseAt("pointing", start.cursor));
  await expect(page.locator(".gesture-cursor")).toHaveClass(/targeting/);
  const cursor = await page.locator(".gesture-cursor").boundingBox();
  const viewport = await page.locator("canvas[data-engine]").boundingBox();
  expect(cursor && viewport).toBeTruthy();
  expect(
    Math.abs(
      cursor!.x +
        cursor!.width / 2 -
        (viewport!.x + viewport!.width * start.cursor.x),
    ),
  ).toBeLessThan(3);
  await hold(page, poseAt("pinch", start.cursor));
  await expect(page.locator(".gesture-cursor")).toHaveClass(/dragging/);
  await hold(page, poseAt("pinch", end));
  const during = await page.evaluate(() => ({
    state: window.__HOLO_TEST__!.snapshot(),
    object: window.__HOLO_TEST__!.scene()[0],
  }));
  expect(during.state.history).toBe(0);
  expect(during.object.position).toEqual(start.object.position);
  expect(during.state.preview?.valid).toBe(true);
  expect(during.state.preview?.position).not.toEqual(start.object.position);
  await page.screenshot({ path: "test-results/gesture-drag-preview.png" });
  await hold(page, poseAt("pointing", end));
  const placed = await page.evaluate(() => ({
    state: window.__HOLO_TEST__!.snapshot(),
    object: window.__HOLO_TEST__!.scene()[0],
  }));
  expect(placed.state.preview).toBeNull();
  expect(placed.state.history).toBe(1);
  expect(placed.object.position).not.toEqual(start.object.position);
  expect(placed.object.position[1]).toBe(start.object.position[1]);
  expect(Number.isInteger(placed.object.position[0] * 2)).toBe(true);
  expect(Number.isInteger(placed.object.position[2] * 2)).toBe(true);
  await hold(page, [], 50);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.scene()[0].position),
  ).toEqual(start.object.position);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.scene()[0].position),
  ).toEqual(placed.object.position);
  await page.locator(".scene-list button").first().click();
  await page.getByLabel("position X", { exact: true }).fill("3");
  await expect(page.getByLabel("position X", { exact: true })).toHaveValue("3");
  expect(errors).toEqual([]);
});
test("missing landmarks and stalled input cancel a grab without history", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  const end = { x: start.cursor.x + 0.12, y: start.cursor.y };
  for (const loss of ["missing", "stalled"]) {
    await hold(page, poseAt("pointing", start.cursor));
    await hold(page, poseAt("pinch", start.cursor));
    await hold(page, poseAt("pinch", end));
    await expect(page.locator(".gesture-cursor")).toHaveClass(/dragging/);
    if (loss === "missing") await hold(page, [], 50);
    else {
      await page.evaluate(() => window.__HOLO_TEST__!.pause());
      await page.clock.runFor(350);
    }
    await expect
      .poll(() => page.evaluate(() => window.__HOLO_TEST__!.snapshot().preview))
      .toBeNull();
    expect(
      await page.evaluate(() => window.__HOLO_TEST__!.snapshot().history),
    ).toBe(0);
    expect(
      await page.evaluate(() => window.__HOLO_TEST__!.scene()[0].position),
    ).toEqual(start.object.position);
  }
});
test("overlapping placement is rejected and the preview is cleared on release", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  const objects = await page.evaluate(() => {
    const a = window.__HOLO_TEST__!.scene()[0];
    return [
      a,
      { ...a, id: "obstacle", name: "Obstacle", position: [2, 0.5, 0] },
    ];
  });
  await page.locator("input[type=file]").setInputFiles({
    name: "collision.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 1, objects })),
  });
  const start = await target(page),
    end = await target(page, 1);
  await hold(page, poseAt("pointing", start.cursor));
  await expect(page.locator(".gesture-cursor")).toHaveClass(/targeting/);
  await hold(page, poseAt("pinch", start.cursor));
  await expect(page.locator(".gesture-cursor")).toHaveClass(/dragging/);
  await hold(page, poseAt("pinch", end.cursor));
  await expect(page.locator(".gesture-cursor")).toHaveClass(/invalid/);
  await hold(page, poseAt("pointing", end.cursor));
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.scene()[0].position),
  ).toEqual(start.object.position);
  expect(await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).toEqual({
    history: 1,
    redo: 0,
    preview: null,
  });
});
test("undo during a grab cancels the transaction instead of resurrecting its preview", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  await page.getByRole("button", { name: "Cube 1 × 1 × 1 m" }).click();
  const start = await target(page, 1);
  await hold(page, poseAt("pointing", start.cursor));
  await hold(page, poseAt("pinch", start.cursor));
  await expect(page.locator(".gesture-cursor")).toHaveClass(/dragging/);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await hold(
    page,
    poseAt("pinch", { x: start.cursor.x + 0.1, y: start.cursor.y }),
  );
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    1,
  );
  expect(await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).toEqual({
    history: 0,
    redo: 1,
    preview: null,
  });
});
