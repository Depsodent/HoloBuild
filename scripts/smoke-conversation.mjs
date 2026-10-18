/* global window */
// Opt-in local production-build acceptance. Never prints prompts, credentials or raw streams.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
if (process.env.HOLO_LIVE_GEMINI !== "1")
  throw Error("Explicit live-test opt-in required.");
const base = process.env.HOLO_PREVIEW_URL || "http://127.0.0.1:5176";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
  throw Error("This pre-publication smoke is restricted to localhost.");
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", () => errors.push("pageerror"));
const report = {
  testedAt: new Date().toISOString(),
  url: base,
  browser: await browser.version(),
  physicalDeviceTested: false,
  publicDeploymentTested: false,
  steps: [],
  providerRequests: [],
};
await page.addInitScript(() => {
  const original = window.fetch;
  window.__safeReceipts = [];
  window.fetch = async (...args) => {
    const r = await original(...args);
    if (/\/api\/planner\/(?:plan|edit)$/.test(String(args[0]))) {
      void r
        .clone()
        .text()
        .then((body) => {
          if (body.length > 1048576) return;
          for (const event of body.split("\n\n")) {
            if (!/^event: (?:result|error)/.test(event)) continue;
            const data = JSON.parse(event.slice(event.indexOf("data: ") + 6));
            window.__safeReceipts.push({
              path: String(args[0]).split("/").at(-1),
              http: r.status,
              event: event.split("\n")[0],
              requestId: data.requestId,
              provider: data.provider,
              model: data.model,
              timings: data.timings,
              error: data.error,
              kind: data.kind,
              operation: data.plan?.operation?.type,
            });
          }
        });
    }
    return r;
  };
});
async function ask(text) {
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
}
async function save() {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  return JSON.parse(await fs.readFile(await (await pending).path(), "utf8"));
}
async function mode(value) {
  await page.getByRole("button", { name: "AI Settings", exact: true }).click();
  await page.getByLabel("Planner mode", { exact: true }).selectOption(value);
  await page.getByRole("button", { name: "Request", exact: true }).click();
}
async function history(before, after) {
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual((await save()).objects, before.objects);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  assert.deepEqual((await save()).objects, after.objects);
}
try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await expect(page.locator("canvas[data-engine]")).toBeVisible();
  assert.equal(
    await page.evaluate(() => typeof window.__HOLO_TEST__),
    "undefined",
  );
  await page.getByRole("tab", { name: "AI", exact: true }).click();
  await expect(
    page.getByLabel("Planner mode", { exact: true }),
  ).not.toBeVisible();
  await ask(
    "Build a two-story modern house with yellow walls, a purple wooden door, six windows, three on each floor, and a pink roof.",
  );
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  const before = await save();
  await ask("Yes.");
  const detailed = await save();
  const parts = detailed.objects.filter((o) => o.construction);
  assert.equal(parts.filter((o) => o.construction.role === "window").length, 6);
  for (const level of [0, 1])
    assert.equal(
      parts.filter(
        (o) =>
          o.construction.role === "window" && o.construction.level === level,
      ).length,
      3,
    );
  assert.ok(
    parts
      .filter((o) => o.construction.role === "wall")
      .every((o) => o.color === "#f5d76e"),
  );
  assert.equal(
    parts.find((o) => o.construction.role === "door").material,
    "wood",
  );
  assert.equal(
    parts.find((o) => o.construction.role === "door").color,
    "#aa79df",
  );
  assert.equal(
    parts.find((o) => o.construction.role === "roof").color,
    "#f18db5",
  );
  await history(before, detailed);
  report.steps.push(
    "Exact detailed design, confirmation, atomic history and production save UI",
  );
  const group = parts[0].construction.structureId;
  await ask("Give it a blue roof and larger windows");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  assert.deepEqual((await save()).objects, detailed.objects);
  await ask("Looks good");
  const refined = await save();
  assert.ok(
    refined.objects
      .filter(
        (o) =>
          o.construction?.structureId === group &&
          o.construction.role === "roof",
      )
      .every((o) => o.color === "#508ee8"),
  );
  await history(detailed, refined);
  report.steps.push("Compound refinement, same structure and exact history");
  await ask("Make the building wider");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  await ask("Perfect");
  const wider = await save();
  await history(refined, wider);
  await ask("Move the entrance to the left");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  await ask("Cancel");
  assert.deepEqual((await save()).objects, wider.objects);
  report.steps.push("Width, entrance preview and cancellation");
  await mode("llm");
  const start = performance.now();
  await ask("Build a small house with four walls and a roof");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible({ timeout: 45000 });
  const generationPreviewMs = Math.round(performance.now() - start);
  await expect(page.getByLabel("Planner source")).toContainText("Gemini");
  const preAI = await save();
  await ask("Yes");
  const generated = await save();
  assert.ok(generated.objects.length > preAI.objects.length);
  await history(preAI, generated);
  report.steps.push({
    name: "Real Gemini generation, validation, confirmation and exact history",
    previewMs: generationPreviewMs,
    elapsedMs: Math.round(performance.now() - start),
  });
  await page
    .getByRole("button", { name: "Edit Structure", exact: true })
    .click();
  await page.getByRole("tab", { name: "AI", exact: true }).click();
  const editStart = performance.now();
  await ask("Move the entire structure half a metre towards the east");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible({ timeout: 45000 });
  const editPreviewMs = Math.round(performance.now() - editStart);
  await expect(page.getByLabel("Edit planner source")).toContainText(
    "LLM edit",
  );
  assert.deepEqual((await save()).objects, generated.objects);
  await ask("Yes");
  const edited = await save();
  assert.notDeepEqual(edited.objects, generated.objects);
  await history(generated, edited);
  report.steps.push({
    name: "Real Gemini contextual flexible edit and exact history",
    previewMs: editPreviewMs,
    elapsedMs: Math.round(performance.now() - editStart),
  });
  report.providerRequests = await page.evaluate(() => window.__safeReceipts);
  assert.equal(report.providerRequests.length, 2);
  assert.ok(
    report.providerRequests.every(
      (r) => r.event === "event: result" && r.provider === "Gemini",
    ),
  );
  assert.deepEqual(errors, []);
  report.ok = true;
  report.pageErrors = errors;
  await page.screenshot({
    path: ".cache/milestone104-production-chat.png",
    fullPage: true,
  });
} catch (error) {
  report.ok = false;
  report.failure = error instanceof Error ? error.message : "Smoke failed";
  report.providerRequests = await page
    .evaluate(() => window.__safeReceipts)
    .catch(() => []);
  report.pageErrors = errors;
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    "docs/MILESTONE_104_LOCAL_GEMINI.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
