// Opt-in public live test; each fresh browser performs one generation, no physical devices.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
if (process.env.HOLO_LIVE_GEMINI !== "1")
  throw Error("Explicit live opt-in required.");
const base = process.env.HOLO_PREVIEW_URL || "https://holobuild.vercel.app";
const results = [];
for (const channel of process.env.HOLO_BROWSER === "msedge"
  ? ["msedge"]
  : ["msedge", undefined]) {
  const browser = await chromium.launch({
    ...(channel ? { channel } : {}),
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  let stage = "open";
  const errors = [];
  page.on("pageerror", () => errors.push("pageerror"));
  try {
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await expect(page.locator("canvas[data-engine]")).toBeVisible();
    const registrations = await page.evaluate(async () =>
      "serviceWorker" in navigator
        ? (await navigator.serviceWorker.getRegistrations()).length
        : 0,
    );
    await page.getByRole("tab", { name: "AI", exact: true }).click();
    await page.getByLabel("Planner mode", { exact: true }).selectOption("llm");
    await page
      .getByLabel("Ask HoloBuild", { exact: true })
      .fill("Build a small house with four walls and a roof");
    const responsePending = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/planner/plan") &&
        r.request().method() === "POST",
    );
    const started = performance.now();
    await page
      .getByRole("button", { name: "Send request", exact: true })
      .click();
    stage = "response";
    const response = await responsePending;
    await expect(
      page.getByLabel("Construction plan preview", { exact: true }),
    ).toBeVisible({ timeout: 45000 });
    const previewMs = performance.now() - started;
    assert.equal(response.status(), 200);
    async function saved() {
      const pending = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Save project", exact: true })
        .click();
      return JSON.parse(
        await fs.readFile(await (await pending).path(), "utf8"),
      );
    }
    stage = "save-before";
    const before = await saved();
    await page
      .getByRole("button", { name: "Confirm construction", exact: true })
      .click();
    stage = "save-after";
    const after = await saved();
    assert.ok(after.objects.length > before.objects.length);
    stage = "undo";
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    assert.deepEqual((await saved()).objects, before.objects);
    stage = "redo";
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    assert.deepEqual((await saved()).objects, after.objects);
    assert.deepEqual(errors, []);
    results.push({
      browser: channel || "bundled Chromium",
      version: browser.version(),
      freshProfile: true,
      httpStatus: response.status(),
      requestId: response.headers()["x-request-id"],
      vercelId: response.headers()["x-vercel-id"],
      previewMs,
      partsAdded: after.objects.length - before.objects.length,
      exactUndoRedo: true,
      pageErrors: 0,
      serviceWorkerRegistrations: registrations,
      passed: true,
    });
  } catch (error) {
    await page
      .screenshot({
        path:
          ".cache/cross-browser-" + (channel || "chromium") + "-failure.png",
      })
      .catch(() => {});
    results.push({
      stage,
      failure: String(error.message).split("\n")[0].slice(0, 250),
      browser: channel || "bundled Chromium",
      version: browser.version(),
      passed: false,
      result: (
        await page.getByLabel("Generation result").allTextContents()
      ).map((x) => x.slice(0, 500)),
      pageErrors: errors.length,
    });
  } finally {
    await browser.close();
  }
}
const report = {
  testedAt: new Date().toISOString(),
  url: base,
  sameLaptop: true,
  sameNetwork: true,
  physicalFriendDeviceTested: false,
  microphoneTested: false,
  results,
};
await fs.writeFile(
  "docs/CROSS_BROWSER_PRODUCTION_VALIDATION.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (results.some((r) => !r.passed)) process.exitCode = 1;
