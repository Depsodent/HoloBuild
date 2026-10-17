/* global document */
import { chromium } from "@playwright/test";
import fs from "node:fs";
(async () => {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: process.argv.includes("--hardware")
      ? []
      : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    await page.addInitScript(
      (execution) => {
        localStorage.setItem("holobuild.camera-execution.v1", execution);
        Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
          value: async () => {
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext("2d");
            let n = 0;
            setInterval(() => {
              ctx.fillStyle = `rgb(${n++ % 100},20,30)`;
              ctx.fillRect(0, 0, 640, 480);
            }, 1000 / 30);
            return canvas.captureStream(30);
          },
        });
      },
      process.argv.includes("--auto")
        ? "auto"
        : process.argv.includes("--gpu")
          ? "gpu"
          : process.argv.includes("--worker")
            ? "worker"
            : "main",
    );
    await page.goto(process.env.HOLOBUILD_URL || "http://127.0.0.1:5175/");
    await page
      .getByRole("button", { name: "Start camera", exact: true })
      .click();
    await page.waitForFunction(
      async () => {
        const entry = performance
          .getEntriesByType("resource")
          .find((e) => e.name.includes("/src/vision/performanceStore.ts"));
        if (!entry) return false;
        return (
          (await import(entry.name)).usePerformanceStore.getState()
            .inferenceHz > 0
        );
      },
      {},
      { timeout: 60000 },
    );
    await page.waitForTimeout(10000);
    const metrics = await page.evaluate(async (hardwareRequested) => {
      const entry = performance
        .getEntriesByType("resource")
        .find((e) => e.name.includes("/src/vision/performanceStore.ts"));
      const gl = document
        .querySelector("canvas[data-engine]")
        .getContext("webgl2");
      const extension = gl?.getExtension("WEBGL_debug_renderer_info");
      return {
        ...(await import(entry.name)).usePerformanceStore.getState(),
        graphics: {
          renderer: gl?.getParameter(gl.RENDERER),
          reportedRenderer: extension
            ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
            : null,
          userAgent: navigator.userAgent,
          hardwareRequested,
        },
      };
    }, process.argv.includes("--hardware"));
    console.log(JSON.stringify(metrics, null, 2));
    const output = process.argv.indexOf("--output");
    if (output >= 0 && process.argv[output + 1])
      fs.writeFileSync(
        process.argv[output + 1],
        JSON.stringify(metrics, null, 2),
      );
    await page
      .getByRole("button", { name: "Stop camera", exact: true })
      .click();
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
