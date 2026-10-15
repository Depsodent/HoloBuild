import { test, expect } from "../helpers/editorTest";
import type { Locator } from "@playwright/test";
import { target, hold, poseAt } from "../helpers/gestureInput";

const LAYOUT_KEY = "holobuild.workspace.v1";
const DIAGNOSTICS_KEY = "holobuild.diagnostics-window.v1";

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error("Missing workspace element bounds");
  return bounds;
}

async function scrollPanel(locator: Locator) {
  return locator.evaluate((panel) => {
    const candidates = [panel, ...panel.querySelectorAll<HTMLElement>("*")];
    const scroller = candidates.find((element) => {
      const style = getComputedStyle(element);
      return (
        /auto|scroll/.test(style.overflowY) &&
        element.scrollHeight - element.clientHeight > 20
      );
    }) as HTMLElement | undefined;
    if (!scroller) return { before: 0, after: 0 };
    const before = scroller.scrollTop;
    scroller.scrollTop += 60;
    return { before, after: scroller.scrollTop };
  });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 960 });
});

test("workspace places camera and inspector on the left and construction on the right", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  const left = await box(page.locator(".workspace-left"));
  const viewport = await box(page.getByLabel("3D construction viewport"));
  const right = await box(page.locator(".workspace-right"));
  const camera = await box(page.getByLabel("Gesture camera"));
  const inspector = await box(page.locator(".inspector"));
  const tools = await box(page.locator(".workspace-right .tools"));
  expect(left.x + left.width).toBeLessThanOrEqual(viewport.x + 1);
  expect(viewport.x + viewport.width).toBeLessThanOrEqual(right.x + 1);
  expect(camera.x).toBeGreaterThanOrEqual(left.x);
  expect(camera.x + camera.width).toBeLessThanOrEqual(left.x + left.width + 1);
  expect(inspector.y).toBeGreaterThanOrEqual(camera.y + camera.height);
  expect(tools.x).toBeGreaterThanOrEqual(right.x);
  await expect(
    page.getByRole("separator", { name: "Resize left sidebar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("separator", { name: "Resize right sidebar" }),
  ).toBeVisible();
  const hint = page.locator(".compact-hint");
  await expect(hint).toBeVisible();
  expect(
    await hint.evaluate((element) => element.scrollHeight),
  ).toBeLessThanOrEqual(
    (await hint.evaluate((element) => element.clientHeight)) + 1,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1600,
  );
  await page.screenshot({ path: "test-results/adaptive-workspace.png" });
});

test("each sidebar section scrolls without moving its neighbours or the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 600 });
  await page.goto("/?testInput");
  await target(page);
  const canvas = page.locator("canvas[data-engine]");
  const before = await box(canvas);
  const camera = page.getByLabel("Gesture camera");
  const inspector = page.locator(".inspector-scroll");
  const tools = page.locator(".workspace-right .tools");
  const cameraBefore = await box(camera);
  const inspectorBefore = await box(inspector);
  const toolsBefore = await box(tools);
  for (const panel of [camera, inspector, tools]) {
    const result = await scrollPanel(panel);
    expect(result.after).toBeGreaterThan(result.before);
    expect(await box(canvas)).toEqual(before);
    expect(await box(camera)).toEqual(cameraBefore);
    expect(await box(inspector)).toEqual(inspectorBefore);
    expect(await box(tools)).toEqual(toolsBefore);
  }
});

test("keyboard and pointer separators resize panels and the live canvas without scene edits", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const initialTarget = await target(page);
  const left = page.locator(".workspace-left");
  const right = page.locator(".workspace-right");
  const canvas = page.locator("canvas[data-engine]");
  const initialLeft = await box(left);
  const initialRight = await box(right);
  const initialCanvas = await box(canvas);
  const leftHandle = page.getByRole("separator", {
    name: "Resize left sidebar",
  });
  await leftHandle.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expect
    .poll(async () => (await box(left)).width)
    .toBeGreaterThan(initialLeft.width);
  const rightHandle = page.getByRole("separator", {
    name: "Resize right sidebar",
  });
  await rightHandle.focus();
  await page.keyboard.press("Shift+ArrowLeft");
  await expect
    .poll(async () => (await box(right)).width)
    .toBeGreaterThan(initialRight.width);
  await expect
    .poll(async () => (await box(canvas)).width)
    .toBeLessThan(initialCanvas.width);
  const camera = page.getByLabel("Gesture camera");
  const beforeCamera = await box(camera);
  const split = page.getByRole("separator", {
    name: "Resize Gesture Input height",
  });
  await split.focus();
  await page.keyboard.press("Shift+ArrowDown");
  await expect
    .poll(async () => (await box(camera)).height)
    .toBeGreaterThan(beforeCamera.height);
  const handleBounds = await box(leftHandle);
  const beforeDrag = await box(left);
  await page.mouse.move(
    handleBounds.x + handleBounds.width / 2,
    handleBounds.y + handleBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBounds.x + handleBounds.width / 2 + 30,
    handleBounds.y + handleBounds.height / 2,
    { steps: 4 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => (await box(left)).width)
    .toBeGreaterThan(beforeDrag.width + 20);
  const afterTarget = await target(page);
  expect(afterTarget.object).toEqual(initialTarget.object);
  expect(afterTarget.cursor.x).toBeCloseTo(initialTarget.cursor.x, 5);
  expect(afterTarget.cursor.y).toBeCloseTo(initialTarget.cursor.y, 5);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(0);
});

