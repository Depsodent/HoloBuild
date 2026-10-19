import { test, expect } from "@playwright/test";
import { offlinePlan } from "../../src/generation/offline";
import { materializePlan } from "../../src/generation/engine";
import { serialize } from "../../src/scene/sceneSerializer";
test("parametric stair geometry and a real upper-floor opening render, select and survive project load", async ({
  page,
}) => {
  const built = materializePlan(
    offlinePlan("house", {
      width: 6,
      depth: 6,
      height: 3,
      floors: 2,
      roof: "none",
      stairs: [
        {
          id: "stairs-1",
          from: 0,
          to: 1,
          steps: 16,
          rise: 0.2,
          run: 0.2,
          width: 1,
          x: -1,
          z: 0,
          yaw: 0,
          material: "wood",
          color: "#91603e",
        },
      ],
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?testInput");
  await page.locator("input[type=file][accept='.json']").setInputFiles({
    name: "stairs.json",
    mimeType: "application/json",
    buffer: Buffer.from(serialize(built.objects)),
  });
  await expect(page.locator(".status")).toContainText("Replace complete.");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window
            .__HOLO_TEST__!.scene()
            .filter((o) => o.construction?.role === "stair").length,
      ),
    )
    .toBe(16);
  await expect(page.locator("canvas[data-engine]")).toBeVisible();
  const id = built.objects.find((o) => o.construction?.role === "stair")!.id;
  await page.waitForFunction((id) => !!window.__HOLO_TEST__?.project?.(id), id);
  await page.getByRole("tab", { name: "Collection", exact: true }).click();
  await page.getByLabel("Search scene objects").fill("stairs-1");
  await expect(
    page
      .locator(".scene-list button")
      .filter({ hasText: "Stair stairs-1 step" }),
  ).toHaveCount(16);
  await page
    .locator(".scene-list button")
    .filter({ hasText: "Stair stairs-1 step" })
    .first()
    .click();
  await page.getByRole("tab", { name: "Inspector", exact: true }).click();
  await expect(page.locator(".object-id")).toContainText("CUBE");
  // Cutaway inspection fixture only: the generator's full walls were checked above.
  const cutaway = built.objects.filter((o) =>
    ["floor", "stair"].includes(o.construction!.role),
  );
  await page.locator("input[type=file][accept='.json']").setInputFiles({
    name: "stairs-cutaway.json",
    mimeType: "application/json",
    buffer: Buffer.from(serialize(cutaway)),
  });
  await expect(page.locator(".status")).toContainText("Replace complete.");
  await page.getByLabel("Selection mode").selectOption("structure");
  await page.getByRole("tab", { name: "Collection", exact: true }).click();
  await page.locator(".scene-list button").first().click();
  const view = await page.locator("canvas[data-engine]").boundingBox();
  if (!view) throw Error("Missing WebGL viewport");
  await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
  await page.mouse.wheel(0, 450);
  await page.screenshot({
    path: "test-results/architectural-stairs-phase1.png",
  });
  expect(errors).toEqual([]);
});
