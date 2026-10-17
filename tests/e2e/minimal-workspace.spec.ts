import { openWorkspaceSection } from "../helpers/workspaceTools";
import { test, expect, type Page } from "@playwright/test";
import { target, hold, poseAt } from "../helpers/gestureInput";

const group = (page: Page, key: string) =>
  page.locator(`[data-accordion-key="${key}"]`);
async function open(page: Page, key: string) {
  await openWorkspaceSection(page, key);
}
async function ready(page: Page) {
  await page.goto("/?testInput");
  await target(page);
}

test("clean defaults expose four major groups and keep diagnostics and advanced controls hidden", async ({
  page,
}) => {
  await ready(page);
  await expect(page.getByRole("tab")).toHaveText([
    "Build",
    "Edit",
    "AI",
    "Scene",
  ]);
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(page.getByLabel("Selection mode")).toBeVisible();
  await expect(page.getByTitle("Create Cube", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Ask HoloBuild", { exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByLabel("Gesture Diagnostics", { exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start camera", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/minimal-workspace-default.png" });
  const aimed = await target(page);
  await hold(page, poseAt("pointing", aimed.cursor));
  await expect(page.locator(".gesture-status small")).not.toContainText(
    "pinch",
  );
  await expect(page.getByText(/Palm-normalized distance:/)).not.toBeVisible();
  await open(page, "camera.calibration");
  await expect(page.getByText(/Palm-normalized distance:/)).toBeVisible();
});

test("flat tabs are exclusive, keyboard accessible and remember the active category", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("tab", { name: "Build", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Edit", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Scene", exact: true }),
  ).toBeFocused();
  await page.reload();
  await target(page);
  await expect(
    page.getByRole("tab", { name: "Scene", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Scene", exact: true }).focus();
  await page.keyboard.press("Home");
  await expect(page.getByTitle("Create Cube", { exact: true })).toBeVisible();
});

test("Inspector is contextual and exposes transform, appearance and collection without duplicate groups", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator(".inspector > h2")).toContainText("Cube");
  await expect(
    page.locator(".inspector > .workspace-accordion > summary > span"),
  ).toHaveText(["Transform", "Appearance", "Scene Collection · 1"]);
  await open(page, "inspector.appearance");
  await expect(page.getByLabel("Material", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Object color", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Object name", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".inspector > h2")).toHaveText("Nothing selected");
  await expect(group(page, "inspector.transform")).toHaveCount(0);
  await expect(group(page, "inspector.appearance")).toHaveCount(0);
  await open(page, "inspector.collection");
  await page.locator(".scene-list button").click();
  await expect(page.locator(".inspector > h2")).toContainText("Cube");
});

test("one Ask field runs commands and previews plans only when pending; confirm and cancel restore a clean input", async ({
  page,
}) => {
  await ready(page);
  await open(page, "tools.voice");
  const input = page.getByLabel("Ask HoloBuild", { exact: true });
  await expect(input).toHaveCount(1);
  await expect(input).toHaveValue("");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Check model connection", exact: true }),
  ).not.toBeVisible();
  await page.getByLabel("Planner mode").selectOption("commands");
  await input.fill("Create a sphere");
  await input.press("Enter");
  await expect(page.getByLabel("Command result")).toHaveText("Created sphere.");
  await page.getByLabel("Planner mode").selectOption("offline");
  await input.fill("Build a house");
  await input.press("Enter");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel generation", exact: true })
    .click();
  await expect(input).toHaveValue("");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toHaveCount(0);
  await input.fill("Build a room");
  await input.press("Enter");
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  await expect(input).toHaveValue("");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Regenerate plan", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Generation result")).toContainText(
    "Constructed",
  );
});

test("minimized Gesture Input retains accessible camera controls and remembered compact status", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Minimize Gesture Input", exact: true })
    .click();
  await expect(page.locator(".camera-title")).toContainText("0 hands");
  await expect(page.locator(".camera-title")).toContainText("auto");
  await expect(
    page.getByRole("button", { name: "Start camera", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".camera-body")).toBeHidden();
  await page.reload();
  await target(page);
  await expect(
    page.getByRole("button", { name: "Expand Gesture Input", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start camera", exact: true }),
  ).toBeVisible();
});

test("narrow sidebars fit all main controls and keyboard resizing persists while collapsed tools release viewport space", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await ready(page);
  const resize = page.getByRole("separator", {
    name: "Resize right sidebar",
    exact: true,
  });
  await resize.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  const right = page.locator(".workspace-right");
  const width = (await right.boundingBox())!.width;
  for (const key of [
    "tools.transform",
    "tools.voice",
    "tools.scene",
    "tools.shapes",
  ]) {
    await open(page, key);
    expect(
      await right.evaluate((e) => e.scrollWidth - e.clientWidth),
    ).toBeLessThanOrEqual(1);
    expect(
      await page
        .locator(".tools")
        .evaluate((e) => e.scrollWidth - e.clientWidth),
    ).toBeLessThanOrEqual(1);
    const buttons = page.getByRole("tabpanel").locator("button:visible");
    for (const button of await buttons.all()) {
      const bounds = (await button.boundingBox())!;
      const parent = (await right.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(parent.x - 1);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(
        parent.x + parent.width + 1,
      );
    }
  }
  await page.reload();
  await target(page);
  expect((await right.boundingBox())!.width).toBeCloseTo(width, 0);
  const before = (await page.locator(".viewport").boundingBox())!.width;
  await page
    .getByRole("button", { name: "Collapse construction tools", exact: true })
    .click();
  expect(
    (await page.locator(".viewport").boundingBox())!.width,
  ).toBeGreaterThan(before + 80);
});
