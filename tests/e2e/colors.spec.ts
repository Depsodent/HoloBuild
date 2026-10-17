import { modelFixture } from "../fixtures/models";
import { readFile } from "node:fs/promises";
import { showLeft } from "../helpers/workspaceTools";
import { test, expect } from "../helpers/editorTest";
import { target } from "../helpers/gestureInput";
import { showTools } from "../helpers/workspaceTools";
test("custom object colors preview without history, validate HEX, apply/reset and persist", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  const canvas = page.locator("canvas[data-engine]");
  const before = await canvas.screenshot();
  const original = await page.evaluate(() => window.__HOLO_TEST__!.scene());
  await page.getByLabel("Object color HEX", { exact: true }).fill("#ff8844");
  await expect(page.getByLabel("Object color", { exact: true })).toHaveValue(
    "#ff8844",
  );
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    original,
  );
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.snapshot().history),
  ).toBe(0);
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  await page.getByLabel("Object color HEX", { exact: true }).fill("#oops");
  await expect(
    page.getByRole("button", { name: "Apply Color", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("RRGGBB");
  await page.getByLabel("Object color HEX", { exact: true }).fill("#abc");
  await page.getByRole("button", { name: "Apply Color", exact: true }).click();
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene()))[0].color,
  ).toBe("#aabbcc");
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.snapshot().history),
  ).toBe(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    original,
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await download;
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("holobuild.scene")!).objects[0].color,
    ),
  ).toBe("#aabbcc");
  await showLeft(page, "collection");
  await page.locator(".scene-list button").first().click();
  await page
    .getByRole("button", { name: "Reset to Material Default", exact: true })
    .click();
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene()))[0].color,
  ).toBe(original[0].color);
});
test("structure role tint previews only matching components and commits once", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  await showTools(page, "ai");
  await page
    .getByLabel("Ask HoloBuild", { exact: true })
    .fill("Build a house without doors");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  const before = await page.evaluate(() => window.__HOLO_TEST__!.scene());
  await page.getByLabel("Structure material target").selectOption("roof");
  await page.getByLabel("Structure color HEX").fill("#772244");
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    before,
  );
  await page.getByRole("button", { name: "Apply Color", exact: true }).click();
  const after = await page.evaluate(() => window.__HOLO_TEST__!.scene());
  expect(
    after
      .filter((o) => o.construction?.role === "roof")
      .every((o) => o.color === "#772244"),
  ).toBe(true);
  expect(after.filter((o) => o.construction?.role !== "roof")).toEqual(
    before.filter((o) => o.construction?.role !== "roof"),
  );
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.snapshot().history),
  ).toBe(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    before,
  );
});

test("original imported PBR surfaces accept a persistent tint without losing optics or assets", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  await page
    .getByRole("button", { name: "Delete selected object", exact: true })
    .click();
  const fixture = modelFixture();
  await page
    .getByLabel("Model files", { exact: true })
    .setInputFiles({
      name: "tint.glb",
      mimeType: "model/gltf-binary",
      buffer: fixture.glb,
    });
  await expect
    .poll(() =>
      page.evaluate(() => window.__HOLO_TEST__!.rendered?.()[0]?.roughness),
    )
    .toBe(0.5);
  const canvas = page.locator("canvas[data-engine]"),
    before = await canvas.screenshot();
  const original = await page.evaluate(() => window.__HOLO_TEST__!.scene()[0]);
  await page.getByLabel("Object color HEX", { exact: true }).fill("#ff4422");
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene()[0])).toEqual(
    original,
  );
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  await page.getByRole("button", { name: "Apply Color", exact: true }).click();
  const tinted = await page.evaluate(() => window.__HOLO_TEST__!.scene()[0]);
  expect(tinted.model).toMatchObject({ originalMaterials: true, tint: true });
  expect(tinted.color).toBe("#ff4422");
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.rendered?.()[0]?.roughness),
  ).toBe(0.5);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const saved = await readFile((await (await downloading).path())!, "utf8");
  expect(JSON.parse(saved).objects[0].model.tint).toBe(true);
  await page
    .getByRole("button", { name: "Delete selected object", exact: true })
    .click();
  await page
    .locator('input[type=file][accept=".json"]')
    .setInputFiles({
      name: "tinted-project.json",
      mimeType: "application/json",
      buffer: Buffer.from(saved),
    });
  await expect
    .poll(() => page.evaluate(() => window.__HOLO_TEST__!.scene()[0]?.color))
    .toBe("#ff4422");
  await expect
    .poll(() =>
      page.evaluate(() => window.__HOLO_TEST__!.rendered?.()[0]?.roughness),
    )
    .toBe(0.5);
  await showLeft(page, "collection");
  await page.locator(".scene-list button").click();
  const history = await page.evaluate(
    () => window.__HOLO_TEST__!.snapshot().history,
  );
  await page
    .getByRole("button", { name: "Reset to Material Default", exact: true })
    .click();
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.scene()[0].model?.tint),
  ).toBe(false);
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.snapshot().history),
  ).toBe(history + 1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.scene()[0].model?.tint),
  ).toBe(true);
});
