import { test, expect } from "../helpers/editorTest";
import type { Page } from "@playwright/test";
import { target, hold, poseAt } from "../helpers/gestureInput";
async function ask(page: Page, text: string) {
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
}
async function ready(page: Page) {
  await page.goto("/?testInput");
  await target(page);
  await ask(page, "Build a house without doors");
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
}
const scene = (page: Page) =>
  page.evaluate(() => window.__HOLO_TEST__!.scene());
async function selectGroup(page: Page) {
  await ask(page, "Select the whole house");
  await expect(
    page.getByLabel("Structure Inspector", { exact: true }),
  ).toBeVisible();
}
async function pair(page: Page, d: number, pinch: boolean, y = 0.35, ms = 600) {
  const hands = [
    poseAt(pinch ? "pinch" : "pointing", { x: 0.5 - d / 2, y }),
    poseAt(pinch ? "pinch" : "pointing", { x: 0.5 + d / 2, y }),
  ];
  await page.evaluate(
    (hands) =>
      window.__HOLO_TEST__!.repeatHands(
        hands.map((landmarks) => ({ landmarks })),
      ),
    hands,
  );
  await page.clock.runFor(ms);
}
test("whole/group selection, contextual controls and component mode remain distinct", async ({
  page,
}) => {
  await ready(page);
  await selectGroup(page);
  await expect(page.getByLabel("Selection mode")).toHaveValue("structure");
  await expect(
    page.locator('[data-accordion-key="structure.transform"]'),
  ).toBeVisible();
  await page.getByLabel("Structure name", { exact: true }).fill("Studio");
  await page.getByLabel("Structure name", { exact: true }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "Studio", exact: true }),
  ).toBeVisible();
  const before = await scene(page);
  await page.getByLabel("Structure position X", { exact: true }).fill("15");
  const moved = await scene(page);
  const parts = before.filter((o) => o.construction);
  const now = moved.filter((o) => o.construction);
  const dx = now[0].position[0] - parts[0].position[0];
  expect(dx).not.toBe(0);
  now.forEach((o, i) =>
    expect(o.position[0] - parts[i].position[0]).toBeCloseTo(dx),
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(before);
  await page.getByLabel("Selection mode").selectOption("component");
  await page
    .locator(".scene-list button")
    .filter({ hasText: "slab" })
    .first()
    .click();
  await expect(
    page.getByLabel("Structure Inspector", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("position X", { exact: true })).toBeVisible();
});
test("AI material preview cancels cleanly, confirms once, preserves cube, Undo/Redo and JSON metadata", async ({
  page,
}) => {
  await ready(page);
  const before = await scene(page);
  await ask(page, "Change all walls to brick");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  expect(await scene(page)).toEqual(before);
  await page
    .getByRole("button", { name: "Cancel structure edit", exact: true })
    .click();
  expect(await scene(page)).toEqual(before);
  await ask(page, "Change all walls to brick");
  const history = await page.evaluate(
    () => window.__HOLO_TEST__!.snapshot().history,
  );
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const after = await scene(page);
  expect(after[0]).toEqual(before[0]);
  expect(
    after
      .filter((o) => o.construction?.role === "wall")
      .every((o) => o.material === "brick"),
  ).toBe(true);
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.snapshot().history),
  ).toBe(history + 1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(before);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene(page)).toEqual(after);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await downloading;
  const json = await page.evaluate(() =>
    localStorage.getItem("holobuild.scene")!,
  );
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Reset scene", exact: true }).click();
  await page
    .locator("input[type=file][accept='.json']")
    .setInputFiles({
      name: "structure.json",
      mimeType: "application/json",
      buffer: Buffer.from(json),
    });
  await expect.poll(() => scene(page)).toEqual(after);
});
test("floor editing, duplication and ungrouping are atomic and reversible", async ({
  page,
}) => {
  await ready(page);
  const before = await scene(page);
  await ask(page, "Add another floor to the house");
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  let parts = (await scene(page)).filter((o) => o.construction);
  expect(parts.some((o) => o.construction?.level === 1)).toBe(true);
  await ask(page, "Remove the top floor");
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  expect((await scene(page)).filter((o) => o.construction).length).toBe(
    before.length - 1,
  );
  await ask(page, "Duplicate this building");
  const original = await scene(page);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  parts = (await scene(page)).filter((o) => o.construction);
  expect(new Set(parts.map((o) => o.construction!.structureId)).size).toBe(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(original);
  await selectGroup(page);
  await page
    .getByRole("button", { name: "Ungroup structure", exact: true })
    .click();
  expect((await scene(page)).every((o) => !o.construction)).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(original);
});
test("one-hand group raycast/movement commits once, hand loss and Undo during grab cancel", async ({
  page,
}) => {
  await ready(page);
  await selectGroup(page);
  const original = await scene(page);
  const id = original.find((o) => o.construction?.role === "roof")!.id;
  const cursor = await page.evaluate(
    (id) => window.__HOLO_TEST__!.project!(id)!,
    id,
  );
  await hold(page, poseAt("pointing", cursor), 700);
  await hold(page, poseAt("pinch", cursor), 500);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot().preview))
      ?.structure?.objects.length,
  ).toBe(original.length - 1);
  await hold(page, [], 100);
  expect(await scene(page)).toEqual(original);
  await hold(page, poseAt("pointing", cursor), 700);
  await hold(page, poseAt("pinch", cursor), 500);
  await hold(page, poseAt("pinch", { x: cursor.x + 0.07, y: cursor.y }), 700);
  const p = await page.evaluate(() => window.__HOLO_TEST__!.snapshot().preview);
  expect(p?.valid).toBe(true);
  const history = await page.evaluate(
    () => window.__HOLO_TEST__!.snapshot().history,
  );
  await hold(
    page,
    poseAt("pointing", { x: cursor.x + 0.07, y: cursor.y }),
    600,
  );
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.snapshot().history),
  ).toBe(history + 1);
  await hold(page, [], 50);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(original);
  await selectGroup(page);
  await hold(page, poseAt("pointing", cursor), 700);
  await hold(page, poseAt("pinch", cursor), 500);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await hold(page, poseAt("pinch", cursor), 400);
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.snapshot().preview),
  ).toBeNull();
});
test("two-hand group scale/yaw use shared previews and one history entry each", async ({
  page,
}) => {
  await ready(page);
  await selectGroup(page);
  await page.getByLabel("Gesture mode", { exact: true }).selectOption("scale");
  await hold(page, [], 50);
  await pair(page, 0.25, false);
  await pair(page, 0.25, true);
  await pair(page, 0.32, true, 0.35, 1000);
  const p = await page.evaluate(() => window.__HOLO_TEST__!.snapshot().preview);
  expect(p?.structure?.objects.length).toBeGreaterThan(4);
  expect(p?.valid).toBe(true);
  const count = await page.evaluate(
    () => window.__HOLO_TEST__!.snapshot().history,
  );
  await pair(page, 0.32, false);
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.snapshot().history),
  ).toBe(count + 1);
  await hold(page, [], 50);
  await page.getByLabel("Gesture mode", { exact: true }).selectOption("rotate");
  await pair(page, 0.3, false);
  await pair(page, 0.3, true);
  const hands = [
    poseAt("pinch", { x: 0.4, y: 0.27 }),
    poseAt("pinch", { x: 0.6, y: 0.43 }),
  ];
  await page.evaluate(
    (hands) =>
      window.__HOLO_TEST__!.repeatHands(
        hands.map((landmarks) => ({ landmarks })),
      ),
    hands,
  );
  await page.clock.runFor(1000);
  expect(
    (await page.evaluate(() => window.__HOLO_TEST__!.snapshot().preview))
      ?.structure?.operation.type,
  ).toBe("rotate");
  await hold(page, [], 100);
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.snapshot().history),
  ).toBe(count + 1);
});
test("mocked Ollama edit intents preview, unsupported/invalid requests and stale selections stay inert", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Planner mode", { exact: true }).selectOption("llm");
  const base = await scene(page);
  await page.route("**/api/planner/edit", (route) =>
    route.fulfill({
      json: {
        source: "llm",
        model: "mock",
        plan: {
          version: 1,
          operation: {
            type: "material",
            role: "roof",
            material: "polished-metal",
          },
        },
      },
    }),
  );
  await ask(page, "Replace the roof of the house with polished metal");
  await expect(page.getByLabel("Edit planner source")).toContainText(
    "LLM edit",
  );
  expect(await scene(page)).toEqual(base);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  expect(
    (await scene(page)).find((o) => o.construction?.role === "roof")?.material,
  ).toBe("polished-metal");
  await page.unroute("**/api/planner/edit");
  await page.route("**/api/planner/edit", (route) =>
    route.fulfill({
      json: {
        source: "llm",
        plan: { version: 1, operation: { type: "execute", code: "delete" } },
      },
    }),
  );
  const after = await scene(page);
  await ask(page, "Change the whole house");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toHaveCount(0);
  expect(await scene(page)).toEqual(after);
});
