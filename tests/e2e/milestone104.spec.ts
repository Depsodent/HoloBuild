import { test, expect } from "@playwright/test";
import { showTools } from "../helpers/workspaceTools";
const prompt =
  "Build a two-story modern house with yellow walls, a purple wooden door, six windows, three on each floor, and a pink roof.";
test("detailed house retains six real segmented windows and appearance through history and save/load", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await showTools(page, "ai");
  await page
    .getByLabel("Planner mode", { exact: true })
    .selectOption("offline");
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill(prompt);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  const before = await page.evaluate(() => window.__HOLO_TEST__!.scene());
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  const after = await page.evaluate(() => window.__HOLO_TEST__!.scene());
  const parts = after.filter((o) => o.construction);
  expect(parts.filter((o) => o.construction?.role === "window")).toHaveLength(
    6,
  );
  for (const level of [0, 1])
    expect(
      parts.filter(
        (o) =>
          o.construction?.role === "window" && o.construction.level === level,
      ),
    ).toHaveLength(3);
  expect(
    parts
      .filter((o) => o.construction?.role === "wall")
      .every((o) => o.color === "#f5d76e"),
  ).toBe(true);
  expect(parts.find((o) => o.construction?.role === "door")).toMatchObject({
    color: "#aa79df",
    material: "wood",
  });
  expect(parts.find((o) => o.construction?.role === "roof")?.color).toBe(
    "#f18db5",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    before,
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    after,
  );
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const download = await pending;
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page
    .locator("input[type=file][accept='.json']")
    .setInputFiles((await download.path())!);
  await expect
    .poll(() => page.evaluate(() => window.__HOLO_TEST__!.scene()))
    .toEqual(after);
});
