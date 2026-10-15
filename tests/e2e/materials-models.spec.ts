import { test, expect } from "../helpers/editorTest";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { modelFixture, checkerPng } from "../fixtures/models";
import { hold, poseAt, target } from "../helpers/gestureInput";
import {
  MATERIAL_IDS,
  MATERIAL_PRESETS,
} from "../../src/scene/materialPresets";
const fixture = modelFixture();
const sceneFile = (page: Page) =>
  page.locator('input[type=file][accept=".json"]');
test("local GLTF PNG textures and original-material restoration survive portable export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/?testInput");
  await target(page);
  await emptyScene(page);
  const json = JSON.parse(fixture.dependent);
  json.images = [{ uri: "albedo.png" }];
  json.textures = [{ source: 0 }];
  json.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 };
  await page.getByLabel("Model files", { exact: true }).setInputFiles([
    {
      name: "textured.gltf",
      mimeType: "model/gltf+json",
      buffer: Buffer.from(JSON.stringify(json)),
    },
    {
      name: "mesh.bin",
      mimeType: "application/octet-stream",
      buffer: fixture.bytes,
    },
    { name: "albedo.png", mimeType: "image/png", buffer: checkerPng() },
  ]);
  await expect
    .poll(() => page.evaluate(() => window.__HOLO_TEST__!.scene()[0]?.type))
    .toBe("model");
  await expect
    .poll(() =>
      page.evaluate(() => window.__HOLO_TEST__!.rendered?.()[0]?.roughness),
    )
    .toBe(0.5);
  await page.getByLabel("Material", { exact: true }).selectOption("wood");
  await expect
    .poll(() =>
      page.evaluate(() => window.__HOLO_TEST__!.rendered?.()[0]?.roughness),
    )
    .toBe(0.72);
  await page.getByLabel("Use original model materials").check();
  await expect
    .poll(() =>
      page.evaluate(() => window.__HOLO_TEST__!.rendered?.()[0]?.roughness),
    )
    .toBe(0.5);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project" }).click();
  const saved = await readFile((await (await download).path())!, "utf8");
  expect(JSON.parse(saved).assets[0].files).toHaveLength(3);
  await page
    .locator("canvas[data-engine]")
    .screenshot({ path: "test-results/model-original-texture.png" });
  await page.reload();
  await target(page);
  await sceneFile(page).setInputFiles({
    name: "textured-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(saved),
  });
  await expect
    .poll(() => page.evaluate(() => window.__HOLO_TEST__!.scene()[0]?.type))
    .toBe("model");
  await expect
    .poll(() =>
      page.evaluate(() => window.__HOLO_TEST__!.rendered?.()[0]?.roughness),
    )
    .toBe(0.5);
  expect(errors).toEqual([]);
});
async function importBox(
  page: Page,
  kind: "glb" | "gltf" | "dependent" = "glb",
) {
  const input = page.getByLabel("Model files", { exact: true });
  if (kind === "dependent")
    await input.setInputFiles([
      {
        name: "box.gltf",
        mimeType: "model/gltf+json",
        buffer: Buffer.from(fixture.dependent),
      },
      {
        name: "mesh.bin",
        mimeType: "application/octet-stream",
        buffer: fixture.bytes,
      },
    ]);
  else
    await input.setInputFiles({
      name: `box.${kind}`,
      mimeType: kind === "glb" ? "model/gltf-binary" : "model/gltf+json",
      buffer: kind === "glb" ? fixture.glb : Buffer.from(fixture.embedded),
    });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__HOLO_TEST__!.scene().some((o) => o.type === "model"),
      ),
    )
    .toBe(true);
}
async function emptyScene(page: Page) {
  await sceneFile(page).setInputFiles({
    name: "empty.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":1,"objects":[]}'),
  });
  await expect(page.locator(".scene-list button")).toHaveCount(0);
}
test("all presets render without shader errors; material controls, undo and saved values work", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/?testInput");
  await target(page);
  const shots: Buffer[] = [];
  for (const id of MATERIAL_IDS) {
    await page.getByLabel("Material", { exact: true }).selectOption(id);
    await expect
      .poll(() =>
        page.evaluate(() => window.__HOLO_TEST__!.scene()[0].material),
      )
      .toBe(id);
    await expect
      .poll(() =>
        page.evaluate(() => window.__HOLO_TEST__!.rendered?.()[0]?.roughness),
      )
      .toBe(MATERIAL_PRESETS[id].roughness);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    shots.push(
      await page
        .locator("canvas[data-engine]")
        .screenshot({ path: `test-results/material-${id}.png` }),
    );
  }
  expect(new Set(shots.map((b) => b.toString("base64"))).size).toBe(9);
  await page.getByLabel("Texture repeats per metre").fill("2");
  await page.getByLabel("Roughness", { exact: true }).fill("0.5");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.locator(".scene-list button").click();
  await expect(page.getByLabel("Roughness", { exact: true })).toHaveValue(
    "0.9",
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.locator(".scene-list button").click();
  await expect(page.getByLabel("Roughness", { exact: true })).toHaveValue(
    "0.5",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project" }).click();
  const file = await download;
  const saved = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(saved.objects[0].surface).toEqual({ textureScale: 2, roughness: 0.5 });
  await page.getByRole("button", { name: "Reset material defaults" }).click();
  await expect(page.getByLabel("Texture repeats per metre")).toHaveValue("1");
  expect(errors).toEqual([]);
});
test("textured and holographic surfaces render across all six shape geometries", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/?testInput");
  const start = await target(page);
  const objects = [
    {
      type: "floor",
      material: "wood",
      position: [-4, 0.1, -2],
      scale: [1, 1, 1],
    },
    { type: "wall", material: "brick", position: [0, 1, -3], scale: [1, 1, 1] },
    {
      type: "sphere",
      material: "polished-metal",
      position: [2, 0.5, 0],
      scale: [1, 1, 1],
    },
    {
      type: "cylinder",
      material: "glossy-plastic",
      position: [-2, 0.5, 2],
      scale: [1, 1, 1],
    },
    {
      type: "cube",
      material: "concrete",
      position: [0, 0.5, 2],
      scale: [1, 1, 1],
    },
    {
      type: "cone",
      material: "holographic",
      position: [2, 0.5, 2],
      scale: [1, 1, 1],
    },
  ].map((o, i) => ({
    ...start.object,
    ...o,
    id: `showcase-${i}`,
    name: o.type,
    color: "#ffffff",
  }));
  await sceneFile(page).setInputFiles({
    name: "showcase.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 1, objects })),
  });
  await expect
    .poll(() => page.evaluate(() => window.__HOLO_TEST__!.rendered?.().length))
    .toBe(6);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.screenshot({ path: "test-results/material-showcase.png" });
  expect(errors).toEqual([]);
});
test("lighting controls affect the rendered scene, reset and persist with project", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  await page.getByText("Studio lighting", { exact: true }).click();
  const before = await page.locator("canvas[data-engine]").screenshot();
  await page.getByLabel("ambient intensity").fill("0.2");
  await page.getByLabel("key intensity").fill("0.5");
  await page.getByLabel("fill intensity").fill("0");
  await page.getByLabel("environment intensity").fill("0.4");
  await page.getByLabel("Scene shadows").uncheck();
  expect(
    (await page.locator("canvas[data-engine]").screenshot()).equals(before),
  ).toBe(false);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project" }).click();
  const saved = await readFile((await (await download).path())!, "utf8");
  expect(JSON.parse(saved).lighting).toEqual({
    ambient: 0.2,
    key: 0.5,
    fill: 0,
    environment: 0.4,
    shadows: false,
  });
  await page.getByRole("button", { name: "Reset lighting" }).click();
  await expect(page.getByLabel("key intensity")).toHaveValue("2");
  await sceneFile(page).setInputFiles({
    name: "lighting.json",
    mimeType: "application/json",
    buffer: Buffer.from(saved),
  });
  await expect(page.getByLabel("key intensity")).toHaveValue("0.5");
});
for (const format of ["glb", "gltf", "dependent"] as const)
  test(`${format} imports through the editor, transforms, duplicates, deletes and undoes`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?testInput");
    await target(page);
    await emptyScene(page);
    await importBox(page, format);
    const o = await page.evaluate(() => window.__HOLO_TEST__!.scene()[0]);
    expect(o.type).toBe("model");
    expect(o.model!.size[1]).toBe(2);
    await page.getByLabel("position X", { exact: true }).fill("3");
    await page.getByLabel("rotation Y", { exact: true }).fill("45");
    await page.getByLabel("scale X", { exact: true }).fill("1.5");
    await page.getByLabel("Material", { exact: true }).selectOption("wood");
    await expect(
      page.getByLabel("Use original model materials"),
    ).not.toBeChecked();
    await page.getByLabel("Texture repeats per metre").fill("2");
    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
    await expect(page.locator(".scene-list button")).toHaveCount(2);
    await page
      .getByRole("button", { name: "Delete selected object", exact: true })
      .click();
    await expect(page.locator(".scene-list button")).toHaveCount(1);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.locator(".scene-list button")).toHaveCount(2);
    const copy = await page.evaluate(() => window.__HOLO_TEST__!.scene()[1]);
    expect(copy.model!.assetId).toBe(o.model!.assetId);
    expect(copy.surface!.textureScale).toBe(2);
    await page
      .locator("canvas[data-engine]")
      .screenshot({ path: `test-results/import-${format}.png` });
    expect(errors).toEqual([]);
  });