test("collapsed rails preserve core construction controls and independently restore panels", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  const before = await box(page.getByLabel("3D construction viewport"));
  await page
    .getByRole("button", { name: "Collapse left sidebar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Collapse construction tools", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await box(page.getByLabel("3D construction viewport"))).width,
    )
    .toBeGreaterThan(before.width + 200);
  await page
    .getByRole("button", { name: "Cube 1 × 1 × 1 m", exact: true })
    .click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    2,
  );
  await page.getByTitle("Move (G)", { exact: true }).click();
  await expect(page.locator("footer")).toContainText("TRANSLATE");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    1,
  );
  await page
    .getByRole("button", { name: "Expand left sidebar", exact: true })
    .click();
  await expect(page.getByLabel("Gesture camera")).toBeVisible();
  await expect(page.locator(".inspector")).toBeVisible();
  await page
    .getByRole("button", { name: "Minimize Object Inspector", exact: true })
    .click();
  await expect(page.getByLabel("position X", { exact: true })).toBeHidden();
  await page
    .getByRole("button", { name: "Expand Object Inspector", exact: true })
    .click();
  await page.locator(".scene-list button").first().click();
  await expect(page.getByLabel("position X", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Expand construction tools", exact: true })
    .click();
  await expect(page.locator(".workspace-right .shape-palette")).toBeVisible();
});

test("docked camera minimizes and undocks while the shared gesture path still moves an object", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  await page
    .getByRole("button", { name: "Minimize Gesture Input", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start camera", exact: true }),
  ).toBeHidden();
  await hold(page, poseAt("pointing", start.cursor));
  await expect(page.locator(".camera-title")).toContainText("pointing");
  await hold(page, poseAt("pinch", start.cursor));
  await expect(page.locator(".gesture-cursor")).toHaveClass(/dragging/);
  const end = { x: start.cursor.x + 0.12, y: start.cursor.y };
  await hold(page, poseAt("pinch", end));
  await hold(page, poseAt("pointing", end));
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(1);
  await expect(page.getByLabel("Gesture tool menu")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Expand Gesture Input", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Undock Gesture Input", exact: true })
    .click();
  const floating = await box(page.getByLabel("Gesture camera"));
  const workspace = await box(page.locator(".workspace"));
  expect(floating.x).toBeGreaterThanOrEqual(workspace.x);
  expect(floating.x + floating.width).toBeLessThanOrEqual(
    workspace.x + workspace.width + 1,
  );
  await expect(
    page.getByRole("button", {
      name: "Move Gesture Input window",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Dock Gesture Input", exact: true })
    .click();
  const docked = await box(page.getByLabel("Gesture camera"));
  const left = await box(page.locator(".workspace-left"));
  expect(docked.x).toBeGreaterThanOrEqual(left.x);
  expect(docked.x + docked.width).toBeLessThanOrEqual(left.x + left.width + 1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.scene()[0])).position,
  ).toEqual(start.object.position);
});

