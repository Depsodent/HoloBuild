import { test, expect } from "../helpers/editorTest";
test("real local MediaPipe processes a synthetic video and releases its stream", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d")!;
        let frame = 0;
        const paint = () => {
          ctx.fillStyle = `rgb(${frame++ % 100},20,30)`;
          ctx.fillRect(0, 0, 640, 480);
        };
        paint();
        const interval = setInterval(paint, 100);
        const stream = canvas.captureStream(10);
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => {
            clearInterval(interval);
            stop();
            document.documentElement.dataset.testTrackStopped = "true";
          };
        }
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
  await expect(page.locator(".camera-meta")).toContainText(
    /No hand · [1-9]\d* Hz/,
    { timeout: 20000 },
  );
  const time = await page
    .locator("video")
    .evaluate((v: HTMLVideoElement) => v.currentTime);
  await page
    .getByRole("button", { name: "Minimize Gesture Input", exact: true })
    .click();
  await expect(page.locator(".camera-title")).toContainText("RUNNING");
  await expect(page.locator(".camera-title")).toContainText("No hand");
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeGreaterThan(time + 0.2);
  expect(
    await page
      .locator("video")
      .evaluate(
        (v: HTMLVideoElement) =>
          (v.srcObject as MediaStream).getVideoTracks()[0].readyState,
      ),
  ).toBe("live");
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-test-track-stopped",
    "true",
  );
  await page
    .getByRole("button", { name: "Expand Gesture Input", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hide camera preview", exact: true })
    .click();
  const hiddenTime = await page
    .locator("video")
    .evaluate((v: HTMLVideoElement) => v.currentTime);
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeGreaterThan(hiddenTime + 0.2);
  await page
    .getByRole("button", { name: "Show camera preview", exact: true })
    .click();
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-test-track-stopped",
    "true",
  );
  await expect(page.locator(".camera-message")).toContainText("Camera is off");
});
test("camera permission denial preserves mouse editing", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        throw new DOMException("Test denial", "NotAllowedError");
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.locator(".camera-message")).toContainText(
    "permission denied",
  );
  await page.getByRole("button", { name: "Cube 1 × 1 × 1 m" }).click();
  await expect(page.locator(".scene-list button")).toHaveCount(2);
});
