import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { materializePlan } from "../../src/generation/engine";
import { offlinePlan } from "../../src/generation/offline";
import { serialize } from "../../src/scene/sceneSerializer";
import { showLeft, showTools } from "../helpers/workspaceTools";
import { target } from "../helpers/gestureInput";
const scene = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.__HOLO_TEST__!.scene());
async function pick(page: import("@playwright/test").Page, role: string) {
  const o = (await scene(page)).find((o) => o.construction?.role === role)!;
  await page.getByLabel("Selection mode").selectOption("component");
  await showLeft(page, "collection");
  await page.getByLabel("Search scene objects").fill(o.name);
  await page
    .locator(".scene-list button")
    .filter({ hasText: o.name })
    .first()
    .click();
  await showLeft(page, "inspector");
  return o;
}
test("architectural cards require a compatible building and never insert floating geometry", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  await showTools(page, "build");
  const before = await scene(page);
  for (const name of ["Stairs", "Balcony"]) {
    await page.getByTitle("Create " + name, { exact: true }).click();
    if(name==="Stairs")await page.getByLabel("Stair configuration").selectOption("connected");
    await expect(page.getByLabel("Architectural insertion")).toContainText(
      "Create or load a multi-floor building first",
    );
    await expect(
      page.getByRole("button", {
        name: "Preview library " + name.toLowerCase(),
        exact: true,
      }),
    ).toBeDisabled();
    expect(await scene(page)).toEqual(before);
  }
});
test("manual native stairs and balconies configure, duplicate, remove, persist and undo exactly", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const built = materializePlan(
    offlinePlan("house", {
      width: 6,
      depth: 6,
      height: 3,
      floors: 3,
      doors: 0,
      windows: 0,
    }),
  ).objects;
  await page.goto("/?testInput");
  await target(page);
  await page.locator("input[type=file][accept='.json']").setInputFiles({
    name: "host.json",
    mimeType: "application/json",
    buffer: Buffer.from(serialize(built)),
  });
  await expect.poll(() => scene(page)).toHaveLength(built.length);
  const before = await scene(page);
  await showTools(page, "build");
  await page.getByTitle("Create Stairs", { exact: true }).click();
  await page.getByLabel("Library Width", { exact: true }).fill("1.1");
  await page.getByLabel("Library orientation").selectOption("180");
  await page.getByLabel("Library material").selectOption("wood");
  await page
    .getByRole("button", { name: "Preview library stairs", exact: true })
    .click();
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  expect(await scene(page)).toEqual(before);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const stairs = await scene(page);
  expect(stairs.filter((o) => o.construction?.role === "stair")).toHaveLength(
    16,
  );
  expect(stairs[0].construction!.structure!.template!.stairs![0]).toMatchObject(
    { width: 1.1, yaw: 180, material: "wood" },
  );
  await pick(page, "stair");
  const inspector = page.getByLabel("Precision Inspector", { exact: true });
  await inspector
    .getByRole("button", { name: "Advanced", exact: true })
    .click();
  await expect(
    page.getByLabel("Staircase Inspector", { exact: true }),
  ).toBeVisible();
  await inspector
    .getByRole("button", { name: "Duplicate", exact: true })
    .click();
  const doubleStairs = await scene(page);
  expect(
    doubleStairs.filter((o) => o.construction?.role === "stair"),
  ).toHaveLength(32);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(stairs);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene(page)).toEqual(doubleStairs);
  await showTools(page, "build");
  await page.getByTitle("Create Balcony", { exact: true }).click();
  await page.getByLabel("Library Width", { exact: true }).fill("2.6");
  await page.getByLabel("Library Depth", { exact: true }).fill("1.6");
  await page
    .getByRole("button", { name: "Preview library balcony", exact: true })
    .click();
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  expect(await scene(page)).toEqual(doubleStairs);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const balcony = await scene(page);
  expect(
    balcony.filter((o) => o.construction?.role === "balcony"),
  ).toHaveLength(8);
  expect(balcony.filter((o) => o.construction?.role === "stair")).toHaveLength(
    32,
  );
  const recipe = balcony[0].construction!.structure!.template!,
    entry = recipe.openings!.find((o) => o.id === recipe.balconies![0].access)!;
  expect(entry).toMatchObject({ kind: "door", facade: "front", level: 1 });
  await expect
    .poll(() => page.evaluate(() => window.__HOLO_TEST__!.rendered?.().length))
    .toBeGreaterThan(40);
  await pick(page, "balcony");
  await inspector
    .getByRole("button", { name: "Duplicate", exact: true })
    .click();
  expect(
    (await scene(page)).filter((o) => o.construction?.role === "balcony"),
  ).toHaveLength(16);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(balcony);
  await pick(page, "balcony");
  await page
    .getByRole("button", { name: "Delete selected object", exact: true })
    .click();
  expect(
    (await scene(page)).filter((o) => o.construction?.role === "balcony"),
  ).toHaveLength(0);
  expect(
    (await scene(page)).filter((o) => o.construction?.role === "stair"),
  ).toHaveLength(32);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(balcony);
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const json = await readFile((await (await d).path())!, "utf8");
  await showTools(page, "build");
  await page.getByTitle("Create Cube", { exact: true }).click();
  const extra = await scene(page);
  await page.locator("input[type=file][accept='.json']").setInputFiles({
    name: "manual-assemblies.json",
    mimeType: "application/json",
    buffer: Buffer.from(json),
  });
  await expect
    .poll(async () => JSON.parse(JSON.stringify(await scene(page))))
    .toEqual(JSON.parse(json).objects);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(extra);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(JSON.parse(JSON.stringify(await scene(page)))).toEqual(
    JSON.parse(json).objects,
  );
  expect(errors).toEqual([]);
});
