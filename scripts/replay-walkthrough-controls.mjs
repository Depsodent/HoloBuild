/* global window */
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { smokeWalkthroughControls } from "./smoke-walkthrough-controls.mjs";
const url = process.env.HOLO_RELEASE_URL;
assert.ok(url, "Explicit production-build URL required");
const report = {
  testedAt: new Date().toISOString(),
  url,
  sourceCheckpoint: process.env.HOLO_SOURCE_SHA,
  providerCalls: 0,
  physicalDeviceTested: false,
  ok: false,
};
const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  }),
  page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", () => errors.push("pageerror"));
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.locator("canvas[data-engine]")).toBeVisible();
  assert.equal(
    await page.evaluate(() => typeof window.__HOLO_TEST__),
    "undefined",
  );
  report.checks = await smokeWalkthroughControls(page);
  assert.deepEqual(errors, []);
  report.pageErrors = 0;
  report.ok = true;
} catch (e) {
  report.error = e.message;
  process.exitCode = 1;
  await page
    .screenshot({ path: ".cache/controls-replay-failed.png" })
    .catch(() => {});
} finally {
  await browser.close();
  await fs.writeFile(
    process.env.HOLO_CONTROLS_REPORT ?? ".cache/controls-replay.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
