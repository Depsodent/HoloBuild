/* global document */
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { FURNITURE } from "../shared/furnitureCatalog.mjs";
import { randomUUID } from "node:crypto";
import { activate } from "./walkthrough-buttons.mjs";
export async function smokeWalkthroughControls(page) {
  async function saved() {
    const d = page.waitForEvent("download");
    await activate(page, "Save project");
    return JSON.parse(await fs.readFile(await (await d).path(), "utf8"));
  }
  async function load(data) {
    await page
      .locator('input[type=file][accept=".json"]')
      .setInputFiles({
        name: "controls-acceptance.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(data)),
      });
    await expect(page.locator("footer .status")).toContainText(
      "Replace complete.",
    );
    assert.deepEqual((await saved()).objects, data.objects);
  }
  async function enter() {
    const button = page.getByRole("button", {
        name: "Enter Walkthrough",
        exact: true,
      }),
      b = await button.boundingBox();
    await button.click();
    await expect
      .poll(() => page.evaluate(() => document.pointerLockElement?.tagName))
      .toBe("CANVAS");
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }
  async function exited() {
    await expect(
      page.getByRole("button", { name: "Enter Walkthrough", exact: true }),
    ).toBeVisible();
    assert.equal(await page.evaluate(() => document.pointerLockElement), null);
  }
  const original = await saved();
  const wardrobe = (x) => ({
    id: randomUUID(),
    name: x ? "Blocker wardrobe" : "Control wardrobe",
    type: "furniture",
    furniture: { preset: "wardrobe" },
    position: [x, FURNITURE.wardrobe.size[1] / 2, -4],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    material: "solid",
    color: "#a47b4b",
  });
  const test = { ...original, objects: [wardrobe(0), wardrobe(2.8)] };
  await load(test);
  const canvas = page.locator("canvas[data-engine]"),
    editorRect = await canvas.boundingBox();
  let point = await enter();
  await expect(
    page.getByRole("button", { name: "Look Around", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const box = await canvas.boundingBox(),
    distance = 4 - FURNITURE.wardrobe.size[2] / 2,
    span = 2 * distance * Math.tan((65 * Math.PI) / 360);
  await page.keyboard.down("Control");
  await page.mouse.down({ button: "right" });
  await page.mouse.move(point.x + (2.8 * box.height) / span, point.y);
  await expect(page.getByLabel("Exploration controls")).toContainText(
    "Invalid placement",
  );
  await page.mouse.up({ button: "right" });
  await page.keyboard.up("Control");
  assert.deepEqual((await saved()).objects, test.objects);
  await page.keyboard.down("Control");
  await page.mouse.down({ button: "right" });
  await page.mouse.move(point.x + (2.8 * box.height) / span + 80, point.y);
  await page.keyboard.press("ArrowRight");
  await page.mouse.up({ button: "right" });
  await page.keyboard.up("Control");
  const moved = await saved();
  assert.notDeepEqual(moved.objects[0].position, test.objects[0].position);
  assert.ok(Math.abs(moved.objects[0].rotation[1] - Math.PI / 12) < 1e-6);
  assert.deepEqual(moved.objects[1], test.objects[1]);
  await page.keyboard.press("Escape");
  await exited();
  await activate(page, "Undo");
  assert.deepEqual((await saved()).objects, test.objects);
  await activate(page, "Redo");
  assert.deepEqual((await saved()).objects, moved.objects);
  const restoredRect = await canvas.boundingBox();
  assert.deepEqual(restoredRect, editorRect);
  point = await enter();
  await page.keyboard.press("e");
  await expect(
    page.getByRole("region", { name: "Furniture catalog" }),
  ).toBeVisible();
  assert.equal(await page.evaluate(() => document.pointerLockElement), null);
  const search = page.getByRole("searchbox", { name: "Search furniture" });
  await search.fill("Armchair");
  await page.keyboard.press("e");
  await expect(search).toHaveValue("Armchaire");
  await canvas.focus();
  await page.keyboard.press("e");
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.tagName))
    .toBe("CANVAS");
  await page.keyboard.press("e");
  await search.fill("Armchair");
  await page.getByRole("button", { name: /^Armchair/ }).click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await exited();
  assert.deepEqual((await saved()).objects, moved.objects);
  await load(test);
  point = await enter();
  await page.keyboard.down("Control");
  await page.mouse.down({ button: "right" });
  await page.mouse.move(point.x + 50, point.y);
  await page.keyboard.press("Escape");
  await page.mouse.up({ button: "right" });
  await page.keyboard.up("Control");
  await exited();
  assert.deepEqual((await saved()).objects, test.objects);
  await load(original);
  return {
    productionUI: true,
    developmentBridgeUsed: false,
    automaticRealPointerLock: true,
    lockedCenterRayPicking: true,
    relativeGroundPlaneDrag: true,
    invalidCollisionCancellation: true,
    arrowRotationDuringCtrlDrag: true,
    unrelatedObjectPreserved: true,
    oneAtomicUndoRedo: true,
    oneEscapeExitLocked: true,
    oneEscapeExitPlacement: true,
    oneEscapeExitDrag: true,
    layoutRestored: true,
    catalogToggleAndLockRestore: true,
    typingIgnoresShortcuts: true,
    originalSceneRestored: true,
    physicalKeyboardMouseTested: false,
  };
}