test("invalid files and external/missing references leave the scene and history intact", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  const input = page.getByLabel("Model files", { exact: true });
  for (const f of [
    { name: "wrong.obj", buffer: Buffer.from("no") },
    { name: "broken.glb", buffer: Buffer.from("invalid") },
    { name: "missing.gltf", buffer: Buffer.from(fixture.dependent) },
    {
      name: "remote.gltf",
      buffer: Buffer.from(
        fixture.dependent.replace("mesh.bin", "https://example.com/mesh.bin"),
      ),
    },
    { name: "large.glb", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) },
  ]) {
    await input.setInputFiles({ ...f, mimeType: "application/octet-stream" });
    await expect(page.locator("footer")).toContainText("Model import failed");
    expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual([
      start.object,
    ]);
    expect(
      (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
    ).toBe(0);
  }
});
test("model assets survive reload via IndexedDB and export into a fresh browser context", async ({
  page,
  browser,
}) => {
  await page.goto("/?testInput");
  await target(page);
  await emptyScene(page);
  await importBox(page, "dependent");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project" }).click();
  const saved = await readFile((await (await download).path())!, "utf8");
  expect(JSON.parse(saved).assets[0].files).toHaveLength(2);
  const metadata = await page.evaluate(() =>
    localStorage.getItem("holobuild.scene")!,
  );
  expect(JSON.parse(metadata).assets).toBeUndefined();
  expect(JSON.parse(metadata).assetStorage).toBe("indexedDB");
  const original = await page.evaluate(() => window.__HOLO_TEST__!.scene());
  await page.reload();
  await target(page);
  await page.getByRole("button", { name: "Restore local project" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__HOLO_TEST__!.scene()))
    .toEqual(original);
  const context = await browser.newContext({
    baseURL: new URL(page.url()).origin,
  });
  const fresh = await context.newPage();
  await fresh.goto("/?testInput");
  await target(fresh);
  await sceneFile(fresh).setInputFiles({
    name: "portable.json",
    mimeType: "application/json",
    buffer: Buffer.from(saved),
  });
  await expect
    .poll(() => fresh.evaluate(() => window.__HOLO_TEST__!.scene()))
    .toEqual(original);
  await fresh
    .locator("canvas[data-engine]")
    .screenshot({ path: "test-results/model-portable.png" });
  await context.close();
});
test("imported model ray selection, one-hand movement/release and undo use the shared controller", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  await emptyScene(page);
  await importBox(page);
  const start = await target(page);
  const base = (await page.evaluate(() => window.__HOLO_TEST__!.snapshot()))
    .history;
  await hold(page, poseAt("pointing", start.cursor));
  await hold(page, poseAt("pinch", start.cursor));
  await expect(page.locator(".gesture-cursor")).toHaveClass(/dragging/);
  const end = { x: start.cursor.x + 0.12, y: start.cursor.y };
  await hold(page, poseAt("pinch", end));
  await hold(page, poseAt("pointing", end));
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(base + 1);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene()[0])).position,
  ).not.toEqual(start.object.position);
  await hold(page, [], 50);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene()[0])).position,
  ).toEqual(start.object.position);
});
test("imported model two-hand scaling and rotation commit through normal history", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  await emptyScene(page);
  await importBox(page);
  const base = (await page.evaluate(() => window.__HOLO_TEST__!.snapshot()))
    .history;
  async function hands(distance: number, pinch: boolean, tilt = 0) {
    await page.evaluate(
      (hands) =>
        window.__HOLO_TEST__!.repeatHands(
          hands.map((landmarks) => ({ landmarks })),
        ),
      [
        poseAt(pinch ? "pinch" : "pointing", {
          x: 0.5 - distance / 2,
          y: 0.35 - tilt,
        }),
        poseAt(pinch ? "pinch" : "pointing", {
          x: 0.5 + distance / 2,
          y: 0.35 + tilt,
        }),
      ],
    );
    await page.clock.runFor(700);
  }
  await page.getByLabel("Gesture mode", { exact: true }).selectOption("scale");
  await hold(page, [], 50);
  await hands(0.25, false);
  await hands(0.25, true);
  await hands(0.4, true);
  await hands(0.4, false);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene()[0])).scale[0],
  ).toBeGreaterThan(1.4);
  await hold(page, [], 50);
  await page.getByLabel("Gesture mode", { exact: true }).selectOption("rotate");
  await hands(0.3, false);
  await hands(0.3, true);
  await hands(0.15, true, 0.12);
  await hands(0.15, false, 0.12);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene()[0])).rotation[1],
  ).toBeGreaterThan(0.5);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(base + 2);
});
