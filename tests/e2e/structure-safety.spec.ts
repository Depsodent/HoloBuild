import { test, expect, type Page } from "@playwright/test";
import { target } from "../helpers/gestureInput";
async function open(page: Page, key: string) {
  const panel = page.locator(`[data-accordion-key="${key}"]`);
  if ((await panel.getAttribute("open")) === null)
    await panel.locator(":scope > summary").click();
}
async function ask(page: Page, text: string) {
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
}
async function ready(page: Page) {
  await page.goto("/?testInput");
  await target(page);
  await open(page, "tools.voice");
  await ask(page, "Build a house without doors");
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
}
test("group inspector defaults stay compact; keyboard sections and named material presets work", async ({
  page,
}) => {
  await ready(page);
  await ask(page, "Select the whole house");
  const inspector = page.getByLabel("Structure Inspector", { exact: true });
  await expect(inspector).toBeVisible();
  await expect(inspector.locator("details[open]")).toHaveCount(0);
  const section = page.locator('[data-accordion-key="structure.materials"]');
  await section.locator(":scope > summary").focus();
  await page.keyboard.press("Enter");
  await expect(section).toHaveAttribute("open", "");
  const material = page.getByLabel("Structure material", { exact: true });
  await expect(material.locator('option[value="brick"]')).toHaveText("Brick");
  await expect(material.locator('option[value="polished-metal"]')).toHaveText(
    "Polished metal",
  );
  await page
    .getByLabel("Structure material target", { exact: true })
    .selectOption("roof");
  const before = await page.evaluate(
    () => window.__HOLO_TEST__!.snapshot().history,
  );
  await material.selectOption({ label: "Polished metal" });
  expect(
    await page.evaluate(() =>
      window
        .__HOLO_TEST__!.scene()
        .filter((o) => o.construction?.role === "roof")
        .every((o) => o.material === "polished-metal"),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.snapshot().history),
  ).toBe(before + 1);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("holobuild.accordions.v1")!)[
          "structure.materials"
        ],
    ),
  ).toBe(true);
  await ask(page, "Move the entire house right by 2 meters");
  await expect(page.getByLabel("Structure edit result")).toContainText(
    "[2, 0, 0]",
  );
  await expect(
    page.getByLabel("Generation result", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/milestone-10-inspector-preview.png",
  });
  await page
    .getByRole("button", { name: "Cancel structure edit", exact: true })
    .click();
  await ask(page, "Add another floor");
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  await open(page, "structure.advanced");
  await page.getByLabel("Source floor", { exact: true }).selectOption("1");
  await page
    .getByRole("button", { name: "Remove top floor", exact: true })
    .click();
  await expect(page.getByLabel("Source floor", { exact: true })).toHaveValue(
    "0",
  );
  await page
    .getByRole("button", { name: "Duplicate floor on top", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      window.__HOLO_TEST__!.scene().some((o) => o.construction?.level === 1),
    ),
  ).toBe(true);
});
test("ambiguous/contradictory model targets and selection-mode changes cannot commit edits", async ({
  page,
}) => {
  await ready(page);
  await ask(page, "Duplicate this building");
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const base = await page.evaluate(() => window.__HOLO_TEST__!.scene());
  const groups = [
    ...new Set(
      base
        .filter((o) => o.construction)
        .map((o) => o.construction!.structureId),
    ),
  ];
  await page.getByRole("button", { name: "Undo", exact: true }).focus();
  await page.keyboard.press("Escape");
  let requests = 0;
  await page.route("**/api/planner/edit", (route) => {
    requests++;
    return route.fulfill({
      json: {
        source: "llm",
        model: "mock",
        plan: { version: 1, target: groups[1], operation: { type: "delete" } },
      },
    });
  });
  await page.getByLabel("Planner mode", { exact: true }).selectOption("llm");
  await ask(page, "Move the whole house right");
  await expect(page.getByLabel("Structure edit result")).toContainText(
    /Which structure/,
  );
  expect(requests).toBe(0);
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    base,
  );
  await page
    .getByLabel("Selection mode", { exact: true })
    .selectOption("component");
  await open(page, "inspector.collection");
  await page
    .locator(".scene-list button")
    .filter({ hasText: "slab" })
    .first()
    .click();
  await ask(page, "Delete the whole building");
  await expect(page.getByLabel("Structure edit result")).toContainText(
    "target differs",
  );
  expect(requests).toBe(1);
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    base,
  );
  await page
    .getByLabel("Planner mode", { exact: true })
    .selectOption("offline");
  await ask(page, "Change all walls to brick");
  await expect(
    page.getByRole("button", { name: "Confirm structure edit", exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Selection mode", { exact: true })
    .selectOption("structure");
  await expect(
    page.getByRole("button", { name: "Confirm structure edit", exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    base,
  );
});
