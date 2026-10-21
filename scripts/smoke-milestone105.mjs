/* global window */
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
if (process.env.HOLO_LIVE_GEMINI !== "1")
  throw Error("Explicit opt-in required for real Gemini release verification.");
const base = process.env.HOLO_RELEASE_URL || "http://127.0.0.1:5182",
  name = base.startsWith("https:") ? "public" : "local",
  milestone =
    process.env.HOLO_MILESTONE === "13.1"
      ? "m131"
      : process.env.HOLO_MILESTONE === "13"
        ? "m13"
        : process.env.HOLO_EXPLORATION_SMOKE === "1"
          ? "m12"
          : process.env.HOLO_PRECISION_SMOKE === "1"
            ? "m11"
            : "m105";
const report = {
  testedAt: new Date().toISOString(),
  url: base,
  baseCheckpoint:
    process.env.HOLO_SOURCE_SHA || "29a7717961374efa3bc7db1da257bdea1e6e3f9f",
  source:
    milestone === "m131"
      ? "Milestone 13.1 production-build release validation"
      : milestone === "m13"
        ? "Milestone 13 production-build release validation"
        : milestone === "m12"
          ? "Milestone 12 production-build release validation"
          : milestone === "m11"
            ? "Milestone 11 production-build release validation"
            : "Milestone 10.5 release validation",
  physicalDeviceTested: false,
  ok: false,
  checks: {},
  provider: [],
};
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", () => errors.push("pageerror"));
async function saved() {
  const next = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  return JSON.parse(await fs.readFile(await (await next).path(), "utf8"));
}
async function ask(text) {
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
}
async function exactHistory(before, after) {
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual((await saved()).objects, before.objects);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  assert.deepEqual((await saved()).objects, after.objects);
}
async function modelAsk(text) {
  const n = await page.evaluate(() => window.__release105.length);
  await ask(text);
  await page.waitForFunction((n) => window.__release105.length > n, n, {
    timeout: 45000,
  });
  const terminal = await page.evaluate(() => window.__release105.at(-1));
  report.provider.push({
    event: terminal.event,
    requestId: terminal.data.requestId,
    provider: terminal.data.provider,
    model: terminal.data.model,
    kind: terminal.data.plan?.kind,
    errorKind: terminal.data.kind,
    timings: terminal.data.timings,
  });
  console.log(JSON.stringify(report.provider.at(-1)));
  assert.equal(
    terminal.event,
    "result",
    "Planner error " +
      terminal.data.kind +
      " (" +
      terminal.data.requestId +
      ")",
  );
  assert.equal(terminal.data.provider, "Gemini");
  return terminal.data.plan;
}
try {
  await page.addInitScript(() => {
    window.__release105 = [];
    const original = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const r = await original(...args);
      if (/\/api\/planner\/(assistant|edit|plan)$/.test(String(args[0]))) {
        void r
          .clone()
          .text()
          .then((text) => {
            for (const block of text.replace(/\r/g, "").split("\n\n"))
              if (/^event: (result|error)/.test(block)) {
                window.__release105.push({
                  event: block.split("\n")[0].slice(7),
                  data: JSON.parse(
                    block
                      .split("\n")
                      .filter((l) => l.startsWith("data:"))
                      .map((l) => l.slice(5).trim())
                      .join("\n"),
                  ),
                });
              }
            if (!r.headers.get("content-type")?.includes("event-stream"))
              window.__release105.push({
                event: r.ok ? "result" : "error",
                data: JSON.parse(text),
              });
          })
          .catch(() =>
            window.__release105.push({
              event: "error",
              data: { kind: "capture" },
            }),
          );
      }
      return r;
    };
  });
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert.equal(
    await page.evaluate(() => typeof window.__HOLO_TEST__),
    "undefined",
  );
  await expect(page.locator("canvas[data-engine]")).toBeVisible();
  await page.getByRole("tab", { name: "AI", exact: true }).click();
  await page.getByRole("button", { name: "AI Settings", exact: true }).click();
  await page.getByLabel("Planner mode", { exact: true }).selectOption("llm");
  await page.getByRole("button", { name: "Request", exact: true }).click();
  const before = await saved();
  let plan = await modelAsk(
    "generate a 2 story house including a balcony and stairs",
  );
  if (plan.kind === "clarify")
    plan = await modelAsk(
      "Put interior stairs on the left, connecting ground floor level 0 to second floor level 1, yaw 0. Use a centered front balcony at level 1 offset 0 with aligned access door, plus a separate centered front entry on level 0. Use 6m width/depth, 3m storey height, flat roof and valid default dimensions/materials.",
    );
  assert.equal(
    plan.kind,
    "create",
    "Expected actual design, not an acknowledgement",
  );
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  assert.deepEqual((await saved()).objects, before.objects);
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  const built = await saved(),
    parts = built.objects.filter((o) => o.construction),
    template = parts[0].construction.structure.template;
  assert.equal(template.floors, 2);
  assert.ok(template.stairs.length);
  assert.ok(template.balconies.length);
  const stair = template.stairs[0],
    balcony = template.balconies[0],
    access = template.openings.find((o) => o.id === balcony.access);
  assert.equal(stair.from, 0);
  assert.equal(stair.to, 1);
  assert.ok(
    Math.abs(stair.steps * stair.rise - (template.height + 0.2)) < 1e-6,
  );
  assert.equal(
    parts.filter((o) => o.construction.role === "stair").length,
    stair.steps,
  );
  assert.equal(
    parts.filter((o) => o.construction.role === "balcony").length,
    8,
  );
  assert.equal(
    parts.filter(
      (o) => o.construction.role === "floor" && o.construction.level === 1,
    ).length,
    4,
  );
  for (const key of ["level", "facade", "offset"])
    assert.equal(access[key], balcony[key]);
  assert.ok(
    parts.some(
      (o) =>
        o.construction.role === "door" && o.construction.opening === access.id,
    ),
  );
  assert.deepEqual(
    built.objects.filter((o) => !o.construction),
    before.objects,
  );
  await exactHistory(before, built);
  report.checks.creation = {
    inertPreview: true,
    parts: parts.length,
    stairSteps: stair.steps,
    upperFloorVoid: true,
    balconyParts: 8,
    alignedRealAccess: true,
    unrelatedCubePreserved: true,
    exactUndoRedo: true,
  };
  const group = parts[0].construction.structureId;
  const roofTone =
    built.objects
      .find((o) => o.construction?.role === "roof")
      .color.toLowerCase() === "#008080"
      ? "indigo"
      : "teal";
  const editPlan = await modelAsk(
    "Could you make the roof a shade of " +
      roofTone +
      " while keeping the rest of this same house as it is?",
  );
  assert.equal(editPlan.kind, "edit");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  assert.deepEqual((await saved()).objects, built.objects);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const edited = await saved();
  await fs.writeFile(
    ".cache/m105-real-after-roof.json",
    JSON.stringify(edited),
  );
  assert.equal(edited.objects.length, built.objects.length);
  for (const o of edited.objects) {
    const old = built.objects.find((p) => p.id === o.id);
    assert.ok(old);
    for (const k of ["position", "rotation", "scale", "material"])
      assert.deepEqual(o[k], old[k]);
    if (o.construction?.role !== "roof") assert.equal(o.color, old.color);
  }
  assert.ok(
    edited.objects
      .filter((o) => o.construction?.role === "roof")
      .every((o) => o.color !== built.objects.find((p) => p.id === o.id).color),
  );
  assert.equal(
    new Set(
      edited.objects
        .filter((o) => o.construction)
        .map((o) => o.construction.structureId),
    ).size,
    1,
  );
  assert.ok(
    edited.objects
      .filter((o) => o.construction)
      .every((o) => o.construction.structureId === group),
  );
  await exactHistory(built, edited);
  if (milestone === "m13")
    await page.screenshot({ path: ".cache/m13-" + name + "-generated.png" });
  report.checks.genuineConversationalEdit = {
    sameStructure: true,
    inertPreview: true,
    unrelatedComponentsPreserved: true,
    exactUndoRedo: true,
  };
  const stairMaterial =
      edited.objects.find((o) => o.construction?.role === "stair").material ===
      "wood"
        ? "concrete"
        : "wood",
    stairMaterialRequest =
      "Make the stairs " + (stairMaterial === "wood" ? "wooden" : "concrete");
  await ask(stairMaterialRequest);
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  assert.deepEqual((await saved()).objects, edited.objects);
  await page
    .getByRole("button", { name: "Cancel structure edit", exact: true })
    .click();
  assert.deepEqual((await saved()).objects, edited.objects);
  await ask(stairMaterialRequest);
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const wooden = await saved();
  assert.ok(
    wooden.objects
      .filter((o) => o.construction?.role === "stair")
      .every((o) => o.material === stairMaterial),
  );
  await exactHistory(edited, wooden);
  report.checks.staircaseConversation = {
    material: stairMaterial,
    cancel: true,
    inertPreview: true,
    exactUndoRedo: true,
  };
  const panel = wooden.objects.find(
    (o) =>
      o.construction?.opening === access.id && o.construction.role === "door",
  );
  await page.getByLabel("Selection mode").selectOption("component");
  await page.getByRole("tab", { name: "Collection", exact: true }).click();
  await page.getByLabel("Search scene objects").fill(panel.name);
  await page
    .locator(".scene-list button")
    .filter({ hasText: panel.name })
    .first()
    .click();
  await page.getByRole("tab", { name: "Inspector", exact: true }).click();
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await expect(
    page.getByLabel("Opening Inspector", { exact: true }),
  ).toBeVisible();
  const width =
    Number(
      await page.getByLabel("Opening width", { exact: true }).inputValue(),
    ) + 0.1;
  await page.getByLabel("Opening width", { exact: true }).fill(String(width));
  await page
    .getByRole("button", { name: "Preview opening change", exact: true })
    .click();
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  assert.deepEqual((await saved()).objects, wooden.objects);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const opened = await saved(),
    afterRecipe = opened.objects.find((o) => o.construction).construction
      .structure.template;
  assert.ok(
    Math.abs(
      afterRecipe.openings.find((o) => o.id === access.id).width - width,
    ) < 1e-8,
  );
  assert.equal(
    opened.objects.find(
      (o) =>
        o.construction?.opening === access.id && o.construction.role === "door",
    ).id,
    panel.id,
  );
  assert.deepEqual(
    afterRecipe.stairs,
    wooden.objects.find((o) => o.construction).construction.structure.template
      .stairs,
  );
  assert.deepEqual(afterRecipe.balconies, template.balconies);
  await exactHistory(wooden, opened);
  report.checks.editableOpening = {
    partInspector: true,
    panelIdPreserved: true,
    realAccessRetained: true,
    stairAndBalconyRecipesPreserved: true,
    exactUndoRedo: true,
  };
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.locator("input[type=file][accept='.json']").setInputFiles({
    name: "milestone105.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(opened)),
  });
  await expect(page.locator(".status")).toContainText("Replace complete.");
  assert.deepEqual((await saved()).objects, opened.objects);
  await exactHistory(wooden, opened);
  report.checks.saveLoad = {
    allArchitecturalMetadata: true,
    exactObjects: true,
    undoRedoLoad: true,
  };
  if (process.env.HOLO_PRECISION_SMOKE === "1")
    report.checks.precision = await (
      await import("./smoke-precision.mjs")
    ).smokePrecision(page);
  if (process.env.HOLO_LIBRARY_SMOKE === "1")
    report.checks.library = await (
      await import("./smoke-library.mjs")
    ).smokeLibrary(page);
  if (process.env.HOLO_EXPLORATION_SMOKE === "1")
    report.checks.exploration = await (
      await import("./smoke-exploration.mjs")
    ).smokeExploration(page);
  if (process.env.HOLO_FURNITURE_SMOKE === "1")
    report.checks.furniture = await (
      await import("./smoke-furniture131.mjs")
    ).smokeFurniture131(page, modelAsk);
  await page.locator("canvas[data-engine]").hover();
  await page.mouse.wheel(0, 500);
  await page.screenshot({
    path: ".cache/" + milestone + "-" + name + "-scene.png",
  });
  assert.deepEqual(errors, []);
  report.checks.pageErrors = 0;
  report.ok = true;
} catch (error) {
  report.error = error instanceof Error ? error.message : "Smoke failed";
  process.exitCode = 1;
  await page
    .screenshot({ path: ".cache/" + milestone + "-" + name + "-failed.png" })
    .catch(() => {});
  report.safeNetwork = await page
    .evaluate(() =>
      window.__release105?.map((x) => ({
        event: x.event,
        kind: x.data.kind,
        requestId: x.data.requestId,
        message: x.data.error,
        planKind: x.data.plan?.kind,
      })),
    )
    .catch(() => []);
} finally {
  await browser.close();
  await fs.writeFile(
    ".cache/" + milestone + "-" + name + "-workflow.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}
