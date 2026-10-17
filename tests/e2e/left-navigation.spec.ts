import { test, expect } from "@playwright/test";
import { showLeft, showTools } from "../helpers/workspaceTools";
import { target } from "../helpers/gestureInput";
test("left navigation is exclusive, searchable, keyboard accessible and persistent", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  await expect(
    page.getByRole("tab", { name: "Gesture", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".inspector-section")).toBeHidden();
  await page.getByRole("tab", { name: "Gesture", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Inspector", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".inspector-section")).toBeVisible();
  await expect(page.getByLabel("Gesture camera")).toBeHidden();
  await page.keyboard.press("End");
  await expect(page.getByLabel("Search scene objects")).toBeVisible();
  await page.getByLabel("Search scene objects").fill("missing");
  await expect(page.locator(".scene-list button")).toHaveCount(0);
  await page.getByLabel("Search scene objects").fill("cube");
  await expect(page.locator(".scene-list button")).toHaveCount(1);
  await page.locator(".scene-list button").click();
  await expect(
    page.getByRole("tab", { name: "Inspector", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Inspector", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
test("structure Collection resolves real groups and component selection", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  await showTools(page, "ai");
  await page
    .getByLabel("Ask HoloBuild", { exact: true })
    .fill("Build a house without doors");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  await showLeft(page, "collection");
  await page.getByLabel("Selection mode").selectOption("component");
  await page.getByLabel("Search scene objects").fill("roof");
  await expect(page.locator(".scene-list details")).toHaveCount(1);
  await page.locator(".scene-list details button").last().click();
  await expect(page.locator(".inspector h2")).toContainText(/roof/i);
  await expect(
    page.getByRole("tab", { name: "Inspector", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
test("camera keeps the same live stream and inference across tabs, Stop stays accessible", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    localStorage.setItem("holobuild.camera-execution.v1", "main");
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d")!;
        let n = 0;
        setInterval(() => {
          ctx.fillStyle = `rgb(${n++ % 100},20,30)`;
          ctx.fillRect(0, 0, 640, 480);
        }, 100);
        const stream = canvas.captureStream(10);
        (window as unknown as { originalStream: MediaStream }).originalStream =
          stream;
        return stream;
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.locator(".camera-message")).toContainText(
    "Local tracking",
    { timeout: 60000 },
  );
  for (const tab of ["inspector", "collection", "gesture"] as const) {
    await showLeft(page, tab);
    await expect
      .poll(() =>
        page
          .locator("video")
          .evaluate(
            (v: HTMLVideoElement) =>
              v.srcObject ===
                (window as unknown as { originalStream: MediaStream })
                  .originalStream &&
              (v.srcObject as MediaStream).getTracks()[0].readyState === "live",
          ),
      )
      .toBe(true);
    if (tab !== "gesture")
      await expect(
        page.getByRole("button", { name: "Stop sidebar camera", exact: true }),
      ).toBeVisible();
  }
  await showLeft(page, "collection");
  await page.evaluate(async () => {
    const entry = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/vision/landmarkStream.ts"));
    if (!entry) throw Error("Camera landmark stream missing");
    document.documentElement.dataset.tabCameraResults = "0";
    const { landmarkStream } = await import(entry.name);
    landmarkStream.subscribe((frame: { source?: string }) => {
      if (frame.source === "camera")
        document.documentElement.dataset.tabCameraResults = String(
          Number(document.documentElement.dataset.tabCameraResults) + 1,
        );
    });
  });
  await expect
    .poll(
      () =>
        page
          .locator("html")
          .getAttribute("data-tab-camera-results")
          .then(Number),
      { timeout: 15000 },
    )
    .toBeGreaterThan(3);
  const time = await page
    .locator("video")
    .evaluate((v: HTMLVideoElement) => v.currentTime);
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeGreaterThan(time + 0.2);
  await page
    .getByRole("button", { name: "Stop sidebar camera", exact: true })
    .click();
  await expect(page.locator("video")).toHaveJSProperty("srcObject", null);
});

test("delegate preferences persist without claiming an active GPU before Start", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator('[data-accordion-key="camera.settings"] > summary')
    .click();
  const delegate = page.getByLabel("MediaPipe delegate", { exact: true });
  await expect(delegate).toHaveValue("auto");
  await delegate.selectOption("gpu");
  await expect(page.getByLabel("Active MediaPipe delegate")).toHaveText(
    "Active: off",
  );
  await page.reload();
  await expect(delegate).toHaveValue("gpu");
  await delegate.selectOption("main");
  await page.reload();
  await expect(delegate).toHaveValue("main");
  await delegate.selectOption("auto");
  await page.getByLabel("Tracking quality").selectOption("performance");
  await page.reload();
  await expect(page.getByLabel("Tracking quality")).toHaveValue("performance");
});

test("floating Gesture Input keeps its workspace position across left tabs", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  await page
    .getByRole("button", { name: "Undock Gesture Input", exact: true })
    .click();
  const camera = page.getByLabel("Gesture camera", { exact: true });
  const before = await camera.boundingBox();
  await showLeft(page, "inspector");
  await expect(camera).toBeVisible();
  expect(await camera.boundingBox()).toEqual(before);
  await showLeft(page, "collection");
  await expect(page.getByLabel("Search scene objects")).toBeVisible();
  expect(await camera.boundingBox()).toEqual(before);
  await page
    .getByRole("button", { name: "Dock Gesture Input", exact: true })
    .click();
  await expect(camera).toBeHidden();
  await showLeft(page, "gesture");
  await expect(camera).toBeVisible();
});