test("diagnostics moves, resizes, minimizes and reopens without changing the scene", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  const panel = page.locator(".gesture-diagnostics");
  await page
    .getByRole("button", { name: "Expand Gesture Diagnostics", exact: true })
    .click();
  await expect(panel).toContainText("Pinch distance");
  const before = await box(panel);
  const move = page.getByRole("button", {
    name: "Move Gesture Diagnostics",
    exact: true,
  });
  await move.focus();
  await page.keyboard.press("ArrowRight");
  const moved = await box(panel);
  expect(moved.x).toBeGreaterThan(before.x);
  const moveBounds = await box(move);
  await page.mouse.move(
    moveBounds.x + moveBounds.width / 2,
    moveBounds.y + moveBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    moveBounds.x + moveBounds.width / 2 - 60,
    moveBounds.y + moveBounds.height / 2 + 30,
    { steps: 4 },
  );
  await page.mouse.up();
  const dragged = await box(panel);
  expect(dragged.x).toBeCloseTo(moved.x - 60, 0);
  expect(dragged.y).toBeCloseTo(moved.y + 30, 0);
  const resize = page.getByRole("button", {
    name: "Resize Gesture Diagnostics",
    exact: true,
  });
  await resize.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await box(panel)).width)
    .toBeGreaterThan(moved.width);
  const resizeBounds = await box(resize);
  const beforeResize = await box(panel);
  await page.mouse.move(
    resizeBounds.x + resizeBounds.width / 2,
    resizeBounds.y + resizeBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    resizeBounds.x + resizeBounds.width / 2 + 40,
    resizeBounds.y + resizeBounds.height / 2 + 30,
    { steps: 4 },
  );
  await page.mouse.up();
  expect((await box(panel)).width).toBeCloseTo(beforeResize.width + 40, 0);
  expect((await box(panel)).height).toBeCloseTo(beforeResize.height + 30, 0);
  await page
    .getByRole("button", { name: "Minimize Gesture Diagnostics", exact: true })
    .click();
  await expect(panel.getByText("Pinch distance", { exact: true })).toBeHidden();
  await page
    .getByRole("button", { name: "Close Gesture Diagnostics", exact: true })
    .click();
  await expect(panel).toBeHidden();
  await page
    .getByRole("button", { name: "Toggle Gesture Diagnostics", exact: true })
    .click();
  await expect(panel).toBeVisible();
  await page
    .getByRole("button", { name: "Expand Gesture Diagnostics", exact: true })
    .click();
  await expect(panel).toContainText("Selectable ray hit");
  expect((await target(page)).object).toEqual(start.object);
  expect((await target(page)).cursor.x).toBeCloseTo(start.cursor.x, 5);
  expect((await target(page)).cursor.y).toBeCloseTo(start.cursor.y, 5);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).history,
  ).toBe(0);
});

test("workspace state survives reload and reset restores the documented defaults", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  const handle = page.getByRole("separator", { name: "Resize left sidebar" });
  await handle.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page
    .getByRole("button", { name: "Minimize Gesture Input", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Minimize Object Inspector", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Collapse construction tools", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) || "{}").cameraMinimized,
        LAYOUT_KEY,
      ),
    )
    .toBe(true);
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    LAYOUT_KEY,
  );
  const diagnostics = page.locator(".gesture-diagnostics");
  await page
    .getByRole("button", { name: "Move Gesture Diagnostics", exact: true })
    .focus();
  await page.keyboard.press("Shift+ArrowLeft");
  const savedDiagnostics = await box(diagnostics);
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) || "{}").x,
        DIAGNOSTICS_KEY,
      ),
    )
    .toBeCloseTo(savedDiagnostics.x, 0);
  await page.reload();
  await target(page);
  expect((await box(diagnostics)).x).toBeCloseTo(savedDiagnostics.x, 0);
  await expect(
    page.getByRole("button", { name: "Expand Gesture Input", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Expand Object Inspector", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Expand construction tools",
      exact: true,
    }),
  ).toBeVisible();
  expect((await box(page.locator(".workspace-left"))).width).toBeCloseTo(
    saved.leftWidth,
    0,
  );
  await page
    .getByRole("button", { name: "Reset Workspace Layout", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Minimize Gesture Input", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Minimize Object Inspector",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Collapse construction tools",
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) || "{}").leftWidth,
        LAYOUT_KEY,
      ),
    )
    .toBe(320);
  const reset = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    LAYOUT_KEY,
  );
  expect(reset).toMatchObject({
    leftWidth: 320,
    rightWidth: 234,
    leftCollapsed: false,
    rightCollapsed: false,
    cameraHeight: 360,
    cameraMinimized: false,
    cameraDocked: true,
    inspectorMinimized: false,
    diagnosticsVisible: true,
  });
  expect((await box(diagnostics)).x).toBeGreaterThan(savedDiagnostics.x);
});

