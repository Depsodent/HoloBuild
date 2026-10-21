/* global document */
import fs from "node:fs/promises";
import { PerspectiveCamera, Vector3 } from "three";
import { FURNITURE } from "../shared/furnitureCatalog.mjs";
import assert from "node:assert/strict";
import { expect } from "@playwright/test";
export async function smokeFurniture131(page, modelAsk) {
  async function saved() {
    const d = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Save project", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    return JSON.parse(await fs.readFile(await (await d).path(), "utf8"));
  }
  async function history(before, after) {
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    assert.deepEqual((await saved()).objects, before.objects);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    assert.deepEqual((await saved()).objects, after.objects);
  }
  async function load(data) {
    await page.locator('input[type=file][accept=".json"]').setInputFiles({
      name: "release-furnishing.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
    await expect(page.locator("footer .status")).toContainText(
      "Replace complete.",
    );
    assert.deepEqual((await saved()).objects, data.objects);
  }
  async function ai() {
    await page.getByRole("tab", { name: "AI", exact: true }).click();
  }
  async function pick(name) {
    await page.getByRole("tab", { name: "Collection", exact: true }).click();
    await page.getByLabel("Search scene objects").fill(name);
    await page
      .locator(".scene-list button")
      .filter({ hasText: name })
      .first()
      .click();
    await page.getByRole("tab", { name: "Inspector", exact: true }).click();
  }
  const original = await saved();
  let tinted = original;
  if (modelAsk) {
    await ai();
    let plan = await modelAsk(
      "Could you arrange a native two-seat sofa with its base at 18,0,18",
    );
    assert.equal(plan.kind, "furnish");
    assert.equal(plan.preset, "sofa-two");
    await expect(
      page.getByLabel("Structure modification preview", { exact: true }),
    ).toBeVisible();
    assert.deepEqual((await saved()).objects, original.objects);
    await page
      .getByRole("button", { name: "Confirm structure edit", exact: true })
      .click();
    const created = await saved(),
      sofa = created.objects.find(
        (o) => !original.objects.some((p) => p.id === o.id),
      );
    assert.equal(sofa?.furniture?.preset, "sofa-two");
    assert.equal(created.objects.length, original.objects.length + 1);
    assert.deepEqual(
      created.objects.filter((o) => o.id !== sofa.id),
      original.objects,
    );
    await history(original, created);
    await pick(sofa.name);
    await ai();
    plan = await modelAsk(
      "I'd appreciate the currently selected furniture in a cool blue finish",
    );
    assert.equal(plan.kind, "edit");
    assert.equal(plan.scope, "component");
    assert.equal(plan.target, sofa.id);
    assert.deepEqual((await saved()).objects, created.objects);
    await page
      .getByRole("button", { name: "Confirm structure edit", exact: true })
      .click();
    tinted = await saved();
    assert.notEqual(
      tinted.objects.find((o) => o.id === sofa.id).color,
      sofa.color,
    );
    assert.deepEqual(
      tinted.objects.filter((o) => o.id !== sofa.id),
      original.objects,
    );
    await history(created, tinted);
    await pick(sofa.name);
    await ai();
    await page
      .getByLabel("Ask HoloBuild", { exact: true })
      .fill("Make this sofa wooden");
    await page
      .getByRole("button", { name: "Send request", exact: true })
      .click();
    await expect(
      page.getByLabel("Structure modification preview", { exact: true }),
    ).toBeVisible();
    assert.deepEqual((await saved()).objects, tinted.objects);
    await page
      .getByRole("button", { name: "Cancel structure edit", exact: true })
      .click();
    assert.deepEqual((await saved()).objects, tinted.objects);
  }
  // Place inside the actual generated house through its open native entry, not a development fixture.
  const host = tinted.objects.find(
    (o) =>
      (
        o.construction?.structure?.template ??
        o.construction?.structure?.architectureTemplate
      )?.floors === 2,
  );
  assert.ok(host, "Actual generated two-floor host required");
  const meta = host.construction.structure,
    door = tinted.objects.find(
      (o) =>
        o.construction?.structureId === host.construction.structureId &&
        o.construction.role === "door" &&
        o.construction.level === 0,
    );
  assert.equal(
    door.construction.facade,
    "front",
    "Release recipe expects centered front entry",
  );
  assert.ok(
    Math.abs(meta.yaw) < 1e-6 &&
      meta.scale.every((v) => Math.abs(v - 1) < 1e-6),
  );
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  const readFeet = async () => {
    const text = await page
        .getByLabel("Walking position", { exact: true })
        .textContent(),
      m = text.match(/X (-?[\d.]+).*feet (-?[\d.]+) m.* Z (-?[\d.]+)/);
    assert.ok(m);
    return m.slice(1).map(Number);
  };
  const entry = await readFeet();
  await page.getByRole("button", { name: "Furnish", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search furniture", exact: true })
    .fill("Single bed");
  await page.getByRole("button", { name: /^Single bed/ }).click();
  const box = await page.locator("canvas[data-engine]").boundingBox(),
    camera = new PerspectiveCamera(65, box.width / box.height, 0.05, 1000);
  camera.position.set(entry[0], entry[1] + 1.6, entry[2]);
  camera.updateMatrixWorld();
  const target = new Vector3(
    meta.position[0] + 1.5,
    meta.position[1] + 0.2,
    meta.position[2] - 1.4,
  ).project(camera);
  assert.ok(Math.abs(target.x) < 0.99 && Math.abs(target.y) < 0.99);
  await page.mouse.move(
    box.x + ((target.x + 1) * box.width) / 2,
    box.y + ((1 - target.y) * box.height) / 2,
  );
  await expect(
    page.getByRole("button", { name: "Place furniture", exact: true }),
  ).toBeEnabled({ timeout: 15000 });
  assert.deepEqual((await saved()).objects, tinted.objects);
  await page
    .getByRole("button", { name: "Place furniture", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  const interior = await saved(),
    bed = interior.objects.find(
      (o) => !tinted.objects.some((p) => p.id === o.id),
    );
  assert.equal(bed?.furniture?.preset, "bed-single");
  assert.deepEqual(
    interior.objects.filter((o) => o.id !== bed.id),
    tinted.objects,
  );
  assert.ok(
    Math.abs(
      bed.position[1] -
        (FURNITURE[bed.furniture.preset].size[1] * bed.scale[1]) / 2 -
        (meta.position[1] + 0.2),
    ) < 1e-5,
  );
  await page
    .getByRole("button", { name: "Done furnishing", exact: true })
    .click();
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  await page
    .getByRole("button", { name: "Use keyboard / touch", exact: true })
    .click();
  await page.keyboard.down("w");
  try {
    await expect
      .poll(async () => (await readFeet())[2], { timeout: 15000 })
      .toBeLessThan(meta.position[2] + 2);
  } finally {
    await page.keyboard.up("w");
  }
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Close controls", exact: true })
    .click();
  await page.screenshot({
    path:
      ".cache/m131-" +
      (new URL(page.url()).protocol === "https:" ? "public" : "local") +
      "-native-furnish.png",
  });
  await page
    .getByRole("button", { name: "Exit Walkthrough", exact: true })
    .click();
  await history(tinted, interior);
  await load({ ...interior, objects: [] });
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  await expect(
    page
      .getByRole("toolbar", { name: "Walkthrough controls" })
      .getByRole("button"),
  ).toHaveText([
    "Look Around",
    "Exit Walkthrough",
    "Reset Position",
    "Controls",
  ]);
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  await expect(page.getByLabel("Walkthrough help")).toContainText(
    "Space jumps",
  );
  await page
    .getByRole("button", { name: "Use keyboard / touch", exact: true })
    .click();
  async function feet() {
    const text = await page
        .getByLabel("Walking position", { exact: true })
        .textContent(),
      m = text.match(/X (-?[\d.]+).*feet (-?[\d.]+) m.* Z (-?[\d.]+)/);
    assert.ok(m);
    return m.slice(1).map(Number);
  }
  const start = await feet();
  await page.keyboard.press("Space");
  await expect
    .poll(async () => (await feet())[1], { timeout: 10000 })
    .toBeGreaterThan(start[1] + 0.15);
  await expect
    .poll(async () => (await feet())[1], { timeout: 15000 })
    .toBeCloseTo(start[1], 2);
  await page.keyboard.down("Shift");
  await page.keyboard.down("w");
  try {
    await expect
      .poll(async () => (await feet())[2], { timeout: 10000 })
      .toBeLessThan(start[2] - 0.7);
  } finally {
    await page.keyboard.up("Shift");
    await page.keyboard.up("w");
  }
  await page
    .getByRole("button", { name: "Reset Position", exact: true })
    .click();
  await expect.poll(feet).toEqual(start);
  await page.getByRole("button", { name: "Furnish", exact: true }).click();
  await page.setViewportSize({ width: 700, height: 800 });
  const panel = await page
    .getByLabel("Furnish workspace", { exact: true })
    .boundingBox();
  assert.ok(panel && panel.x >= 0 && panel.x + panel.width <= 700);
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  );
  await page
    .getByRole("searchbox", { name: "Search furniture", exact: true })
    .focus();
  await page.keyboard.type("Coffee table");
  await expect(
    page.getByRole("button", { name: /^Coffee table/ }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page
    .getByRole("searchbox", { name: "Search furniture", exact: true })
    .fill("Coffee table");
  await page.getByRole("button", { name: /^Coffee table/ }).click();
  const b = await page.locator("canvas[data-engine]").boundingBox();
  await page.mouse.move(b.x + b.width * 0.27, b.y + b.height * 0.73);
  await expect(
    page.getByRole("button", { name: "Place furniture", exact: true }),
  ).toBeEnabled({ timeout: 15000 });
  assert.deepEqual((await saved()).objects, []);
  await page.locator("canvas[data-engine]").focus();
  await page.keyboard.press("e");
  await expect(
    page.getByRole("button", { name: "Place furniture", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  const placed = await saved();
  assert.equal(placed.objects.length, 1);
  assert.equal(placed.objects[0].furniture.preset, "coffee-table");
  await page
    .getByRole("button", { name: "Browse furniture", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Search furniture", exact: true })
    .fill("Armchair");
  await page.getByRole("button", { name: /^Armchair/ }).click();
  await page.keyboard.press("Escape");
  assert.deepEqual((await saved()).objects, placed.objects);
  await page.screenshot({
    path:
      ".cache/m131-" +
      (new URL(page.url()).protocol === "https:" ? "public" : "local") +
      "-furnish.png",
  });
  await page
    .getByRole("button", { name: "Done furnishing", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Exit Walkthrough", exact: true })
    .click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual((await saved()).objects, []);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  assert.deepEqual((await saved()).objects, placed.objects);
  await pick(placed.objects[0].name);
  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await page.getByLabel("Object color HEX", { exact: true }).fill("#aa4499");
  await page.getByRole("button", { name: "Apply Color", exact: true }).click();
  const colored = await saved();
  assert.equal(colored.objects[0].color, "#aa4499");
  await history(placed, colored);
  await pick(placed.objects[0].name);
  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  await page
    .getByRole("button", { name: "Duplicate selected object", exact: true })
    .click();
  const doubled = await saved();
  assert.equal(doubled.objects.length, 2);
  await history(colored, doubled);
  await load(colored);
  await history(doubled, colored);
  await load(interior);
  assert.deepEqual((await saved()).objects, interior.objects);
  return {
    productionUI: true,
    developmentBridgeUsed: false,
    realGeminiFurnitureCreation: !!modelAsk,
    realGeminiSelectedFurnitureEdit: !!modelAsk,
    realGeneratedHouseInteriorPlacement: true,
    nativeEntryWithFurniture: true,
    unrelatedArchitecturePreserved: true,
    inertPreview: true,
    cancelAndConfirmation: true,
    jumpGravityLanding: true,
    sprintAndReset: true,
    fourPrimaryControls: true,
    catalogSearch: true,
    narrowCatalogAndKeyboard: true,
    rayAimedGhostPlacement: true,
    rotation: true,
    repeatedEnterCreatesOneObject: true,
    keyboardCancel: true,
    inspectorColor: true,
    duplicate: true,
    portableSaveLoad: true,
    exactUndoRedo: true,
    isolatedGroundPlacementAfterRealArchitectureWorkflow: true,
    geometryAndScopeValidated: true,
    physicalDeviceTested: false,
  };
}
