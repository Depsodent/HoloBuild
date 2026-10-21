import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { smokeFurniture131 } from "./smoke-furniture131.mjs";
const url = process.env.HOLO_RELEASE_URL,
  input = process.env.HOLO_REPLAY_SCENE;
assert.ok(url && input, "Explicit release URL and recorded scene required");
const scene = JSON.parse(await fs.readFile(input, "utf8"));
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", () => errors.push("pageerror"));
const report = {
  testedAt: new Date().toISOString(),
  url,
  sourceCheckpoint: process.env.HOLO_SOURCE_SHA,
  providerCalls: 0,
  physicalDeviceTested: false,
  ok: false,
};
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.locator("canvas[data-engine]")).toBeVisible();
  await page
    .locator('input[type=file][accept=".json"]')
    .setInputFiles({
      name: "recorded-gemini-house.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(scene)),
    });
  await expect(page.locator("footer .status")).toContainText(
    "Replace complete.",
  );
  report.checks = await smokeFurniture131(page);
  assert.deepEqual(errors, []);
  report.pageErrors = 0;
  report.ok = true;
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
  await page
    .screenshot({ path: ".cache/m131-furniture-replay-failed.png" })
    .catch(() => {});
} finally {
  await browser.close();
  await fs.writeFile(
    process.env.HOLO_REPLAY_REPORT ?? ".cache/m131-furniture-replay.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
