import { showLeft } from "../helpers/workspaceTools";
import { test, expect } from "../helpers/editorTest";
import { target, hold, poseAt } from "../helpers/gestureInput";

test("floating camera drag/resize/keyboard/persistence do not orbit or edit the scene", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  await showLeft(page, "gesture");
  await page
    .getByRole("button", { name: "Undock Gesture Input", exact: true })
    .click();
  const panel = page.getByLabel("Gesture camera");
  const header = page.getByRole("button", {
    name: "Move Gesture Input window",
    exact: true,
  });
  const initial = (await panel.boundingBox())!;
  const h = (await header.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 80, h.y + h.height / 2 - 80, {
    steps: 5,
  });
  await page.mouse.up();
  const moved = (await panel.boundingBox())!;
  expect(moved.x - initial.x).toBeCloseTo(80, 0);
  expect(initial.y - moved.y).toBeCloseTo(80, 0);
  const resize = (await page
    .getByRole("button", { name: "Resize Gesture Input window", exact: true })
    .boundingBox())!;
  await page.mouse.move(
    resize.x + resize.width / 2,
    resize.y + resize.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    resize.x + resize.width / 2 + 60,
    resize.y + resize.height / 2 + 25,
    { steps: 5 },
  );
  await page.mouse.up();
  let resized = (await panel.boundingBox())!;
  expect(resized.width).toBeGreaterThan(moved.width);
  await page
    .getByRole("button", { name: "Resize Gesture Input window", exact: true })
    .focus();
  await page.keyboard.press("ArrowDown");
  expect((await panel.boundingBox())!.height - resized.height).toBeCloseTo(
    10,
    0,
  );
  resized = (await panel.boundingBox())!;
  await header.focus();
  await page.keyboard.press("ArrowRight");
  const keyboard = (await panel.boundingBox())!;
  expect(keyboard.x - resized.x).toBeCloseTo(10, 0);
  const after = await target(page);
  expect(after.cursor.x).toBeCloseTo(start.cursor.x, 5);
  expect(after.cursor.y).toBeCloseTo(start.cursor.y, 5);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(0);
  await showLeft(page, "gesture");
  await page
    .getByRole("button", { name: "Minimize Gesture Input", exact: true })
    .click();
  expect((await panel.boundingBox())!.height).toBe(54);
  await expect(panel).toContainText("No hand");
  await expect(
    page.getByRole("button", { name: "Start camera", exact: true }),
  ).toBeVisible();
  await page.reload();
  await target(page);
  await expect(
    page.getByRole("button", { name: "Expand Gesture Input", exact: true }),
  ).toBeVisible();
  expect((await panel.boundingBox())!.x).toBeCloseTo(keyboard.x, 0);
  await showLeft(page, "gesture");
  await page
    .getByRole("button", { name: "Expand Gesture Input", exact: true })
    .click();
  expect((await panel.boundingBox())!.width).toBeCloseTo(resized.width, 0);
  await page
    .getByRole("button", {
      name: "Maximize or restore Gesture Input",
      exact: true,
    })
    .click();
  expect((await panel.boundingBox())!.width).toBeGreaterThan(resized.width);
  await page
    .getByRole("button", {
      name: "Maximize or restore Gesture Input",
      exact: true,
    })
    .click();
  expect((await panel.boundingBox())!.width).toBeCloseTo(resized.width, 0);
  await page.setViewportSize({ width: 950, height: 720 });
  const workspace = (await page.locator(".workspace").boundingBox())!,
    small = (await panel.boundingBox())!;
  expect(small.x).toBeGreaterThanOrEqual(workspace.x);
  expect(small.x + small.width).toBeLessThanOrEqual(
    workspace.x + workspace.width + 1,
  );
  expect(small.y + small.height).toBeLessThanOrEqual(
    workspace.y + workspace.height + 1,
  );
  await page
    .getByRole("button", { name: "Reset Gesture Input layout", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start camera", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/floating-camera.png" });
});

