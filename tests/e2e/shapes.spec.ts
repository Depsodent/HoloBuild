import { test, expect } from "@playwright/test";
import { hold, poseAt, target } from "../helpers/gestureInput";
const kinds = ["cube", "sphere", "cylinder", "cone", "wall", "floor"] as const;
for (const kind of kinds) {
  test(`${kind}: real mesh picking, gesture move, one undo and mouse inspector`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/?testInput");
    await target(page);
    const base = await page.evaluate(() => window.__HOLO_TEST__!.scene()[0]);
    const position = [0, kind === "wall" ? 1 : kind === "floor" ? 0.1 : 0.5, 0];
    await page.locator("input[type=file][accept='.json']").setInputFiles({
      name: "shape.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          version: 1,
          objects: [{ ...base, type: kind, name: kind, position }],
        }),
      ),
    });
    const start = await target(page);
    const canvas = (await page.locator("canvas[data-engine]").boundingBox())!;
    await page.mouse.click(
      canvas.x + canvas.width * start.cursor.x,
      canvas.y + canvas.height * start.cursor.y,
    );
    await expect(
      page.getByRole("heading", { name: kind, exact: true }),
    ).toBeVisible();
    await hold(page, poseAt("pointing", start.cursor));
    await expect(page.locator(".gesture-cursor")).toHaveClass(/targeting/);
    await hold(page, poseAt("pinch", start.cursor));
    await expect(page.locator(".gesture-cursor")).toHaveClass(/dragging/);
    const end = { x: start.cursor.x + 0.12, y: start.cursor.y };
    await hold(page, poseAt("pinch", end));
    await hold(page, poseAt("pointing", end));
    expect(
      (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
    ).toBe(2);
    expect(
      await page.evaluate(() => window.__HOLO_TEST__!.scene()[0].position),
    ).not.toEqual(position);
    await hold(page, [], 50);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect(
      await page.evaluate(() => window.__HOLO_TEST__!.scene()[0].position),
    ).toEqual(position);
    await page.locator(".scene-list button").click();
    await page.getByLabel("position Y", { exact: true }).fill("4");
    await page.getByLabel("rotation Y", { exact: true }).fill("45");
    await page.getByLabel("scale X", { exact: true }).fill("1.5");
    await page.getByLabel("Material", { exact: true }).selectOption("glass");
    await page.getByLabel("Object color", { exact: true }).fill("#ff8844");
    const result = await page.evaluate(() => window.__HOLO_TEST__!.scene()[0]);
    expect(result.scale[0]).toBe(1.5);
    expect(result.rotation[1]).toBeCloseTo(Math.PI / 4);
    expect(result.material).toBe("glass");
    expect(result.color).toBe("#ff8844");
    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
    await expect(page.locator(".scene-list button")).toHaveCount(2);
    await page
      .getByRole("button", { name: "Delete selected object", exact: true })
      .click();
    await expect(page.locator(".scene-list button")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}
test("palette creates every shape and JSON restores the mixed collection", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  for (const kind of kinds.slice(1))
    await page
      .getByTitle(`Create ${kind[0].toUpperCase() + kind.slice(1)}`, {
        exact: true,
      })
      .click();
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene())).map(
      (o) => o.type,
    ),
  ).toEqual(kinds);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project" }).click();
  await download;
  const saved = await page.evaluate(() =>
    localStorage.getItem("holobuild.scene")!,
  );
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Reset scene", exact: true }).click();
  await page.locator("input[type=file][accept='.json']").setInputFiles({
    name: "mixed.json",
    mimeType: "application/json",
    buffer: Buffer.from(saved),
  });
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene())).map(
      (o) => o.type,
    ),
  ).toEqual(kinds);
  await page.screenshot({ path: "test-results/milestone-5-shapes.png" });
});

test("mouse placement validation rejects overlap, supports snapping and keyboard history", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  const base = await page.evaluate(() => window.__HOLO_TEST__!.scene()[0]);
  await page.locator("input[type=file][accept='.json']").setInputFiles({
    name: "validation.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        objects: [
          {
            ...base,
            id: "wall",
            type: "wall",
            name: "Wall",
            position: [0, 1, 0],
          },
          {
            ...base,
            id: "sphere",
            type: "sphere",
            name: "Sphere",
            position: [4, 0.5, 0],
          },
        ],
      }),
    ),
  });
  await page.locator(".scene-list button").last().click();
  await page.getByLabel("position X", { exact: true }).fill("0");
  await expect(page.locator("footer .status")).toContainText("Action rejected");
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene()[1])).position[0],
  ).toBe(4);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(1);
  await page.getByLabel("position X", { exact: true }).fill("3.26");
  await expect(page.getByLabel("position X", { exact: true })).toHaveValue(
    "3.5",
  );
  await page.getByLabel(/Snap to grid/).uncheck();
  await page.getByLabel("position X", { exact: true }).fill("3.26");
  await expect(page.getByLabel("position X", { exact: true })).toHaveValue(
    "3.26",
  );
  await page.locator(".scene-list button").last().click();
  for (const [key, mode] of [
    ["r", "ROTATE"],
    ["s", "SCALE"],
    ["g", "TRANSLATE"],
    ["v", "SELECT"],
  ]) {
    await page.keyboard.press(key);
    await expect(page.locator("footer")).toContainText(mode);
  }
  await page.keyboard.press("Delete");
  await expect(page.locator(".scene-list button")).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(page.locator(".scene-list button")).toHaveCount(2);
  await page.keyboard.press("Control+Shift+z");
  await expect(page.locator(".scene-list button")).toHaveCount(1);
});
