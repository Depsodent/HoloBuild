/* global window */
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { Color, SRGBColorSpace } from "three";
if (process.env.HOLO_LIVE_GEMINI !== "1")
  throw Error("Explicit opt-in required");
const base = "http://127.0.0.1:5176";
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const report = {
  testedAt: new Date().toISOString(),
  url: base,
  browser: await browser.version(),
  physicalDeviceTested: false,
  public1041Tested: false,
  contexts: [],
  ok: false,
};
let activePage;
async function saved(page) {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  return JSON.parse(await fs.readFile(await (await event).path(), "utf8"));
}
async function ask(page, text) {
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
}
async function history(page, before, after) {
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual((await saved(page)).objects, before.objects);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  assert.deepEqual((await saved(page)).objects, after.objects);
}
async function capture(page) {
  const errors = [];
  page.on("pageerror", () => errors.push("pageerror"));
  await page.addInitScript(() => {
    const original = window.fetch;
    window.__safe1041 = [];
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (String(args[0]).endsWith("/api/planner/assistant")) {
        void response
          .clone()
          .text()
          .then((text) => {
            if (text.length > 1048576) return;
            for (const block of text.split("\n\n"))
              if (/^event: (?:result|error)/.test(block)) {
                const data = JSON.parse(
                  block.slice(block.indexOf("data: ") + 6),
                );
                window.__safe1041.push({
                  http: response.status,
                  event: block.split("\n")[0],
                  requestId: data.requestId,
                  provider: data.provider,
                  model: data.model,
                  kind: data.plan?.kind,
                  timings: data.timings,
                  error: data.error,
                });
              }
          });
      }
      return response;
    };
  });
  return errors;
}
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await ctx.newPage();
  activePage = page;
  page.setDefaultTimeout(20000);
  const errors = await capture(page);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  assert.equal(
    await page.evaluate(() => typeof window.__HOLO_TEST__),
    "undefined",
  );
  await page.getByRole("tab", { name: "AI", exact: true }).click();
  const before = await saved(page);
  const start = performance.now();
  await ask(
    page,
    "I'd like a modern two-storey villa with yellow walls, a purple wooden door, six windows, three on each floor, and a pink roof.",
  );
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible({ timeout: 45000 });
  const previewMs = Math.round(performance.now() - start);
  await expect(page.getByLabel("Planner source")).toContainText("Gemini");
  await expect(page.getByLabel("Planner source")).toContainText(
    "interpreted design",
  );
  assert.deepEqual((await saved(page)).objects, before.objects);
  await ask(page, "Yes");
  const built = await saved(page);
  const parts = built.objects.filter((o) => o.construction);
  assert.equal(parts.filter((o) => o.construction.role === "window").length, 6);
  assert.equal(
    new Set(
      parts
        .filter((o) => o.construction.role === "floor")
        .map((o) => o.position[1]),
    ).size,
    2,
  );
  for (const level of [0, 1])
    assert.equal(
      parts.filter(
        (o) =>
          o.construction.role === "window" && o.construction.level === level,
      ).length,
      3,
    );
  assert.equal(
    parts.find((o) => o.construction.role === "door").material,
    "wood",
  );
  for (const [role, low, high] of [
    ["wall", 0.1, 0.2],
    ["door", 0.7, 0.87],
    ["roof", 0.88, 1],
  ]) {
    assert.ok(
      parts
        .filter((o) => o.construction.role === role)
        .every((o) => {
          const c = new Color(o.color).getHSL(
            { h: 0, s: 0, l: 0 },
            SRGBColorSpace,
          );
          return c.s > 0.2 && c.h >= low && c.h <= high;
        }),
      role + " must retain its requested display color",
    );
  }
  await history(page, before, built);
  const group = parts[0].construction.structureId;
  for (const text of [
    "Make its roof blue",
    "Add three windows to the second floor",
    "Make the entire house wider",
  ]) {
    const pre = await saved(page);
    await ask(page, text);
    await expect(
      page.getByLabel("Structure modification preview", { exact: true }),
    ).toBeVisible();
    assert.deepEqual((await saved(page)).objects, pre.objects);
    await ask(page, "Looks good");
    const post = await saved(page);
    assert.equal(
      new Set(
        post.objects
          .filter((o) => o.construction)
          .map((o) => o.construction.structureId),
      ).size,
      1,
    );
    assert.equal(
      post.objects.find((o) => o.construction).construction.structureId,
      group,
    );
    await history(page, pre, post);
  }
  const final = await saved(page);
  assert.equal(
    final.objects.filter(
      (o) => o.construction?.role === "window" && o.construction.level === 1,
    ).length,
    6,
  );
  assert.equal(
    final.objects.find((o) => o.construction?.role === "roof").color,
    "#508ee8",
  );
  await ask(page, "I'm done");
  await expect(
    page.getByRole("log", { name: "Design conversation" }),
  ).toContainText("design is complete");
  assert.deepEqual(errors, []);
  report.contexts.push({
    scenario:
      "Genuine Gemini flexible detailed interpretation, same-structure roof/window/width refinements, confirmation and exact history",
    previewMs,
    provider: await page.evaluate(() => window.__safe1041),
    pageErrors: errors,
  });
  await page.screenshot({
    path: ".cache/milestone1041-live-chat.png",
    fullPage: true,
  });
  await ctx.close();
  const ctx2 = await browser.newContext();
  const p = await ctx2.newPage();
  activePage = p;
  p.setDefaultTimeout(20000);
  const errors2 = await capture(p);
  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p.getByRole("tab", { name: "Collection", exact: true }).click();
  await p.locator(".scene-list button").first().click();
  await p.getByRole("tab", { name: "AI", exact: true }).click();
  const initial = await saved(p);
  const begin = performance.now();
  await ask(p, "Could the selected cube be only half as tall?");
  await expect(
    p.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible({ timeout: 45000 });
  assert.deepEqual((await saved(p)).objects, initial.objects);
  await ask(p, "Yes");
  const resized = await saved(p);
  assert.equal(resized.objects.length, initial.objects.length);
  assert.equal(resized.objects[0].id, initial.objects[0].id);
  assert.ok(resized.objects[0].scale[1] < initial.objects[0].scale[1]);
  await history(p, initial, resized);
  assert.deepEqual(errors2, []);
  report.contexts.push({
    scenario:
      "Fresh context, genuine Gemini Part resize, preview, confirmation and exact history",
    elapsedMs: Math.round(performance.now() - begin),
    provider: await p.evaluate(() => window.__safe1041),
    pageErrors: errors2,
  });
  await ctx2.close();
  assert.ok(
    report.contexts.every(
      (c) =>
        c.provider.length === 1 &&
        c.provider[0].event === "event: result" &&
        c.provider[0].provider === "Gemini",
    ),
  );
  report.ok = true;
} catch (error) {
  const failedPage = activePage;
  if (failedPage)
    report.diagnostics = {
      url: failedPage.url(),
      input: await failedPage
        .getByLabel("Ask HoloBuild", { exact: true })
        .inputValue()
        .catch(() => "absent"),
      text: await failedPage
        .locator("body")
        .innerText()
        .then((s) => s.slice(-2400))
        .catch(() => "unavailable"),
      generation: await failedPage
        .getByLabel("Generation result")
        .allTextContents(),
      reply: await failedPage
        .getByRole("log", { name: "Design conversation" })
        .locator("p.assistant")
        .last()
        .textContent()
        .catch(() => ""),
      requests: await failedPage
        .evaluate(() => window.__safe1041)
        .catch(() => []),
    };
  report.error =
    error instanceof Error ? error.message : "Live validation failed";
  process.exitCode = 1;
} finally {
  await browser.close();
  await fs.writeFile(
    "docs/MILESTONE_1041_LOCAL_GEMINI.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