test("minimized window shows gestures while construction still commits one move", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  await showLeft(page, "gesture");
  await page
    .getByRole("button", { name: "Minimize Gesture Input", exact: true })
    .click();
  await hold(page, poseAt("pointing", start.cursor));
  await expect(page.locator(".camera-title")).toContainText("pointing");
  await hold(page, poseAt("pinch", start.cursor));
  await expect(page.locator(".gesture-cursor")).toHaveClass(/dragging/);
  const end = { x: start.cursor.x + 0.12, y: start.cursor.y };
  await hold(page, poseAt("pinch", end));
  await hold(page, poseAt("pointing", end));
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(1);
  await expect(page.getByLabel("Gesture tool menu")).toHaveCount(0);
});

for (const type of ["cube", "sphere", "cylinder", "cone", "wall", "floor"]) {
  test(`${type}: material appearance changes, history and persistence preserve color`, async ({
    page,
  }) => {
    await page.goto("/?testInput");
    await target(page);
    const base = await page.evaluate(() => window.__HOLO_TEST__!.scene()[0]);
    await page.locator("input[type=file][accept='.json']").setInputFiles({
      name: "material.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          version: 1,
          objects: [
            {
              ...base,
              type,
              color: "#39dcca",
              position: [
                0,
                type === "wall" ? 1 : type === "floor" ? 0.1 : 0.5,
                0,
              ],
            },
          ],
        }),
      ),
    });
    await showLeft(page, "collection");
    await page.locator(".scene-list button").click();
    const beforeMaterial = (
      await page.evaluate(() => window.__HOLO_TEST__!.snapshot())
    ).history;
    const canvas = page.locator("canvas[data-engine]");
    const solid = await canvas.screenshot({
      path: `test-results/${type}-solid.png`,
    });
    await page.getByLabel("Material", { exact: true }).selectOption("glass");
    await expect(page.getByLabel("Material", { exact: true })).toHaveValue(
      "glass",
    );
    // Wait for a rendered material frame, independent of CPU rendering speed.
    await page.waitForFunction(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve(true)),
          ),
        ),
    );
    const glass = await canvas.screenshot({
      path: `test-results/${type}-glass.png`,
    });
    expect(glass.equals(solid)).toBe(false);
    expect(
      (await page.evaluate(() => window.__HOLO_TEST__!.scene()[0])).color,
    ).toBe("#39dcca");
    expect(
      (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
    ).toBe(beforeMaterial + 1);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect(
      (await page.evaluate(() => window.__HOLO_TEST__!.scene()[0])).material,
    ).toBe("solid");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save project" }).click();
    await download;
    const saved = await page.evaluate(() =>
      localStorage.getItem("holobuild.scene")!,
    );
    await page.locator("input[type=file][accept='.json']").setInputFiles({
      name: "saved.json",
      mimeType: "application/json",
      buffer: Buffer.from(saved),
    });
    const restored = await page.evaluate(
      () => window.__HOLO_TEST__!.scene()[0],
    );
    expect(restored.material).toBe("glass");
    expect(restored.color).toBe("#39dcca");
  });
}

test("dragging the camera window cancels an active preview without placing the object", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  await showLeft(page, "gesture");
  await page
    .getByRole("button", { name: "Undock Gesture Input", exact: true })
    .click();
  await hold(page, poseAt("pointing", start.cursor));
  await hold(page, poseAt("pinch", start.cursor));
  await hold(
    page,
    poseAt("pinch", { x: start.cursor.x + 0.1, y: start.cursor.y }),
  );
  await expect(page.locator(".gesture-cursor")).toHaveClass(/dragging/);
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
  await page.mouse.up();
  await hold(page, poseAt("pinch", start.cursor));
  expect(await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).toEqual({
    history: 0,
    redo: 0,
    preview: null,
  });
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene()[0])).position,
  ).toEqual(start.object.position);
});
