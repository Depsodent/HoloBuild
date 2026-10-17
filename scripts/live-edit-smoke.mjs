/* global window */
// Explicit manual smoke: uses the configured real local model; never runs in the automated suite.
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("test-results", { recursive: true });
const open = async (id) => {
  if (id === "tools.voice") {
    await page.getByRole("tab", { name: "AI", exact: true }).click();
    return;
  }
  if (id === "tools.ai-settings")
    await page
      .getByRole("button", { name: "AI Settings", exact: true })
      .click();
  const panel = page.locator(`[data-accordion-key="${id}"]`);
  if ((await panel.getAttribute("open")) === null)
    await panel.locator(":scope > summary").click();
};
const ask = async (text) => {
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
};
const scene = () => page.evaluate(() => window.__HOLO_TEST__.scene());
try {
  await page.goto("http://127.0.0.1:5175/?testInput");
  await page.waitForFunction(() => !!window.__HOLO_TEST__?.project);
  await open("tools.voice");
  await ask("Build a house without doors");
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  await ask("Select the whole house");
  await expect(
    page.getByLabel("Structure Inspector", { exact: true }),
  ).toBeVisible();
  await open("tools.ai-settings");
  await page
    .getByRole("button", { name: "Check model connection", exact: true })
    .click();
  await expect(page.getByLabel("Model connection", { exact: true })).toHaveText(
    "connected",
    { timeout: 15000 },
  );
  await page.getByLabel("Planner timeout seconds", { exact: true }).fill("120");
  await page.getByLabel("Planner mode", { exact: true }).selectOption("llm");
  const before = await scene(),
    history = await page.evaluate(
      () => window.__HOLO_TEST__.snapshot().history,
    ),
    start = Date.now();
  const pending = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/planner/edit") && r.request().method() === "POST",
  );
  await ask("Replace every wall of the whole house with brick");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible({ timeout: 130000 });
  const response = await pending;
  assert.match(response.headers()["content-type"], /text\/event-stream/);
  // Chromium does not retain EventSource response bodies for CDP getResponseBody.
  // Read the actual application telemetry populated by its validated stream parser.
  const measured = await page.evaluate(async () => {
    const resource = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/generation/plannerTransport.ts"));
    return (await import(resource.name)).usePlannerProgress.getState();
  });
  assert.equal(measured.provider, "Ollama");
  assert.equal(measured.stage, "Preview Ready");
  assert.ok(measured.timings.firstTokenMs >= 0);
  const elapsedMs = Date.now() - start,
    source = await page.getByLabel("Edit planner source").textContent();
  assert.match(source, /LLM edit.*qwen3:4b-instruct/);
  assert.deepEqual(await scene(), before);
  await page
    .getByLabel("Structure modification preview", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/live-edit-preview.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const after = await scene();
  assert.ok(
    after
      .filter((o) => o.construction?.role === "wall")
      .every((o) => o.material === "brick"),
  );
  assert.deepEqual(after[0], before[0]);
  assert.equal(
    await page.evaluate(() => window.__HOLO_TEST__.snapshot().history),
    history + 1,
  );
  await page.screenshot({
    path: "test-results/live-edit-confirmed.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await scene(), before);
  assert.deepEqual(errors, []);
  const result = {
    ok: true,
    source,
    elapsedMs,
    timings: measured.timings,
    finalStage: measured.stage,
    components: before.filter((o) => o.construction).length,
    atomicHistory: true,
    undoRestored: true,
    pageErrors: errors,
    physicalWebcamTested: false,
  };
  await writeFile(
    "test-results/live-edit-result.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} catch (error) {
  await page.screenshot({
    path: "test-results/live-edit-failure.png",
    fullPage: true,
  });
  console.error(
    await page
      .getByLabel("Structure edit result")
      .textContent()
      .catch(() => "No edit result"),
  );
  throw error;
} finally {
  await browser.close();
}
