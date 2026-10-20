/* global window, document */
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { gzipSync } from "node:zlib";
const label = process.env.HOLO_BENCHMARK_LABEL || "before",
  base = process.env.HOLO_BENCHMARK_URL || "http://127.0.0.1:5175";
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.setDefaultTimeout(30000);
const report = {
  capturedAt: new Date().toISOString(),
  label,
  url: base,
  renderer: "Headless Edge SwiftShader; not physical laptop/GPU performance",
  samples: {},
};
try {
  await page.addInitScript(() => {
    const active = new Map(),
      key = (t, e) => (t === window ? "window" : "document") + ":" + e;
    const add = EventTarget.prototype.addEventListener,
      remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (
      type,
      listener,
      options,
    ) {
      if (
        (this === window || this === document) &&
        [
          "keydown",
          "keyup",
          "blur",
          "visibilitychange",
          "pointerlockchange",
          "pointerlockerror",
          "mousemove",
        ].includes(type)
      ) {
        const k = key(this, type);
        if (!active.has(k)) active.set(k, new Set());
        active.get(k).add(listener);
      }
      return add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (
      type,
      listener,
      options,
    ) {
      active.get(key(this, type))?.delete(listener);
      return remove.call(this, type, listener, options);
    };
    const resources = { buffers: 0, textures: 0 };
    for (const C of [
      window.WebGLRenderingContext,
      window.WebGL2RenderingContext,
    ])
      if (C)
        for (const [type, name] of [
          ["buffers", "Buffer"],
          ["textures", "Texture"],
        ])
          for (const [verb, delta] of [
            ["create", 1],
            ["delete", -1],
          ]) {
            const method = verb + name;
            if (!Object.prototype.hasOwnProperty.call(C.prototype, method))
              continue;
            const original = C.prototype[method];
            C.prototype[method] = function (...args) {
              const result = original.apply(this, args);
              if (
                (verb === "create" && result) ||
                (verb === "delete" && args[0])
              )
                resources[type] += delta;
              return result;
            };
          }
    window.__workspaceBenchmark = () => ({
      listeners: Object.fromEntries(
        [...active.entries()].map(([k, v]) => [k, v.size]),
      ),
      resources: { ...resources },
    });
  });
  await page.goto(base + "/?testInput");
  await page.waitForFunction(() => !!window.__HOLO_TEST__?.view);
  async function sample(name) {
    const frames = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const a = [],
            start = performance.now();
          let previous = start;
          function frame(t) {
            a.push(t - previous);
            previous = t;
            if (t - start < 3000) window.requestAnimationFrame(frame);
            else
              resolve({
                frames: a.length,
                seconds: (t - start) / 1000,
                medianMs: a.sort((x, y) => x - y)[Math.floor(a.length / 2)],
              });
          }
          window.requestAnimationFrame(frame);
        }),
    );
    report.samples[name] = {
      ...(await page.evaluate(() => window.__workspaceBenchmark())),
      navigationBuilds: await page.evaluate(() => window.__HOLO_TEST__?.view?.().navigationBuilds ?? null),
      renderFrames: frames,
    };
  }
  async function saved() {
    const d = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Save project", exact: true })
      .click();
    return JSON.parse(await fs.readFile(await (await d).path(), "utf8"));
  }
  async function load(data) {
    await page.locator("input[type=file][accept='.json']").setInputFiles({
      name: "benchmark.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
    await expect(page.locator("footer .status")).toContainText(
      "Replace complete.",
    );
  }
  const original = await saved();
  await sample("oneCube");
  const many = {
    ...original,
    objects: Array.from({ length: 100 }, (_, i) => ({
      ...original.objects[0],
      id: crypto.randomUUID(),
      name: "Benchmark " + i,
      position: [(i % 10) * 2 - 10, 0.5, Math.floor(i / 10) * 2 - 10],
    })),
  };
  await load(many);
  await sample("hundredCubes");
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole("button", { name: "Enter Walkthrough", exact: true })
      .click();
    const legacy = page.getByRole("button", {
      name: "Return to editor",
      exact: true,
    });
    await (
      (await legacy.count())
        ? legacy
        : page.getByRole("button", { name: "Exit Walkthrough", exact: true })
    ).click();
  }
  await sample("afterFiveTransitions");
  await load(original);
  await sample("restoredOneCube");
  report.sceneRestored =
    (await saved()).objects.length === original.objects.length;
  const assets = await fs.readdir("dist/assets");
  report.bundles = [];
  for (const f of assets.filter((f) => f.endsWith(".js"))) {
    const b = await fs.readFile("dist/assets/" + f);
    report.bundles.push({
      file: f,
      bytes: b.length,
      gzipBytes: gzipSync(b).length,
    });
  }
} catch (e) {
  report.error = e.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  await fs.writeFile(
    ".cache/m13-benchmark-" + label + ".json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
