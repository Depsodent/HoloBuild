import fs from "node:fs";
import { setPlannerMode } from "../helpers/workspaceTools";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { showLeft, showTools } from "../helpers/workspaceTools";
import { target } from "../helpers/gestureInput";
const scene = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.__HOLO_TEST__!.scene());
async function number(
  page: import("@playwright/test").Page,
  label: string,
  value: string,
) {
  await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel(label, { exact: true }).press("Enter");
}
test("Inspector materials, precision dimensions, measurements and exact history survive JSON restore", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?testInput");
  await target(page);
  await showLeft(page, "inspector");
  const root = page.getByLabel("Precision Inspector", { exact: true });
  for (const name of ["Materials", "AI Edit", "Advanced"])
    await expect(root.getByRole("button", { name, exact: true })).toBeVisible();
  const base = await scene(page);
  await number(page, "Roughness", "0.2");
  await number(page, "Metalness", "0.8");
  await number(page, "Opacity", "0.5");
  const material = await scene(page);
  expect(material[0].surface).toEqual({
    roughness: 0.2,
    metalness: 0.8,
    opacity: 0.5,
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.__HOLO_TEST__!.rendered?.()[0].opacity),
    )
    .toBe(0.5);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await scene(page))[0].surface?.opacity).toBeUndefined();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene(page)).toEqual(material);
  await showLeft(page, "collection");
  await page.locator(".scene-list button").first().click();
  await root.getByRole("button", { name: "Advanced", exact: true }).click();
  await number(page, "position X", "0.2");
  await number(page, "Selection width (m)", "2");
  await page.getByLabel("Grid increment", { exact: true }).selectOption("0.1");
  await page.getByLabel("Precision grid snapping", { exact: true }).uncheck();
  await page.getByLabel("Show measurements", { exact: true }).check();
  await expect(
    page.getByLabel("Selection measurements", { exact: true }),
  ).toContainText("2.00 × 1.00 × 1.00 m");
  const changed = await scene(page);
  expect(changed[0].position[0]).toBe(0.2);
  expect(changed[0].scale[0]).toBe(2);
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const json = await readFile((await (await d).path())!, "utf8");
  await number(page, "position X", "4");
  await page.locator("input[type=file][accept='.json']").setInputFiles({
    name: "precise.json",
    mimeType: "application/json",
    buffer: Buffer.from(json),
  });
  await expect.poll(() => scene(page)).toEqual(changed);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await scene(page))[0].position[0]).toBe(4);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene(page)).toEqual(changed);
  await page.reload();
  await showLeft(page, "inspector");
  await root.getByRole("button", { name: "Advanced", exact: true }).click();
  await expect(page.getByLabel("Grid increment", { exact: true })).toHaveValue(
    "0.1",
  );
  expect(base[0].surface).toBeUndefined();
  expect(errors).toEqual([]);
});
test("selection AI Edit retains draft across tabs and previews centimetres without mutation", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  await showLeft(page, "inspector");
  const root = page.getByLabel("Precision Inspector", { exact: true });
  await root.getByRole("button", { name: "AI Edit", exact: true }).click();
  await page
    .getByLabel("AI edit selected", { exact: true })
    .fill("Move this object 20 centimeters to the right");
  await root.getByRole("button", { name: "Materials", exact: true }).click();
  await root.getByRole("button", { name: "AI Edit", exact: true }).click();
  await expect(
    page.getByLabel("AI edit selected", { exact: true }),
  ).toHaveValue(/20 centimeters/);
  const before = await scene(page);
  await root.getByRole("button", { name: "Preview edit", exact: true }).click();
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  expect(await scene(page)).toEqual(before);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const moved = await scene(page);
  expect(moved[0].position[0]).toBeCloseTo(before[0].position[0] + 0.2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(before);
  await showLeft(page, "collection");
  await page.locator(".scene-list button").first().click();
  await root.getByRole("button", { name: "AI Edit", exact: true }).click();
  await page
    .getByLabel("AI edit selected", { exact: true })
    .fill("Set roughness to 2");
  await root.getByRole("button", { name: "Preview edit", exact: true }).click();
  expect(await scene(page)).toEqual(before);
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toHaveCount(0);
});

test("recorded architectural generation survives precise whole-structure dimensions and portable exact history", async ({
  page,
}) => {
  const plan = JSON.parse(
    fs.readFileSync("tests/fixtures/ollama-architecture.json", "utf8"),
  );
  await page.route("**/api/planner/assistant", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        source: "llm",
        model: "recorded-native-recipe",
        plan,
      }),
    }),
  );
  await page.goto("/?testInput");
  await target(page);
  await setPlannerMode(page, "llm");
  const ask = async (text: string) => {
    await showTools(page, "ai");
    await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
    await page
      .getByRole("button", { name: "Send request", exact: true })
      .click();
  };
  const before = await scene(page);
  await ask("generate a 2 story house including a balcony and stairs");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  expect(await scene(page)).toEqual(before);
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  await ask("Select the whole house");
  await showLeft(page, "inspector");
  const root = page.getByLabel("Precision Inspector", { exact: true });
  await root.getByRole("button", { name: "Advanced", exact: true }).click();
  const built = await scene(page);
  await number(page, "Selection width (m)", "7.2");
  const changed = await scene(page);
  expect(changed.find((o) => !o.construction)).toEqual(before[0]);
  expect(changed.filter((o) => o.construction?.role === "stair")).toHaveLength(
    16,
  );
  expect(
    changed.filter((o) => o.construction?.role === "balcony"),
  ).toHaveLength(8);
  expect(changed.filter((o) => o.construction).map((o) => o.id)).toEqual(
    built.filter((o) => o.construction).map((o) => o.id),
  );
  expect(changed).not.toEqual(built);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(built);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene(page)).toEqual(changed);
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const json = await readFile((await (await d).path())!, "utf8");
  await showTools(page, "build");
  await page.getByTitle("Create Cube", { exact: true }).click();
  const extra = await scene(page);
  await page
    .locator("input[type=file][accept='.json']")
    .setInputFiles({
      name: "architecture-precision.json",
      mimeType: "application/json",
      buffer: Buffer.from(json),
    });
  await expect.poll(() => scene(page)).toEqual(changed);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(extra);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene(page)).toEqual(changed);
});
