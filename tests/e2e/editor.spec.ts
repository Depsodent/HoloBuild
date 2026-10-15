import { test, expect } from "@playwright/test";
test("invalid imports preserve the scene and show recovery advice", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("input[type=file][accept='.json']").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":1,"objects":[{}]}'),
  });
  await expect(page.locator(".status")).toContainText("Invalid scene file");
  await expect(page.locator(".scene-list button")).toHaveCount(1);
});
test("transform modes and orbit preserve a healthy WebGL viewport", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Move G", exact: true }).click();
  await expect(page.locator("footer")).toContainText("TRANSLATE");
  await page.getByRole("button", { name: "Rotate R", exact: true }).click();
  await page.getByRole("button", { name: "Scale S", exact: true }).click();
  await page.getByRole("button", { name: "Select V", exact: true }).click();
  const canvas = page.locator("canvas[data-engine]");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw Error("Missing canvas");
  await page.mouse.move(
    bounds.x + bounds.width * 0.65,
    bounds.y + bounds.height * 0.65,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.8,
    bounds.y + bounds.height * 0.5,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => page.locator("footer").innerText())
    .not.toContain("0 FPS");
  await page.screenshot({ path: "test-results/milestone-1.png" });
});
test("workspace renders and mouse editor commands persist through undo and import", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/HOLOBUILD/);
  await expect(page.locator("canvas[data-engine]")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cube", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cube 1 × 1 × 1 m" }).click();
  await expect(page.locator(".scene-list button")).toHaveCount(2);
  await page.getByLabel("position X", { exact: true }).fill("4");
  await page.getByLabel("position X", { exact: true }).press("Tab");
  await expect(page.getByLabel("position X", { exact: true })).toHaveValue("4");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.locator(".scene-list button").last().click();
  await expect(page.getByLabel("position X", { exact: true })).toHaveValue(
    "1.5",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project" }).click();
  expect((await download).suggestedFilename()).toBe("holobuild-scene.json");
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Reset scene", exact: true }).click();
  await expect(page.locator(".scene-list button")).toHaveCount(0);
  const saved = await page.evaluate(() =>
    localStorage.getItem("holobuild.scene")!,
  );
  await page.locator("input[type=file][accept='.json']").setInputFiles({
    name: "scene.json",
    mimeType: "application/json",
    buffer: Buffer.from(saved),
  });
  await expect(page.locator(".scene-list button")).toHaveCount(2);
  expect(errors).toEqual([]);
});
