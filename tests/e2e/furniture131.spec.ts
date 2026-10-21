import { PerspectiveCamera, Vector3 } from "three";
import { hold, poseAt, target } from "../helpers/gestureInput";
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { createFurniture } from "../../src/furniture/factory";
import { createObject } from "../../src/scene/objectFactory";
import { materializePlan } from "../../src/generation/engine";
import { offlinePlan } from "../../src/generation/offline";
import { showTools, showLeft, setPlannerMode } from "../helpers/workspaceTools";
const scene = (p: Page) => p.evaluate(() => window.__HOLO_TEST__!.scene());
const view = (p: Page) => p.evaluate(() => window.__HOLO_TEST__!.view!());
const history = (p: Page) =>
  p.evaluate(() => window.__HOLO_TEST__!.snapshot().history);
async function ready(p: Page, objects: ReturnType<typeof createObject>[] = []) {
  await p.goto("/?testInput");
  await p.waitForFunction(() => !!window.__HOLO_TEST__?.view);
  await p.locator('input[type=file][accept=".json"]').setInputFiles({
    name: "sample.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 1, objects })),
  });
  await expect(p.locator("footer .status")).toContainText("Replace complete.");
}
async function keyboard(p: Page) {
  await p.getByRole("button", { name: "Controls", exact: true }).click();
  await p
    .getByRole("button", { name: "Use keyboard / touch", exact: true })
    .click();
}
async function ask(p: Page, text: string) {
  await showTools(p, "ai");
  await p.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
  await p.getByRole("button", { name: "Send request", exact: true }).click();
}
async function aim(p: Page) {
  const b = await p.locator("canvas[data-engine]").boundingBox();
  await p.mouse.move(b!.x + b!.width * 0.27, b!.y + b!.height * 0.73);
  await expect(
    p.getByRole("button", { name: "Place furniture", exact: true }),
  ).toBeEnabled({ timeout: 15000 });
}
async function choose(p: Page, name: string) {
  await p.getByRole("button", { name: new RegExp("^" + name) }).click();
}
async function pick(p: Page, name: string) {
  await showLeft(p, "collection");
  await p.getByLabel("Search scene objects").fill(name);
  await p
    .locator(".scene-list button")
    .filter({ hasText: name })
    .first()
    .click();
  await showLeft(p, "inspector");
}
test("walkthrough keeps four controls, jumps only on contact, sprints and clears held inputs", async ({
  page,
}) => {
  await ready(page);
  const initial = await scene(page),
    h = await history(page);
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
  await keyboard(page);
  await page.keyboard.press("Space");
  await expect
    .poll(async () => (await view(page)).feet![1])
    .toBeGreaterThan(0.2);
  await page.keyboard.press("Space");
  await expect
    .poll(async () => (await view(page)).feet![1], { timeout: 5000 })
    .toBeCloseTo(0, 2);
  await page.keyboard.down("Shift");
  await page.keyboard.down("w");
  await page.waitForFunction(
    () => window.__HOLO_TEST__!.view!().feet![2] < -0.7,
  );
  await page.keyboard.up("Shift");
  await page.keyboard.up("w");
  const feet = (await view(page)).feet!;
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.keyboard.down("w");
  await page.keyboard.up("w");
  await page
    .getByRole("button", { name: "Reset Position", exact: true })
    .click();
  await expect.poll(async () => (await view(page)).feet).toEqual([0, 0, 0]);
  expect(feet[2]).toBeLessThan(-0.7);
  expect(await scene(page)).toEqual(initial);
  expect(await history(page)).toBe(h);
  await page
    .getByRole("button", { name: "Exit Walkthrough", exact: true })
    .click();
});
test("walkthrough catalog searches, keeps camera controls distinct, places one real sofa and cancels a second preview", async ({
  page,
}) => {
  await ready(page);
  const h = await history(page);
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  await page.getByRole("button", { name: "Furnish", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search furniture", exact: true })
    .fill("sofa");
  await expect(
    page.getByRole("region", { name: "Furniture catalog" }).getByRole("button"),
  ).toHaveCount(3);
  await choose(page, "Two-seat sofa");
  expect(await scene(page)).toHaveLength(0);
  await aim(page);
  await page.keyboard.press("e");
  await aim(page);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await scene(page)).length).toBe(1);
  expect(await history(page)).toBe(h + 1);
  expect((await scene(page))[0].furniture?.preset).toBe("sofa-two");
  await expect
    .poll(() =>
      page.evaluate(() => window.__HOLO_TEST__!.furnitureRendered!().length),
    )
    .toBe(1);
  const geometry = await page.evaluate(() =>
    window.__HOLO_TEST__!.furnitureRendered!(),
  );
  expect(geometry[0].drawMeshes).toBeGreaterThan(1);
  expect(geometry[0].triangles).toBeGreaterThan(80);
  await page
    .getByRole("button", { name: "Browse furniture", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Search furniture", exact: true })
    .fill("armchair");
  await choose(page, "Armchair");
  await page.keyboard.press("Escape");
  expect(await scene(page)).toHaveLength(1);
  expect(await history(page)).toBe(h + 1);
  await page.screenshot({ path: ".cache/m131-furnish-sofa.png" });
  await page
    .getByRole("button", { name: "Done furnishing", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Exit Walkthrough", exact: true })
    .click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toHaveLength(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene(page)).toHaveLength(1);
});
test("editor catalog, Inspector appearance, duplicate/delete and portable save/load preserve exact furniture data", async ({
  page,
}) => {
  await ready(page);
  await showTools(page, "build");
  await page.locator("details.furniture-library summary").click();
  await page.getByLabel("Furniture category").selectOption("Bedroom");
  await choose(page, "Double bed");
  await aim(page);
  await page
    .getByRole("button", { name: "Place furniture", exact: true })
    .click();
  const bed = (await scene(page))[0];
  await pick(page, bed.name);
  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await page.getByLabel("Object color HEX", { exact: true }).fill("#aa4499");
  await page.getByRole("button", { name: "Apply Color", exact: true }).click();
  const colored = await scene(page);
  expect(colored[0].color).toBe("#aa4499");
  await showTools(page, "edit");
  await page
    .getByRole("button", { name: "Duplicate selected object", exact: true })
    .click();
  await expect.poll(async () => (await scene(page)).length).toBe(2);
  await page
    .getByRole("button", { name: "Delete object from toolbar", exact: true })
    .click();
  expect(await scene(page)).toEqual(colored);
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const data = fs.readFileSync((await (await d).path())!);
  await showTools(page, "build");
  await page.getByTitle("Create Cube", { exact: true }).click();
  const before = await scene(page);
  await page.locator('input[type=file][accept=".json"]').setInputFiles({
    name: "portable.json",
    mimeType: "application/json",
    buffer: data,
  });
  await expect(page.locator("footer .status")).toContainText(
    "Replace complete.",
  );
  expect(await scene(page)).toEqual(colored);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(before);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene(page)).toEqual(colored);
});
test("AI furniture placement and selected edits use inert existing review and exact history, while room ambiguity clarifies", async ({
  page,
}) => {
  await ready(page);
  await setPlannerMode(page, "offline");
  await ask(page, "Add a sofa to the living room.");
  await expect(page.getByLabel("Design conversation")).toContainText(
    "Which floor",
  );
  expect(await scene(page)).toHaveLength(0);
  await ask(page, "Add a sofa at 4,0,3");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  expect(await scene(page)).toHaveLength(0);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const original = await scene(page);
  await ask(page, "Change this sofa to blue");
  expect(await scene(page)).toEqual(original);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const edited = await scene(page);
  expect(edited[0].color).toBe("#508ee8");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(original);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene(page)).toEqual(edited);
});
test("multi-floor furniture respects real support and stairs; invalid load keeps confirmed project", async ({
  page,
}) => {
  const template = JSON.parse(
      fs.readFileSync("tests/fixtures/gemini-m13-navigation.json", "utf8"),
    ),
    house = materializePlan(offlinePlan(template.kind, template)).objects,
    bed = createFurniture("bed-single", [1.4, 3.4, -1.1]),
    wardrobe = createFurniture("wardrobe", [1.4, 0.2, -1.2]);
  await ready(page, [...house, bed, wardrobe]);
  expect((await scene(page)).filter((o) => o.furniture)).toHaveLength(2);
  await page.screenshot({ path: ".cache/m131-furnished-house.png" });
  const before = await scene(page);
  await page.locator('input[type=file][accept=".json"]').setInputFiles({
    name: "floating.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        objects: [createFurniture("wardrobe", [0, 8, 0])],
      }),
    ),
  });
  await expect(page.locator("footer .status")).toContainText("rejected");
  expect(await scene(page)).toEqual(before);
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  await keyboard(page);
  await page.keyboard.press("Space");
  await page
    .getByRole("button", { name: "Reset Position", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Exit Walkthrough", exact: true })
    .click();
  expect(await scene(page)).toEqual(before);
});

test("existing one-hand gesture path grabs, moves and releases native furniture with one undoable edit", async ({
  page,
}) => {
  await ready(page, [createFurniture("coffee-table")]);
  const h = await history(page),
    start = await target(page),
    end = { x: start.cursor.x + 0.12, y: start.cursor.y };
  await hold(page, poseAt("pointing", start.cursor));
  await hold(page, poseAt("pinch", start.cursor));
  await expect(page.locator(".gesture-cursor")).toHaveClass(/dragging/);
  await hold(page, poseAt("pinch", end));
  expect((await scene(page))[0]).toEqual(start.object);
  expect(await history(page)).toBe(h);
  await hold(page, poseAt("pointing", end));
  await expect.poll(() => history(page)).toBe(h + 1);
  const moved = await scene(page);
  expect(moved[0].position).not.toEqual(start.object.position);
  await hold(page, [], 50);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await scene(page))[0]).toEqual(start.object);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene(page)).toEqual(moved);
});

