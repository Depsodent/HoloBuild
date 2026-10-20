import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { expect } from "@playwright/test";
/** UI-only extension: real production controls, no development bridge or extra provider calls. */
export async function smokePrecision(page) {
  async function saved() {
    const next = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Save project", exact: true })
      .click();
    return JSON.parse(await fs.readFile(await (await next).path(), "utf8"));
  }
  async function history(before, after) {
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    assert.deepEqual((await saved()).objects, before.objects);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    assert.deepEqual((await saved()).objects, after.objects);
  }
  const root = page.getByLabel("Precision Inspector", { exact: true });
  const baseline = await saved(),
    cube = baseline.objects.find((o) => !o.construction && o.type === "cube");
  assert.ok(cube, "Expected preserved starter cube");
  async function select() {
    await page.getByLabel("Selection mode").selectOption("component");
    await page.getByRole("tab", { name: "Collection", exact: true }).click();
    await page.getByLabel("Search scene objects").fill(cube.name);
    await page
      .locator(".scene-list button")
      .filter({ hasText: cube.name })
      .first()
      .click();
    await page.getByRole("tab", { name: "Inspector", exact: true }).click();
  }
  async function tab(name) {
    await root.getByRole("button", { name, exact: true }).click();
  }
  async function number(label, value) {
    await root.getByLabel(label, { exact: true }).fill(String(value));
    await root.getByLabel(label, { exact: true }).press("Enter");
  }
  await select();
  for (const name of ["Materials", "AI Edit", "Advanced"])
    await expect(root.getByRole("button", { name, exact: true })).toBeVisible();
  await tab("Materials");
  await number("Roughness", 0.17);
  await number("Metalness", 0.83);
  const beforeOpacity = await saved();
  await number("Opacity", 0.65);
  const material = await saved(),
    c = material.objects.find((o) => o.id === cube.id);
  assert.deepEqual(c.surface, {
    roughness: 0.17,
    metalness: 0.83,
    opacity: 0.65,
  });
  assert.deepEqual(
    material.objects.filter((o) => o.id !== cube.id),
    baseline.objects.filter((o) => o.id !== cube.id),
  );
  await history(beforeOpacity, material);
  await select();
  await tab("Advanced");
  await number("Selection width (m)", 2);
  const sized = await saved();
  assert.equal(sized.objects.find((o) => o.id === cube.id).scale[0], 2);
  await history(material, sized);
  await select();
  await tab("Advanced");
  await root.getByLabel("Grid increment", { exact: true }).selectOption("0.1");
  await root.getByLabel("Show measurements", { exact: true }).check();
  await expect(
    page.getByLabel("Selection measurements", { exact: true }),
  ).toContainText("2.00");
  await tab("AI Edit");
  const prompt = "Move this object 20 centimeters to the left";
  await root.getByLabel("AI edit selected", { exact: true }).fill(prompt);
  await tab("Materials");
  await tab("AI Edit");
  await expect(
    root.getByLabel("AI edit selected", { exact: true }),
  ).toHaveValue(prompt);
  await root.getByRole("button", { name: "Preview edit", exact: true }).click();
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  assert.deepEqual((await saved()).objects, sized.objects);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const moved = await saved();
  assert.ok(
    Math.abs(
      moved.objects.find((o) => o.id === cube.id).position[0] -
        (c.position[0] - 0.2),
    ) < 1e-7,
  );
  assert.deepEqual(
    moved.objects.filter((o) => o.id !== cube.id),
    baseline.objects.filter((o) => o.id !== cube.id),
  );
  await history(sized, moved);
  await page.getByRole("tab", { name: "Build", exact: true }).click();
  await page.getByTitle("Create Cube", { exact: true }).click();
  const extra = await saved();
  await page
    .locator("input[type=file][accept='.json']")
    .setInputFiles({
      name: "precision-production.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(moved)),
    });
  await expect(page.locator("footer .status")).toContainText(
    "Replace complete.",
  );
  assert.deepEqual((await saved()).objects, moved.objects);
  await history(extra, moved);
  return {
    productionUI: true,
    developmentBridgeUsed: false,
    inspectorTabs: true,
    roughnessMetalnessOpacity: true,
    partScopePreservesArchitecture: true,
    numericDimensions: true,
    centimetrePreview: true,
    draftAcrossTabs: true,
    gridControls: true,
    measurements: true,
    exactUndoRedo: true,
    portableSurfaceAndTransformPersistence: true,
    physicalDeviceTested: false,
  };
}
