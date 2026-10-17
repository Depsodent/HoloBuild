/* global window */
// Opt-in real local provider smoke; excluded from automatic regression suites.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:5175/?testInput");
  await page.waitForFunction(() => !!window.__HOLO_TEST__?.project);
  await page.getByRole("tab", { name: "AI", exact: true }).click();
  await page.getByLabel("Planner mode").selectOption("llm");
  const before = await page.evaluate(() => window.__HOLO_TEST__.scene()),
    start = Date.now();
  await page
    .getByLabel("Ask HoloBuild", { exact: true })
    .fill(
      "Build a small platform consisting of a single concrete floor slab, 4 m by 4 m and 0.2 m thick. No supports, walls or extra parts.",
    );
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  const preview = page.getByLabel("Construction plan preview", { exact: true });
  await preview
    .or(page.getByLabel("Generation result"))
    .first()
    .waitFor({ state: "visible", timeout: 130000 });
  await expect(preview).toBeVisible();
  const elapsedMs = Date.now() - start;
  await expect(page.getByLabel("Planner source")).toContainText("Ollama · LLM");
  assert.deepEqual(
    await page.evaluate(() => window.__HOLO_TEST__.scene()),
    before,
  );
  const measured = await page.evaluate(async () => {
    const r = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/generation/plannerTransport.ts"));
    return (await import(r.name)).usePlannerProgress.getState();
  });
  await page.screenshot({
    path: "test-results/live-generation-preview.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  await expect(page.getByLabel("Selection mode")).toHaveValue("structure");
  await expect(
    page.getByRole("button", { name: "Edit Structure", exact: true }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(() => window.__HOLO_TEST__.snapshot().history),
    1,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(
    await page.evaluate(() => window.__HOLO_TEST__.scene()),
    before,
  );
  assert.deepEqual(errors, []);
  const result = {
    ok: true,
    provider: measured.provider,
    elapsedMs,
    timings: measured.timings,
    atomicHistory: true,
    undoRestored: true,
    pageErrors: errors,
    physicalWebcamTested: false,
  };
  await writeFile(
    "test-results/live-generation-result.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} catch (error) {
  const message = await page
    .getByLabel("Generation result")
    .textContent()
    .catch(() => "No result");
  await writeFile(
    "test-results/live-generation-result.json",
    JSON.stringify(
      {
        ok: false,
        message,
        sceneUnchanged:
          (await page.evaluate(() => window.__HOLO_TEST__.scene().length)) ===
          1,
        physicalWebcamTested: false,
      },
      null,
      2,
    ),
  );
  console.error(
    await page
      .getByLabel("Generation result")
      .textContent()
      .catch(() => "No result"),
  );
  await page.screenshot({
    path: "test-results/live-generation-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}
