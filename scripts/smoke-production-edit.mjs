// One opt-in real Gemini edit through the production UI; no development bridge.
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
if (process.env.HOLO_LIVE_GEMINI !== "1")
  throw Error("Explicit live-test opt-in required.");
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }),
  errors = [];
page.on("pageerror", () => errors.push("pageerror"));
async function saved() {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  return JSON.parse(await fs.readFile(await (await pending).path(), "utf8"));
}
async function ask(text) {
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
}
try {
  await page.goto(process.env.HOLO_PREVIEW_URL || "http://127.0.0.1:5176");
  await expect(page.locator("canvas[data-engine]")).toBeVisible();
  await page.getByRole("tab", { name: "AI", exact: true }).click();
  await page
    .getByLabel("Planner mode", { exact: true })
    .selectOption("offline");
  await ask("Build a house without doors");
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  const before = await saved();
  assert.ok(
    before.objects.some(
      (o) => o.construction?.role === "wall" && o.material !== "brick",
    ),
  );
  await page.getByLabel("Planner mode", { exact: true }).selectOption("llm");
  const started = performance.now();
  await ask("Change all walls to brick");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible({ timeout: 45000 });
  const previewMs = performance.now() - started;
  await expect(
    page.getByLabel("Edit planner source", { exact: true }),
  ).toContainText("LLM");
  assert.deepEqual((await saved()).objects, before.objects);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const after = await saved();
  const walls = after.objects.filter((o) => o.construction?.role === "wall");
  assert.ok(walls.length);
  assert.ok(walls.every((o) => o.material === "brick"));
  assert.deepEqual(
    after.objects.filter((o) => o.construction?.role !== "wall"),
    before.objects.filter((o) => o.construction?.role !== "wall"),
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual((await saved()).objects, before.objects);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  assert.deepEqual((await saved()).objects, after.objects);
  assert.deepEqual(errors, []);
  const configuration = await (
    await page.request.get(
      (process.env.HOLO_PREVIEW_URL || "http://127.0.0.1:5176") +
        "/api/planner/status",
    )
  ).json();
  assert.equal(
    configuration.model,
    process.env.HOLO_GEMINI_MODEL || "gemini-3.5-flash-lite",
  );
  const report = {
    testedAt: new Date().toISOString(),
    productionBuild: true,
    realGeminiEdit: true,
    model: configuration.model,
    previewMs,
    inertPreview: true,
    wallsChanged: walls.length,
    otherObjectsPreserved: true,
    oneStepExactUndo: true,
    exactRedo: true,
    pageErrors: 0,
    hostedDeploymentTested: (process.env.HOLO_PREVIEW_URL || "").startsWith(
      "https://",
    ),
  };
  await fs.writeFile(
    process.env.HOLO_REPORT_PATH || "docs/GEMINI_EDIT_VALIDATION.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.log(
    JSON.stringify({
      editResult: await page
        .getByLabel("Structure edit result", { exact: true })
        .allTextContents(),
      activity: await page
        .getByLabel("Planner activity", { exact: true })
        .allTextContents(),
    }),
  );
  console.error(
    "Production edit smoke failed: " + String(error.message).slice(0, 500),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
