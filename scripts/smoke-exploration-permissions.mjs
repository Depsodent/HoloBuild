/* global window */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
const url = process.env.HOLO_RELEASE_URL || "http://127.0.0.1:5182";
const publicRun = new URL(url).protocol === "https:";
const report = {
  testedAt: new Date().toISOString(),
  url,
  sourceCheckpoint: process.env.HOLO_SOURCE_SHA,
  syntheticRecognition: true,
  physicalDeviceTested: false,
  providerCalls: 0,
  ok: false,
};
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }),
  errors = [];
page.on("pageerror", () => errors.push("pageerror"));
page.on("request", (r) => {
  if (
    r.method() === "POST" &&
    /\/api\/planner\/(assistant|plan|edit)$/.test(new URL(r.url()).pathname)
  )
    report.providerCalls++;
});
async function saved() {
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  return JSON.parse(await fs.readFile(await (await d).path(), "utf8"));
}
try {
  await page.addInitScript(() => {
    window.__permissionRelease = { starts: 0, requests: 0, finish: null };
    const w = window.__permissionRelease;
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: {
        query: () =>
          new Promise((resolve) => {
            w.requests++;
            w.finish = () => resolve({ state: "prompt" });
          }),
      },
    });
    class Fake {
      onstart = null;
      onend = null;
      onresult = null;
      onerror = null;
      start() {
        w.starts++;
        this.onstart?.();
      }
      stop() {
        this.onresult?.({
          resultIndex: 0,
          results: [
            {
              isFinal: true,
              0: { transcript: "Add a window to the selected wall." },
            },
          ],
        });
      }
      abort() {}
    }
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: Fake,
    });
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.locator("canvas[data-engine]")).toBeVisible();
  assert.equal(
    await page.evaluate(() => typeof window.__HOLO_TEST__),
    "undefined",
  );
  const base = await saved();
  await page.getByRole("tab", { name: "AI", exact: true }).click();
  for (const [i, mode] of ["Walkthrough", "Presentation"].entries()) {
    await page
      .getByRole("button", { name: "Start listening", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => window.__permissionRelease.requests))
      .toBe(i + 1);
    await page
      .getByRole("button", { name: "Enter " + mode, exact: true })
      .click();
    if (i === 1)
      await page
        .getByRole("button", { name: "Exit Presentation", exact: true })
        .click();
    const starts = await page.evaluate(async () => {
      window.__permissionRelease.finish();
      await Promise.resolve();
      await Promise.resolve();
      return window.__permissionRelease.starts;
    });
    assert.equal(
      starts,
      0,
      "Stale permission result started hidden/unrequested capture",
    );
    if (i === 0)
      await page
        .getByRole("button", { name: "Return to editor", exact: true })
        .click();
  }
  await page
    .getByRole("button", { name: "Start listening", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__permissionRelease.requests))
    .toBe(3);
  await page.evaluate(() => window.__permissionRelease.finish());
  await expect(page.getByLabel("Listening status")).toHaveText("Listening…");
  await page
    .getByRole("button", { name: "Stop listening", exact: true })
    .click();
  await expect(page.getByLabel("Ask HoloBuild", { exact: true })).toHaveValue(
    "Add a window to the selected wall.",
  );
  await expect(page.getByLabel("Listening status")).toHaveText(
    "Final transcript ready.",
  );
  assert.deepEqual((await saved()).objects, base.objects);
  assert.deepEqual(errors, []);
  assert.equal(report.providerCalls, 0);
  Object.assign(report, {
    ok: true,
    lateResultDuringWalkingIgnored: true,
    lateResultAfterPresentationExitIgnored: true,
    deliberateRestartWorks: true,
    stopPreservesActualFinalResult: true,
    sceneUnchanged: true,
    pageErrors: 0,
  });
} catch (e) {
  report.error = e.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  await fs.writeFile(
    ".cache/m12-" + (publicRun ? "public" : "local") + "-permission-smoke.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}

