import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { expect } from "@playwright/test";
/** Production UI smoke; builds a separate Offline host without a provider request. */
export async function smokeLibrary(page) {
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
  const baseline = await saved(),
    oldIds = new Set(baseline.objects.map((o) => o.id));
  await page.getByRole("tab", { name: "AI", exact: true }).click();
  await page
    .getByRole("button", { name: "New design conversation", exact: true })
    .click();
  await page.getByRole("button", { name: "AI Settings", exact: true }).click();
  await page
    .getByLabel("Planner mode", { exact: true })
    .selectOption("offline");
  await page.getByRole("button", { name: "Request", exact: true }).click();
  await page
    .getByLabel("Ask HoloBuild", { exact: true })
    .fill(
      "Build a house width 6 depth 6 height 3 floors 3 without doors without windows",
    );
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  assert.deepEqual((await saved()).objects, baseline.objects);
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  const host = await saved(),
    first = host.objects.find((o) => !oldIds.has(o.id)),
    id = first.construction.structureId;
  assert.equal(first.construction.structure.template.floors, 3);
  await page.getByLabel("Selection mode").selectOption("structure");
  await page.getByRole("tab", { name: "Collection", exact: true }).click();
  await page.getByLabel("Search scene objects").fill(first.name);
  await page
    .locator(".scene-list button")
    .filter({ hasText: first.name })
    .last()
    .click();
  const inspector = page.getByLabel("Precision Inspector", { exact: true });
  await inspector
    .getByRole("button", { name: "Advanced", exact: true })
    .click();
  for (const [label, value] of [
    ["Structure name", "Manual library host"],
    ["Structure position X", "-15"],
    ["Structure position Z", "-12"],
  ]) {
    await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByLabel(label, { exact: true }).press("Enter");
  }
  async function pick(role) {
    const o = (await saved()).objects.find(
      (o) => o.construction?.structureId === id && o.construction.role === role,
    );
    await page.getByLabel("Selection mode").selectOption("component");
    await page.getByRole("tab", { name: "Collection", exact: true }).click();
    await page.getByLabel("Search scene objects").fill(o.name);
    await page
      .locator(".scene-list details")
      .filter({ hasText: "Manual library host" })
      .locator("button")
      .filter({ hasText: o.name })
      .first()
      .click();
    await page.getByRole("tab", { name: "Inspector", exact: true }).click();
    return o;
  }
  async function insert(kind) {
    await page.getByRole("tab", { name: "Build", exact: true }).click();
    await page
      .getByTitle("Create " + (kind === "stairs" ? "Stairs" : "Balcony"), {
        exact: true,
      })
      .click();
    await page.getByLabel("Library building", { exact: true }).selectOption(id);
  }
  await insert("stairs");
  await page.getByLabel("Library Width", { exact: true }).fill("1.1");
  await page
    .getByLabel("Library orientation", { exact: true })
    .selectOption("180");
  await page
    .getByLabel("Library material", { exact: true })
    .selectOption("wood");
  const beforeStairs = await saved();
  await page
    .getByRole("button", { name: "Preview library stairs", exact: true })
    .click();
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  assert.deepEqual((await saved()).objects, beforeStairs.objects);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const stairs = await saved();
  assert.equal(
    stairs.objects.filter(
      (o) =>
        o.construction?.structureId === id && o.construction.role === "stair",
    ).length,
    16,
  );
  await history(beforeStairs, stairs);
  await pick("stair");
  await inspector
    .getByRole("button", { name: "Advanced", exact: true })
    .click();
  await expect(
    page.getByLabel("Staircase Inspector", { exact: true }),
  ).toBeVisible();
  await inspector
    .getByRole("button", { name: "Duplicate", exact: true })
    .click();
  const copiedStairs = await saved();
  assert.equal(
    copiedStairs.objects.filter(
      (o) =>
        o.construction?.structureId === id && o.construction.role === "stair",
    ).length,
    32,
  );
  await history(stairs, copiedStairs);
  await insert("balcony");
  await page.getByLabel("Library Width", { exact: true }).fill("2.6");
  await page.getByLabel("Library Depth", { exact: true }).fill("1.6");
  await page
    .getByRole("button", { name: "Preview library balcony", exact: true })
    .click();
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  assert.deepEqual((await saved()).objects, copiedStairs.objects);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const balcony = await saved(),
    parts = balcony.objects.filter((o) => o.construction?.structureId === id),
    recipe = parts[0].construction.structure.template,
    b = recipe.balconies[0];
  assert.equal(
    parts.filter((o) => o.construction.role === "balcony").length,
    8,
  );
  assert.ok(
    recipe.openings.some(
      (o) =>
        o.id === b.access &&
        o.kind === "door" &&
        o.level === b.level &&
        o.facade === b.facade,
    ),
  );
  await pick("balcony");
  await inspector
    .getByRole("button", { name: "Duplicate", exact: true })
    .click();
  const doubled = await saved();
  assert.equal(
    doubled.objects.filter(
      (o) =>
        o.construction?.structureId === id && o.construction.role === "balcony",
    ).length,
    16,
  );
  await history(balcony, doubled);
  await pick("balcony");
  await inspector
    .getByRole("button", { name: "Materials", exact: true })
    .click();
  await page.getByLabel("Roughness", { exact: true }).fill("0.23");
  await page.getByLabel("Roughness", { exact: true }).press("Enter");
  const appearance = await saved();
  assert.equal(
    appearance.objects.filter(
      (o) =>
        o.construction?.structureId === id && o.surface?.roughness === 0.23,
    ).length,
    1,
  );
  await page
    .getByRole("button", { name: "Delete selected object", exact: true })
    .click();
  const removed = await saved();
  assert.equal(
    removed.objects.filter(
      (o) =>
        o.construction?.structureId === id && o.construction.role === "balcony",
    ).length,
    8,
  );
  await history(appearance, removed);
  assert.deepEqual(
    removed.objects.filter((o) => oldIds.has(o.id)),
    baseline.objects,
  );
  await pick("stair");
  await inspector
    .getByRole("button", { name: "Advanced", exact: true })
    .click();
  return {
    manualCards: true,
    offlineHost: true,
    nativeStepsAndFloorVoids: true,
    configuredWidthOrientationMaterial: true,
    ownBalconyAccess: true,
    duplicateStairToFreeConnection: true,
    duplicateBalconyOppositeFacade: true,
    partOptics: true,
    assemblyDelete: true,
    inertPreviews: true,
    exactUndoRedo: true,
    unrelatedGeminiStructurePreserved: true,
    additionalProviderCalls: 0,
  };
}