async function axis(p: Page, coordinate: 0 | 2, target: number) {
  for (let i = 0; i < 70; i++) {
    const value = (await view(p)).feet![coordinate],
      delta = target - value;
    if (Math.abs(delta) < 0.13) return;
    const key =
      coordinate === 0 ? (delta > 0 ? "d" : "a") : delta > 0 ? "s" : "w";
    await p.keyboard.down(key);
    try {
      if (Math.abs(delta) > 0.8)
        await expect
          .poll(
            async () =>
              Math.sign(delta) * ((await view(p)).feet![coordinate] - target),
            { timeout: 20000, intervals: [40] },
          )
          .toBeGreaterThan(-0.45);
      else await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    } finally {
      await p.keyboard.up(key);
    }
  }
  throw Error(
    "Navigation waypoint alignment failed: " +
      coordinate +
      " to " +
      target +
      " actual " +
      (await view(p)).feet![coordinate],
  );
}
async function aimPoint(p: Page, point: [number, number, number]) {
  const b = (await p.locator("canvas[data-engine]").boundingBox())!,
    v = await view(p),
    camera = new PerspectiveCamera(65, b.width / b.height, 0.05, 1000);
  camera.position.fromArray(v.position);
  camera.quaternion.fromArray(v.quaternion);
  camera.updateMatrixWorld();
  const target = new Vector3(...point).project(camera);
  expect(Math.abs(target.x)).toBeLessThan(0.99);
  expect(Math.abs(target.y)).toBeLessThan(0.99);
  await p.mouse.move(
    b.x + ((target.x + 1) * b.width) / 2,
    b.y + ((1 - target.y) * b.height) / 2,
  );
  await expect(
    p.getByRole("button", { name: "Place furniture", exact: true }),
  ).toBeEnabled({ timeout: 15000 });
}
async function place(
  p: Page,
  name: string,
  point: [number, number, number],
  first = false,
) {
  if (!first)
    await p
      .getByRole("button", { name: "Browse furniture", exact: true })
      .click();
  await p
    .getByRole("searchbox", { name: "Search furniture", exact: true })
    .fill(name);
  await choose(p, name);
  await aimPoint(p, point);
  await p.getByRole("button", { name: "Place furniture", exact: true }).click();
}
test("two-story interior acceptance jumps, sprints, climbs connected stairs, furnishes both floors and preserves Inspector and exact IO history", async ({
  page,
}) => {
  test.setTimeout(240000);
  const template = JSON.parse(
      fs.readFileSync("tests/fixtures/gemini-m13-navigation.json", "utf8"),
    ),
    house = materializePlan(offlinePlan(template.kind, template)).objects;
  await ready(page, house);
  const original = await scene(page),
    h = await history(page);
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  await keyboard(page);
  const entryY = (await view(page)).feet![1];
  await page.keyboard.press("Space");
  await expect
    .poll(async () => (await view(page)).feet![1], { timeout: 20000 })
    .toBeGreaterThan(entryY + 0.2);
  await expect
    .poll(async () => (await view(page)).feet![1], { timeout: 30000 })
    .toBeCloseTo(entryY, 2);
  await axis(page, 2, 2.7);
  await page.getByRole("button", { name: "Furnish", exact: true }).click();
  await place(page, "Two-seat sofa", [1.5, 0.2, -1.4], true);
  await place(page, "Coffee table", [1.5, 0.2, -0.3]);
  await page
    .getByRole("button", { name: "Done furnishing", exact: true })
    .click();
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  await page
    .getByRole("button", { name: "Use keyboard / touch", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close controls", exact: true })
    .click();
  await page.locator("canvas[data-engine]").focus();
  await page.keyboard.down("Shift");
  await axis(page, 2, -2.1);
  await page.keyboard.up("Shift");
  await axis(page, 0, -1.5);
  await axis(page, 2, 2.1);
  expect((await view(page)).feet![1]).toBeCloseTo(3.4, 1);
  await axis(page, 0, 1.4);
  await page.getByRole("button", { name: "Furnish", exact: true }).click();
  await place(page, "Single bed", [1.4, 3.4, -1.1], true);
  await place(page, "Wardrobe", [0, 3.4, -1.3]);
  expect((await scene(page)).filter((o) => o.furniture)).toHaveLength(4);
  expect(await history(page)).toBe(h + 4);
  await page.screenshot({ path: ".cache/m131-upstairs-furnishing.png" });
  await page
    .getByRole("button", { name: "Done furnishing", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reset Position", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Exit Walkthrough", exact: true })
    .click();
  const furnished = await scene(page);
  expect(furnished.filter((o) => !o.furniture)).toEqual(original);
  const bed = furnished.find((o) => o.furniture?.preset === "bed-single")!;
  await pick(page, bed.name);
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await page.getByLabel("Selection height (m)", { exact: true }).fill("1.5");
  await page.getByLabel("Selection height (m)", { exact: true }).press("Enter");
  const edited = await scene(page);
  expect(edited.find((o) => o.id === bed.id)!.scale[1]).not.toBe(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(furnished);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene(page)).toEqual(edited);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const data = fs.readFileSync((await (await download).path())!);
  await showTools(page, "build");
  await page.getByTitle("Create Cube", { exact: true }).click();
  const beforeLoad = await scene(page);
  await page
    .locator('input[type=file][accept=".json"]')
    .setInputFiles({
      name: "furnished-two-story.json",
      mimeType: "application/json",
      buffer: data,
    });
  await expect(page.locator("footer .status")).toContainText(
    "Replace complete.",
  );
  expect(await scene(page)).toEqual(edited);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(beforeLoad);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene(page)).toEqual(edited);
});

test("catalog typing and paused transitions clear held movement without hiding exit controls", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  await keyboard(page);
  await page.keyboard.down("w");
  await page.getByRole("button", { name: "Furnish", exact: true }).click();
  const before = (await view(page)).feet;
  await page
    .getByRole("searchbox", { name: "Search furniture", exact: true })
    .fill("www sss");
  await page.keyboard.up("w");
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        let n = 0;
        function frame() {
          if (++n === 5) resolve(null);
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }),
  );
  expect((await view(page)).feet).toEqual(before);
  await expect(
    page.getByRole("button", { name: "Exit Walkthrough", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Furniture catalog" }),
  ).toContainText("No furniture matches");
  await page
    .getByRole("button", { name: "Done furnishing", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Exit Walkthrough", exact: true })
    .click();
});