test("corrupt saved layouts recover and a smaller window keeps usable viewport and restore controls", async ({
  page,
}) => {
  await page.addInitScript(
    ({ layoutKey, diagnosticsKey }) => {
      localStorage.setItem(
        layoutKey,
        '{"leftWidth":"broken","cameraHeight":-5}',
      );
      localStorage.setItem(diagnosticsKey, "not JSON");
    },
    { layoutKey: LAYOUT_KEY, diagnosticsKey: DIAGNOSTICS_KEY },
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?testInput");
  await target(page);
  expect((await box(page.locator(".workspace-left"))).width).toBeGreaterThan(
    200,
  );
  await page.setViewportSize({ width: 900, height: 620 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(900);
  const viewport = await box(page.getByLabel("3D construction viewport"));
  expect(viewport.width).toBeGreaterThanOrEqual(300);
  for (const side of [
    page.locator(".workspace-left"),
    page.locator(".workspace-right"),
  ]) {
    const bounds = await box(side);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(901);
  }
  const camera = await box(page.getByLabel("Gesture camera"));
  expect(camera.y + camera.height).toBeLessThanOrEqual(621);
  await expect(
    page.getByRole("button", { name: "Reset Workspace Layout", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("small screens keep both side drawers and project controls reachable without page scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/?testInput");
  await target(page);
  const viewport = page.getByLabel("3D construction viewport");
  expect((await box(viewport)).width).toBeGreaterThan(200);
  await page
    .getByRole("button", { name: "Expand left sidebar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start camera", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Minimize Gesture Input", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Collapse left sidebar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand construction tools", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cube 1 × 1 × 1 m", exact: true })
    .click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page
    .getByRole("button", { name: "Collapse construction tools", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Show Gesture Input", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Minimize Gesture Input", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: "test-results/adaptive-workspace-small.png" });
  await page.setViewportSize({ width: 320, height: 720 });
  const resetButton = await box(
    page.getByRole("button", { name: "Reset Workspace Layout", exact: true }),
  );
  expect(resetButton.x + resetButton.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.reload();
  await target(page);
  await expect(
    page.getByRole("button", { name: "Collapse left sidebar", exact: true }),
  ).toBeVisible();
});

test("layout handles cancel an active grab without committing or changing gesture mode", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  await hold(page, poseAt("pointing", start.cursor));
  await hold(page, poseAt("pinch", start.cursor));
  await hold(
    page,
    poseAt("pinch", { x: start.cursor.x + 0.1, y: start.cursor.y }),
  );
  await expect(page.locator(".gesture-cursor")).toHaveClass(/dragging/);
  const handle = page.getByRole("button", {
    name: "Move Gesture Diagnostics",
    exact: true,
  });
  const h = await box(handle);
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 - 30, h.y + h.height / 2 + 20);
  await hold(page, poseAt("pinch", start.cursor));
  await page.mouse.up();
  await hold(page, poseAt("pinch", start.cursor));
  expect(await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).toEqual({
    history: 0,
    redo: 0,
    preview: null,
  });
  expect((await target(page)).object.position).toEqual(start.object.position);
  await expect(page.getByLabel("Gesture mode", { exact: true })).toHaveValue(
    "move",
  );
  await hold(page, poseAt("pointing", start.cursor));
  await hold(page, poseAt("pinch", start.cursor));
  await expect(page.locator(".gesture-cursor")).toHaveClass(/dragging/);
  await page
    .getByRole("separator", { name: "Resize left sidebar", exact: true })
    .focus();
  await page.keyboard.press("ArrowRight");
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).preview,
  ).toBeNull();
  const next = await target(page);
  await hold(page, poseAt("pointing", next.cursor));
  await hold(page, poseAt("pinch", next.cursor));
  await expect(page.locator(".gesture-cursor")).toHaveClass(/dragging/);
  await page
    .getByRole("button", { name: "Reset Workspace Layout", exact: true })
    .click();
  await hold(page, poseAt("pinch", next.cursor));
  expect(await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).toEqual({
    history: 0,
    redo: 0,
    preview: null,
  });
});

test("synthetic webcam remains live through docking, minimization and sidebar collapse", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext("2d")!;
        let frame = 0;
        const paint = () => {
          context.fillStyle = `rgb(${frame++ % 100},30,40)`;
          context.fillRect(0, 0, 640, 480);
        };
        paint();
        const interval = setInterval(paint, 100);
        const stream = canvas.captureStream(10);
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => {
            clearInterval(interval);
            stop();
            document.documentElement.dataset.workspaceTrackStopped = "true";
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
  const video = page.locator("video");
  const time = await video.evaluate(
    (element: HTMLVideoElement) => element.currentTime,
  );
  await page
    .getByRole("button", { name: "Minimize Gesture Input", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Collapse left sidebar", exact: true })
    .click();
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(time + 0.2);
  expect(
    await video.evaluate(
      (element: HTMLVideoElement) =>
        (element.srcObject as MediaStream).getVideoTracks()[0].readyState,
    ),
  ).toBe("live");
  await page
    .getByRole("button", { name: "Expand left sidebar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand Gesture Input", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Undock Gesture Input", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop camera", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Dock Gesture Input", exact: true })
    .click();
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-workspace-track-stopped",
    "true",
  );
  await page
    .getByRole("button", { name: "Reset Workspace Layout", exact: true })
    .click();
  expect(
    await video.evaluate(
      (element: HTMLVideoElement) =>
        (element.srcObject as MediaStream).getVideoTracks()[0].readyState,
    ),
  ).toBe("live");
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-workspace-track-stopped",
    "true",
  );
});
