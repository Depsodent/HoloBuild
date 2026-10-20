/* global window */
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { smokeExploration } from "./smoke-exploration.mjs";
const url = process.env.HOLO_RELEASE_URL,
  scene = process.env.HOLO_REPLAY_SCENE;
assert.ok(url && scene, "Explicit URL and recorded scene required");
const data = await fs.readFile(scene),
  report = {
    testedAt: new Date().toISOString(),
    url,
    sourceCheckpoint: process.env.HOLO_SOURCE_SHA,
    recordedRealGeminiScene: true,
    sceneSha256: createHash("sha256").update(data).digest("hex"),
    providerCalls: 0,
    physicalDeviceTested: false,
    ok: false,
  };
const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  }),
  page = await browser.newPage({ viewport: { width: 1440, height: 960 } }),
  errors = [];
page.setDefaultTimeout(20000);
page.on("pageerror", () => errors.push("pageerror"));
page.on("request", (r) => {
  if (
    r.method() === "POST" &&
    /\/api\/planner\/(assistant|plan|edit)$/.test(new URL(r.url()).pathname)
  )
    report.providerCalls++;
});
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.locator("canvas[data-engine]")).toBeVisible();
  assert.equal(
    await page.evaluate(() => typeof window.__HOLO_TEST__),
    "undefined",
  );
  await page.locator("input[type=file][accept='.json']").setInputFiles({
    name: "recorded-gemini-house.json",
    mimeType: "application/json",
    buffer: data,
  });
  await expect(page.locator("footer .status")).toContainText(
    "Replace complete.",
  );
  report.checks = await smokeExploration(page);
  assert.equal(report.providerCalls, 0);
  assert.deepEqual(errors, []);
  report.pageErrors = 0;
  report.ok = true;
} catch (e) {
  report.error = e.message;
  process.exitCode = 1;
  await page
    .screenshot({ path: ".cache/m13-exploration-replay-failed.png" })
    .catch(() => {});
} finally {
  await browser.close();
  await fs.writeFile(
    ".cache/m13-public-exploration-replay.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
