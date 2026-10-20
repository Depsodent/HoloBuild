import { test, expect, type Page } from "@playwright/test";
import { showTools, showLeft, setPlannerMode } from "../helpers/workspaceTools";
const scene = (p: Page) => p.evaluate(() => window.__HOLO_TEST__!.scene());
async function ready(page: Page) {
  await page.goto("/?testInput");
  await expect
    .poll(() => page.evaluate(() => !!window.__HOLO_TEST__))
    .toBe(true);
}
async function ask(page: Page, text: string) {
  await showTools(page, "ai");
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
}
test("standalone library stairs preview, configure, persist and retain exact history without a host", async ({
  page,
}) => {
  await ready(page);
  const base = await scene(page);
  await showTools(page, "build");
  await page.getByTitle("Create Stairs", { exact: true }).click();
  await expect(page.getByLabel("Stair configuration")).toHaveValue(
    "standalone",
  );
  await page.getByLabel("Library Overall rise", { exact: true }).fill("1.6");
  await page.getByLabel("Library Step count", { exact: true }).fill("8");
  await page.getByLabel("Library X", { exact: true }).fill("-4");
  await page
    .getByLabel("Library orientation", { exact: true })
    .selectOption("270");
  await page
    .getByRole("button", { name: "Preview library stairs", exact: true })
    .click();
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  expect(await scene(page)).toEqual(base);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const after = await scene(page);
  expect(after.filter((o) => o.construction?.role === "stair")).toHaveLength(8);
  expect(
    after.find((o) => o.construction?.role === "stair")!.construction!
      .structure!.yaw,
  ).toBeCloseTo(-Math.PI / 2);
  expect(after.filter((o) => o.construction?.role === "floor")).toHaveLength(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(base);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene(page)).toEqual(after);
  const step = after.find((o) => o.construction?.role === "stair")!;
  await showLeft(page, "collection");
  await page.getByLabel("Search scene objects").fill(step.name);
  await page
    .locator(".scene-list button")
    .filter({ hasText: step.name })
    .first()
    .click();
  await showLeft(page, "inspector");
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await expect(page.getByLabel("Native assembly parameters")).toContainText(
    "Standalone Stairs",
  );
  await page.getByLabel("Standalone stair width", { exact: true }).fill("1.3");
  await page
    .getByRole("button", { name: "Preview native parameters", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  expect(
    (await scene(page))
      .filter((o) => o.construction?.role === "stair")
      .every((o) => o.scale[0] === 1.3),
  ).toBe(true);
});
test("manual wall text and finalized microphone input share real opening preview and history", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class Fake {
      onstart: (() => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      start() {
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
      constructor() {
        (window as unknown as { m12Speech: Fake }).m12Speech = this;
      }
    }
    Object.defineProperty(window, "SpeechRecognition", {
      value: Fake,
      configurable: true,
    });
  });
  await ready(page);
  await showTools(page, "build");
  await page.getByTitle("Create Wall", { exact: true }).click();
  await showLeft(page, "inspector");
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await page.getByLabel("Selection width (m)", { exact: true }).fill("6");
  await page.getByLabel("Selection width (m)", { exact: true }).press("Enter");
  await setPlannerMode(page, "offline");
  const before = await scene(page);
  await ask(page, "Add a window to the selected wall.");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  expect(await scene(page)).toEqual(before);
  await page
    .getByRole("button", { name: "Cancel structure edit", exact: true })
    .click();
  expect(await scene(page)).toEqual(before);
  await page
    .getByRole("button", { name: "Start listening", exact: true })
    .click();
  await expect(page.getByLabel("Listening status")).toContainText("Listening");
  await page
    .getByRole("button", { name: "Stop listening", exact: true })
    .click();
  await expect(page.getByLabel("Ask HoloBuild", { exact: true })).toHaveValue(
    "Add a window to the selected wall.",
  );
  expect(await scene(page)).toEqual(before);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const after = await scene(page);
  expect(after.some((o) => o.construction?.role === "window")).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(before);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene(page)).toEqual(after);
});
test("Inspector short and long names stay one line in narrow panels without hiding actions", async ({
  page,
}) => {
  await ready(page);
  await showLeft(page, "inspector");
  const root = page.getByLabel("Precision Inspector", { exact: true });
  const h = root.getByRole("heading", { name: "Cube", exact: true });
  await expect(h).toBeVisible();
  expect(await h.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe(
    "nowrap",
  );
  await root.getByRole("button", { name: "Advanced", exact: true }).click();
  const name =
    "A very long generated architectural component name for testing".slice(
      0,
      60,
    );
  await page.getByLabel("Object name", { exact: true }).fill(name);
  await page.getByLabel("Object name", { exact: true }).press("Tab");
  await expect(
    root.getByRole("heading", { name, exact: true }),
  ).toHaveAttribute("title", name);
  const resize = page.getByRole("separator", { name: "Resize left sidebar" });
  await resize.focus();
  await resize.press("Home");
  await expect(
    root.getByRole("button", { name: "Duplicate", exact: true }),
  ).toBeVisible();
  await expect(
    root.getByRole("button", { name: "Delete selected object", exact: true }),
  ).toBeVisible();
  expect(await root.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(
    true,
  );
});
