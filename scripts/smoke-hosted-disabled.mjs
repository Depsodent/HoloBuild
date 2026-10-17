// Public frontend acceptance smoke while Gemini generation remains disabled.
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.HOLO_PUBLIC_URL || "https://holobuild.vercel.app";
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", () => errors.push("pageerror"));
async function tab(name) {
  await page.getByRole("tab", { name, exact: true }).click();
}
async function saved() {
  const next = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  return JSON.parse(await fs.readFile(await (await next).path(), "utf8"));
}
async function ask(text) {
  await tab("AI");
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
}
try {
  await page.goto(base);
  await expect(page.locator("canvas[data-engine]")).toBeVisible();
  await tab("Build");
  const shapes = page.locator(".shape-palette button");
  await expect(shapes).toHaveCount(6);
  for (let i = 0; i < 6; i++) await shapes.nth(i).click();
  const created = await saved();
  assert.equal(created.objects.length, 7);
  assert.equal(new Set(created.objects.map((o) => o.type)).size, 6);
  await tab("Inspector");
  const transform = page.locator('[data-accordion-key="inspector.transform"]');
  if ((await transform.getAttribute("open")) === null)
    await transform.locator(":scope > summary").click();
  await page.getByLabel("position X", { exact: true }).fill("20");
  await page.getByLabel("position X", { exact: true }).press("Tab");
  const moved = await saved();
  assert.notDeepEqual(moved.objects, created.objects);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual((await saved()).objects, created.objects);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  assert.deepEqual((await saved()).objects, moved.objects);
  await ask("Build a house without doors");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  assert.deepEqual((await saved()).objects, moved.objects);
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  const built = await saved();
  assert.ok(built.objects.length > moved.objects.length);
  await page
    .getByLabel("Selection mode", { exact: true })
    .selectOption("structure");
  await tab("Collection");
  await page.locator(".scene-list details button").nth(1).click();
  await expect(
    page.getByLabel("Structure Inspector", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Selection mode", { exact: true })
    .selectOption("component");
  await tab("Collection");
  await page.locator(".scene-list details button").nth(1).click();
  await expect(
    page.getByLabel("Structure Inspector", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("position X", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual((await saved()).objects, moved.objects);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  assert.deepEqual((await saved()).objects, built.objects);
  await tab("AI");
  await page.getByLabel("Planner mode", { exact: true }).selectOption("auto");
  await ask("Build a small house without doors");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Planner source", { exact: true }),
  ).toContainText("Offline fallback");
  assert.deepEqual((await saved()).objects, built.objects);
  await page
    .getByRole("button", { name: "Cancel generation", exact: true })
    .click();
  assert.deepEqual((await saved()).objects, built.objects);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page
    .locator("input[type=file][accept='.json']")
    .setInputFiles({
      name: "public-smoke.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(built)),
    });
  await expect(page.locator(".status")).not.toContainText("Loading");
  assert.deepEqual((await saved()).objects, built.objects);
  await tab("Gesture");
  await expect(
    page.getByRole("button", { name: "Start camera", exact: true }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  const report = {
    checkedAt: new Date().toISOString(),
    url: base,
    anonymousPublicBrowser: true,
    sixShapes: true,
    mouseTransform: true,
    exactUndoRedo: true,
    partStructureCollectionSelection: true,
    offlineInertPreviewConfirmation: true,
    realDisabledBackendAutoFallback: true,
    cancelPreservesScene: true,
    portableSaveLoad: true,
    cameraStartAccessible: true,
    pageErrors: 0,
    physicalWebcamMicrophoneTested: false,
  };
  await fs.writeFile(
    "docs/HOSTED_UI_VALIDATION.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(
    "Hosted UI smoke failed: " + String(error.message).slice(0, 600),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
