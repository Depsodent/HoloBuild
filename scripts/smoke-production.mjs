// Run after the serial regression suite. HOLO_LIVE_GEMINI=1 authorizes one live UI request.
/* global window */
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
if (process.env.HOLO_LIVE_GEMINI !== "1")
  throw Error("Explicit live-test opt-in required.");
const base = process.env.HOLO_PREVIEW_URL || "http://127.0.0.1:5176";
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }),
  errors = [];
page.on("pageerror", () => errors.push("pageerror"));
const assets = [];
let generationRequests = 0;
page.on("request", (request) => {
  if (
    request.url().endsWith("/api/planner/plan") &&
    request.method() === "POST"
  )
    generationRequests++;
});
async function saved() {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const download = await pending;
  return JSON.parse(await fs.readFile(await download.path(), "utf8"));
}
async function tab(name) {
  await page.getByRole("tab", { name, exact: true }).click();
}
try {
  await page.goto(base + "/?testInput");
  await expect(page.locator("canvas[data-engine]")).toBeVisible();
  assert.equal(
    await page.evaluate(() => typeof window.__HOLO_TEST__),
    "undefined",
  );
  for (const asset of [
    "/vision/hand_landmarker.task",
    "/vision/wasm/vision_wasm_internal.wasm",
    "/vision/wasm/vision_wasm_internal.js",
    "/third-party-notices/index.json",
  ]) {
    const r = await page.request.get(base + asset);
    assert.equal(r.status(), 200);
    const mime = r.headers()["content-type"];
    if (asset.endsWith(".wasm")) assert.match(mime, /application\/wasm/);
    assets.push({ path: asset, status: r.status(), contentType: mime });
  }
  const status = await (
    await page.request.get(base + "/api/planner/status")
  ).json();
  assert.equal(status.provider, "Gemini");
  assert.equal(
    status.model,
    process.env.HOLO_GEMINI_MODEL || "gemini-3.5-flash-lite",
  );
  const before = await saved();
  await tab("AI");
  await page.getByLabel("Planner mode", { exact: true }).selectOption("llm");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Ask HoloBuild", { exact: true })
    .fill(
      "Build a small platform with one concrete floor slab 4 x 0.2 x 4 meters centered at [0,0.1,0], and one centered white cube column 1 x 1 x 1 meters resting on it at [0,0.7,0]. Exactly these two connected parts, no template metadata, no other parts.",
    );
  const started = performance.now();
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible({ timeout: 45000 });
  const previewMs = performance.now() - started;
  await expect(
    page.getByLabel("Planner source", { exact: true }),
  ).toContainText("Gemini");
  assert.deepEqual((await saved()).objects, before.objects);
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toHaveCount(0);
  const after = await saved();
  assert.equal(after.objects.length, before.objects.length + 2);
  console.log("Production: real preview and confirmation passed.");
  await tab("Inspector");
  await expect(
    page.getByLabel("Structure Inspector", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual((await saved()).objects, before.objects);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  assert.deepEqual((await saved()).objects, after.objects);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual((await saved()).objects, before.objects);
  await page.locator("input[type=file][accept='.json']").setInputFiles({
    name: "smoke-scene.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(after)),
  });
  await expect(page.locator(".status")).not.toContainText("Loading");
  assert.deepEqual((await saved()).objects, after.objects);
  await tab("AI");
  await page.getByRole("button", { name: "AI Settings", exact: true }).click();
  console.log("Production: exact Undo/Redo and portable Save/Load passed.");
  const timings = await page
    .getByLabel("Planner timings", { exact: true })
    .innerText();
  await tab("Scene");
  await page
    .getByRole("button", { name: "Fit structure in view", exact: true })
    .click();
  await tab("Build");
  await fs.mkdir("docs/images", { recursive: true });
  await page.screenshot({ path: "docs/images/workspace.png" });
  // Inject one backend outage to exercise explicit Auto fallback in the actual bundle.
  await page.route("**/api/planner/plan", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Injected offline smoke outage." }),
    }),
  );
  await tab("AI");
  await page.getByRole("button", { name: "Request", exact: true }).click();
  await page.getByLabel("Planner mode", { exact: true }).selectOption("auto");
  await page
    .getByLabel("Ask HoloBuild", { exact: true })
    .fill("Build a small house without doors");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Planner source", { exact: true }),
  ).toContainText("Offline fallback");
  assert.deepEqual((await saved()).objects, after.objects);
  await page
    .getByRole("button", { name: "Cancel generation", exact: true })
    .click();
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toHaveCount(0);
  assert.deepEqual((await saved()).objects, after.objects);
  console.log("Production: explicit Offline fallback and cancellation passed.");
  assert.deepEqual(errors, []);
  assert.equal(generationRequests, 2);
  const report = {
    testedAt: new Date().toISOString(),
    url: base,
    productionBuild: true,
    developmentBridgeAbsent: true,
    sameOriginEndpoints: true,
    provider: status.provider,
    model: status.model,
    realGeminiUI: true,
    previewMs,
    partsAdded: after.objects.length - before.objects.length,
    inertPreview: true,
    oneStepExactUndo: true,
    exactRedo: true,
    portableSaveLoad: true,
    pageErrors: errors.length,
    generationRequests,
    liveModelRequests: 1,
    injectedOutageRequests: 1,
    explicitOfflineFallback: true,
    fallbackCancelPreservesScene: true,
    timings,
    assets,
    physicalWebcamOrMicrophoneRetested: false,
    hostedDeploymentTested: false,
  };
  await fs.writeFile(
    "docs/PRODUCTION_VALIDATION.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.log(
    JSON.stringify({
      generationResult: await page
        .getByLabel("Generation result", { exact: true })
        .allTextContents(),
      activity: await page
        .getByLabel("Planner activity", { exact: true })
        .allTextContents(),
      commandResult: await page
        .getByLabel("Command result", { exact: true })
        .allTextContents(),
      generationRequests,
    }),
  );
  await fs.mkdir("playwright-report", { recursive: true });
  await page
    .screenshot({ path: "playwright-report/production-smoke-failure.png" })
    .catch(() => {});
  console.error(
    "Production smoke did not pass: " + String(error.message).slice(0, 500),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
