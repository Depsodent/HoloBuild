import { showLeft } from "../helpers/workspaceTools";
import {
  showTools,
  showGestureSettings,
  openWorkspaceSection,
} from "../helpers/workspaceTools";
import { test, expect, type Page } from "@playwright/test";
import { hold, poseAt, target } from "../helpers/gestureInput";
async function open(page: Page, key: string) {
  await openWorkspaceSection(page, key);
}
async function pair(
  page: Page,
  a: { x: number; y: number },
  b: { x: number; y: number },
  first: boolean,
  second: boolean,
  ms = 650,
) {
  await page.evaluate(
    (hands) =>
      window.__HOLO_TEST__!.repeatHands(
        hands.map((landmarks) => ({ landmarks })),
      ),
    [
      poseAt(first ? "pinch" : "pointing", a),
      poseAt(second ? "pinch" : "pointing", b),
    ],
  );
  await page.clock.runFor(ms);
}
async function camera(page: Page, fallback = false, worker = false) {
  await page.addInitScript(
    ({ fallback, worker }) => {
      localStorage.setItem(
        "holobuild.camera-execution.v1",
        worker ? "worker" : "main",
      );
      if (fallback) {
        Object.defineProperty(
          HTMLVideoElement.prototype,
          "requestVideoFrameCallback",
          { value: undefined, configurable: true },
        );
        Object.defineProperty(window, "Worker", {
          value: undefined,
          configurable: true,
        });
      }
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async () => {
          const c = document.createElement("canvas");
          c.width = 640;
          c.height = 480;
          const ctx = c.getContext("2d")!;
          let frame = 0;
          const timer = setInterval(() => {
            ctx.fillStyle = `rgb(${frame++ % 100},20,30)`;
            ctx.fillRect(0, 0, c.width, c.height);
          }, 100);
          const stream = c.captureStream(10);
          for (const track of stream.getTracks()) {
            const stop = track.stop.bind(track);
            track.stop = () => {
              clearInterval(timer);
              stop();
              document.documentElement.dataset.cameraStopped = "true";
            };
          }
          return stream;
        },
      });
    },
    { fallback, worker },
  );
}
test("accordion defaults, keyboard expansion, independent persistence and compact layout work", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  await showLeft(page, "inspector");
  const materials = page.locator('[data-accordion-key="inspector.appearance"]'),
    transform = page.locator('[data-accordion-key="inspector.transform"]');
  expect(await materials.getAttribute("open")).toBeNull();
  expect(await transform.getAttribute("open")).not.toBeNull();
  await materials.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Material", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Object color", { exact: true })).toBeVisible();
  const height = (await transform.boundingBox())!.height;
  await transform.locator("summary").click();
  await expect(
    page.getByLabel("position X", { exact: true }),
  ).not.toBeVisible();
  expect((await transform.boundingBox())!.height).toBeLessThan(height - 100);
  await page.reload();
  await target(page);
  await expect(page.getByLabel("Material", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Object color", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("position X", { exact: true }),
  ).not.toBeVisible();
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene()[0])).position,
  ).toEqual(start.object.position);
  await page.screenshot({ path: "test-results/milestone-71-accordions.png" });
});
test("one-hand selection survives scale/rotate switching and staggered pinches need no new ray hit", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  await open(page, "tools.transform");
  await open(page, "inspector.collection");
  await page.keyboard.press("Escape");
  await hold(page, poseAt("pointing", start.cursor));
  await hold(page, poseAt("pinch", start.cursor));
  await hold(page, poseAt("pointing", start.cursor));
  await expect(page.locator(".scene-list button.selected")).toContainText(
    "Cube",
  );
  await showGestureSettings(page);
  await page.getByLabel("Gesture mode", { exact: true }).selectOption("scale");
  await expect(page.locator(".scene-list button.selected")).toContainText(
    "Cube",
  );
  await hold(page, [], 50);
  const a = { x: 0.2, y: 0.32 },
    b = { x: 0.8, y: 0.32 };
  await hold(page, poseAt("pointing", a));
  await expect(page.locator(".interaction-status")).toContainText(
    "Waiting for second hand",
  );
  await hold(page, poseAt("pinch", a));
  await pair(page, a, b, true, false);
  await pair(page, a, b, true, true);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).preview
      ?.scale![0],
  ).toBeCloseTo(1, 1);
  await pair(page, { x: 0.25, y: 0.32 }, { x: 0.75, y: 0.32 }, true, true);
  await pair(page, { x: 0.25, y: 0.32 }, { x: 0.75, y: 0.32 }, false, false);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(1);
  await hold(page, [], 50);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene()[0])).scale,
  ).toEqual(start.object.scale);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await showLeft(page, "collection");
  await page.locator(".scene-list button").click();
  await showGestureSettings(page);
  await page.getByLabel("Gesture mode", { exact: true }).selectOption("rotate");
  await hold(page, [], 50);
  await pair(page, { x: 0.35, y: 0.35 }, { x: 0.65, y: 0.35 }, false, false);
  await pair(page, { x: 0.35, y: 0.35 }, { x: 0.65, y: 0.35 }, true, true);
  await pair(page, { x: 0.425, y: 0.23 }, { x: 0.575, y: 0.47 }, true, true);
  await pair(page, { x: 0.425, y: 0.23 }, { x: 0.575, y: 0.47 }, false, false);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(2);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene()[0])).rotation[1],
  ).toBeGreaterThan(0.5);
});
test("unselected objects can be pinched once in Rotate mode and panel clicks cancel active previews", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  await open(page, "tools.transform");
  await open(page, "inspector.collection");
  await page.keyboard.press("Escape");
  await showGestureSettings(page);
  await page.getByLabel("Gesture mode", { exact: true }).selectOption("rotate");
  await hold(page, poseAt("pointing", start.cursor));
  await hold(page, poseAt("pinch", start.cursor));
  await expect(page.locator(".scene-list button.selected")).toContainText(
    "Cube",
  );
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).preview,
  ).toBeNull();
  await hold(page, [], 50);
  const a = { x: 0.35, y: 0.35 },
    b = { x: 0.65, y: 0.35 };
  await pair(page, a, b, false, false);
  await pair(page, a, b, true, true);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).preview,
  ).not.toBeNull();
  await showTools(page, "build");
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).preview,
  ).toBeNull();
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(0);
  await pair(page, a, b, true, true);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).preview,
  ).toBeNull();
});
test("camera metrics, live quality, hidden preview and emergency Stop remain usable", async ({
  page,
}) => {
  test.setTimeout(90000);
  await camera(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.locator(".camera-meta")).toContainText(/[1-9]\d* Hz/, {
    timeout: 60000,
  });
  await open(page, "camera.settings");
  await page.getByLabel("Tracking quality").selectOption("performance");
  await expect(page.getByLabel("Tracking quality")).toHaveValue("performance");
  await page
    .getByRole("button", { name: "Toggle Gesture Diagnostics", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand Gesture Diagnostics", exact: true })
    .click();
  await expect(page.getByText("Inference rate", { exact: true })).toBeVisible();
  await expect(page.locator(".diagnostics-body")).toContainText(
    "main-thread CPU",
  );
  await page
    .getByRole("button", { name: "Minimize Gesture Input", exact: true })
    .click();
  const before = await page
    .locator("video")
    .evaluate((v: HTMLVideoElement) => v.currentTime);
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeGreaterThan(before + 0.3);
  await page
    .getByRole("button", { name: "Collapse left sidebar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop camera", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-camera-stopped",
    "true",
  );
});
test("unsupported worker/video callbacks fall back to CPU with honest unavailable measurements", async ({
  page,
}) => {
  test.setTimeout(90000);
  await camera(page, true, true);
  await page.goto("/");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.locator(".camera-meta")).toContainText(/[1-9]\d* Hz/, {
    timeout: 60000,
  });
  await page
    .getByRole("button", { name: "Toggle Gesture Diagnostics", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand Gesture Diagnostics", exact: true })
    .click();
  await expect(page.locator(".diagnostics-body")).toContainText(
    "worker unavailable",
  );
  await expect(page.locator(".diagnostics-body")).toContainText(
    "requestAnimationFrame fallback",
  );
  await expect(page.locator(".diagnostics-body")).toContainText("unavailable");
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
});
