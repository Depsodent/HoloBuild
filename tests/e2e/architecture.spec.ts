import { setPlannerMode } from "../helpers/workspaceTools";
import fs from "node:fs";
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
  await expect(
    page.getByLabel("Staircase Inspector", { exact: true }),
  ).toBeVisible();
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

test("conversation refines draft stairs then edits the confirmed assembly through Inspector and exact history", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await page.getByRole("tab", { name: "AI", exact: true }).click();
  const ask = async (text: string) => {
    await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
    await page
      .getByRole("button", { name: "Send request", exact: true })
      .click();
  };
  const scene = () => page.evaluate(() => window.__HOLO_TEST__!.scene());
  const base = await scene();
  await ask("Build a two-story house");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  await ask("Add stairs");
  await expect(
    page.getByRole("log", { name: "Design conversation" }),
  ).toContainText("left or right");
  await ask("left");
  await expect(
    page.getByRole("log", { name: "Design conversation" }),
  ).toContainText("draft geometry is updated");
  expect(await scene()).toEqual(base);
  await ask("Make the stairs wooden");
  await ask("Make the stairs wider");
  await ask("Yes");
  const built = await scene();
  const stair = built.find((o) => o.construction?.role === "stair")!;
  expect(stair.material).toBe("wood");
  expect(
    stair.construction?.structure?.template?.stairs?.[0].width,
  ).toBeCloseTo(1.2);
  await page.getByLabel("Selection mode").selectOption("component");
  await page.getByRole("tab", { name: "Collection", exact: true }).click();
  await page.getByLabel("Search scene objects").fill("Stair stairs-1");
  await page
    .locator(".scene-list button")
    .filter({ hasText: "Stair stairs-1 step" })
    .first()
    .click();
  await page.getByRole("tab", { name: "Inspector", exact: true }).click();
  await expect(
    page.getByLabel("Staircase Inspector", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Stair Width", { exact: true }).fill("1.3");
  await page
    .getByRole("button", { name: "Preview staircase change", exact: true })
    .click();
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  expect(await scene()).toEqual(built);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const wider = await scene();
  expect(
    wider.find((o) => o.construction?.role === "stair")?.construction?.structure
      ?.template?.stairs?.[0].width,
  ).toBeCloseTo(1.3);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene()).toEqual(built);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene()).toEqual(wider);
  await ask("Remove the staircase");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  await ask("Cancel");
  expect(await scene()).toEqual(wider);
  await ask("Remove the staircase");
  await ask("Yes");
  expect((await scene()).some((o) => o.construction?.role === "stair")).toBe(
    false,
  );
  await ask("Undo");
  expect(await scene()).toEqual(wider);
});

test("model-interpreted staircase recipes create real geometry rather than acknowledging unsupported boxes", async ({
  page,
}) => {
  const design = offlinePlan("house", {
    width: 6,
    depth: 6,
    height: 3,
    floors: 2,
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
  }).template!;
  let calls = 0;
  await page.route("**/api/planner/assistant", (r) => {
    calls++;
    return r.fulfill({
      contentType: "text/event-stream",
      body:
        "event: result\ndata: " +
        JSON.stringify({
          source: "llm",
          provider: "Gemini",
          model: "recorded-test",
          requestId: "stairs-recorded",
          plan: {
            kind: "create",
            design,
            message:
              "Review a two-floor house with a straight staircase on the left.",
          },
        }) +
        "\n\n",
    });
  });
  await page.goto("/?testInput");
  await page.getByRole("tab", { name: "AI", exact: true }).click();
  const base = await page.evaluate(() => window.__HOLO_TEST__!.scene());
  await page
    .getByLabel("Ask HoloBuild", { exact: true })
    .fill("I need a two-storey cottage with a straight staircase on the left.");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    base,
  );
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  const next = await page.evaluate(() => window.__HOLO_TEST__!.scene());
  expect(next.filter((o) => o.construction?.role === "stair")).toHaveLength(16);
  expect(
    next.filter(
      (o) => o.construction?.role === "floor" && o.construction.level === 1,
    ),
  ).toHaveLength(4);
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    base,
  );
});

test("selected opening inspector rebuilds rendered wall geometry with inert preview, exact history and project persistence", async ({
  page,
}) => {
  const built = materializePlan(
    offlinePlan("house", {
      width: 6,
      depth: 6,
      height: 3,
      floors: 2,
      doors: 0,
      windows: 0,
      openings: [
        {
          id: "upper-window",
          kind: "window",
          level: 1,
          facade: "front",
          offset: 0,
          bottom: 1,
          width: 1,
          height: 1,
          panel: true,
        },
      ],
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?testInput");
  await page.locator("input[type=file][accept='.json']").setInputFiles({
    name: "openings.json",
    mimeType: "application/json",
    buffer: Buffer.from(serialize(built.objects)),
  });
  await expect(page.locator(".status")).toContainText("Replace complete.");
  const scene = () => page.evaluate(() => window.__HOLO_TEST__!.scene());
  const before = await scene();
  await page.getByLabel("Selection mode").selectOption("component");
  await page.getByRole("tab", { name: "Collection", exact: true }).click();
  await page.getByLabel("Search scene objects").fill("window");
  await page
    .locator(".scene-list button")
    .filter({ hasText: "front window panel" })
    .first()
    .click();
  await page.getByRole("tab", { name: "Inspector", exact: true }).click();
  await expect(
    page.getByLabel("Opening Inspector", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Opening width", { exact: true }).fill("1.2");
  await page
    .getByRole("button", { name: "Preview opening change", exact: true })
    .click();
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  expect(await scene()).toEqual(before);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const wider = await scene();
  const panel = wider.find((o) => o.construction?.opening === "upper-window")!;
  expect(panel.scale[0]).toBeCloseTo(0.4); // wall base width 3m
  expect(panel.id).toBe(
    before.find((o) => o.construction?.opening === "upper-window")!.id,
  );
  await expect(page.locator("canvas[data-engine]")).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene()).toEqual(before);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene()).toEqual(wider);
  await page.screenshot({
    path: "test-results/architectural-openings-phase3.png",
  });
  expect(errors).toEqual([]);
});

test("balcony draft refinement, grouped Inspector edits and rendered access preserve exact history", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?testInput");
  await page.getByRole("tab", { name: "AI", exact: true }).click();
  const ask = async (text: string) => {
    await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
    await page
      .getByRole("button", { name: "Send request", exact: true })
      .click();
  };
  const scene = () => page.evaluate(() => window.__HOLO_TEST__!.scene());
  const base = await scene();
  await ask("Build a two-story house with no windows");
  await ask("Add stairs");
  await ask("left");
  await ask("Add a balcony on the second floor");
  await expect(
    page.getByRole("log", { name: "Design conversation" }),
  ).toContainText("facade");
  await ask("front");
  await expect(
    page.getByRole("log", { name: "Design conversation" }),
  ).toContainText("draft geometry is updated");
  expect(await scene()).toEqual(base);
  await ask("Yes");
  const built = await scene();
  expect(built.filter((o) => o.construction?.role === "balcony")).toHaveLength(
    8,
  );
  expect(built.some((o) => o.construction?.role === "stair")).toBe(true);
  const balcony = built.find((o) => o.construction?.role === "balcony")!;
  const recipe = balcony.construction!.structure!.template!;
  expect(
    built.some((o) => o.construction?.opening === recipe.balconies![0].access),
  ).toBe(true);
  await page.getByLabel("Selection mode").selectOption("component");
  await page.getByRole("tab", { name: "Collection", exact: true }).click();
  await page.getByLabel("Search scene objects").fill("Balcony balcony-1 slab");
  await page
    .locator(".scene-list button")
    .filter({ hasText: "Balcony balcony-1 slab" })
    .first()
    .click();
  await page.getByRole("tab", { name: "Inspector", exact: true }).click();
  await expect(
    page.getByLabel("Balcony Inspector", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Balcony width", { exact: true }).fill("2.8");
  await page
    .getByRole("button", { name: "Preview balcony change", exact: true })
    .click();
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  expect(await scene()).toEqual(built);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const wider = await scene();
  expect(
    wider.find((o) => o.id === balcony.id)!.construction!.structure!.template!
      .balconies![0].width,
  ).toBeCloseTo(2.8);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene()).toEqual(built);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene()).toEqual(wider);
  const canvas = page.locator("canvas[data-engine]");
  await canvas.hover();
  await page.mouse.wheel(0, 350);
  await expect(canvas).toBeVisible();
  await page.screenshot({
    path: "test-results/architectural-balcony-phase4.png",
  });
  expect(errors).toEqual([]);
});

for (const mode of ["auto", "llm"] as const) {
  test(`recorded architectural plan in ${mode} keeps stairs, balcony access and exact atomic history`, async ({
    page,
  }) => {
    const plan = JSON.parse(
      fs.readFileSync(
        new URL("../fixtures/ollama-architecture.json", import.meta.url),
        "utf8",
      ),
    );
    let calls = 0;
    await page.route("**/api/planner/assistant", (r) =>
      r.fulfill({
        contentType: "text/event-stream",
        body:
          "event: result\ndata: " +
          JSON.stringify({
            source: "llm",
            model: "recorded-local-response",
            plan:
              ++calls === 1
                ? {
                    kind: "clarify",
                    message:
                      "Which side for the stairs and which facade for the balcony?",
                  }
                : calls === 2
                  ? plan
                  : {
                      kind: "edit",
                      scope: "structure",
                      target: r.request().postDataJSON().context.structures[0]
                        .id,
                      operation: {
                        type: "color",
                        role: "roof",
                        color: "#008080",
                      },
                      message: "Review the roof on this same house.",
                    },
          }) +
          "\n\n",
      }),
    );
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?testInput");
    await page.getByRole("tab", { name: "AI", exact: true }).click();
    await setPlannerMode(page, mode);
    const scene = () => page.evaluate(() => window.__HOLO_TEST__!.scene());
    const base = await scene();
    await page
      .getByLabel("Ask HoloBuild", { exact: true })
      .fill("generate a 2 story house including a balcony and stairs");
    await page
      .getByRole("button", { name: "Send request", exact: true })
      .click();
    await expect(
      page.getByRole("log", { name: "Design conversation" }),
    ).toContainText("Which side for the stairs");
    expect(await scene()).toEqual(base);
    await page
      .getByLabel("Ask HoloBuild", { exact: true })
      .fill("Use left interior stairs and a front balcony on the second floor");
    await page
      .getByRole("button", { name: "Send request", exact: true })
      .click();
    await expect(
      page.getByLabel("Construction plan preview", { exact: true }),
    ).toBeVisible();
    expect(await scene()).toEqual(base);
    await page
      .getByRole("button", { name: "Confirm construction", exact: true })
      .click();
    const built = await scene(),
      parts = built.filter((o) => o.construction);
    expect(calls).toBe(2);
    expect(parts).toHaveLength(44);
    expect(parts.filter((o) => o.construction!.role === "stair")).toHaveLength(
      16,
    );
    expect(
      parts.filter((o) => o.construction!.role === "balcony"),
    ).toHaveLength(8);
    expect(
      parts.filter(
        (o) => o.construction!.role === "floor" && o.construction!.level === 1,
      ),
    ).toHaveLength(4);
    await expect
      .poll(() =>
        page.evaluate(() => window.__HOLO_TEST__!.rendered?.().length),
      )
      .toBe(built.length);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect(await scene()).toEqual(base);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    expect(await scene()).toEqual(built);
    // Undo/Redo intentionally clears selection; the remembered active house must remain the edit target.
    await page
      .getByLabel("Ask HoloBuild", { exact: true })
      .fill(
        "Could you make the roof a shade of teal while keeping the rest of this same house as it is?",
      );
    await page
      .getByRole("button", { name: "Send request", exact: true })
      .click();
    await expect(
      page.getByLabel("Structure modification preview", { exact: true }),
    ).toBeVisible();
    expect(await scene()).toEqual(built);
    expect(calls).toBe(3);
    await page
      .getByRole("button", { name: "Confirm structure edit", exact: true })
      .click();
    const recolored = await scene();
    expect(
      recolored
        .filter((o) => o.construction?.role === "roof")
        .every((o) => o.color === "#008080"),
    ).toBe(true);
    expect(recolored.filter((o) => !o.construction)).toEqual(base);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect(await scene()).toEqual(built);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    expect(await scene()).toEqual(recolored);
    // Inspection-only cutaway of the actual accepted model geometry; no regeneration.
    const cutaway = parts.filter((o) =>
      ["floor", "stair", "balcony", "door"].includes(o.construction!.role),
    );
    await page.locator("input[type=file][accept='.json']").setInputFiles({
      name: "live-house-cutaway.json",
      mimeType: "application/json",
      buffer: Buffer.from(serialize(cutaway)),
    });
    await expect(page.locator(".status")).toContainText("Replace complete.");
    const view = await page.locator("canvas[data-engine]").boundingBox();
    if (!view) throw Error("Missing viewport");
    await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
    await page.mouse.wheel(0, 600);
    await page.screenshot({
      path: "test-results/ollama-architecture-cutaway.png",
    });
    expect(errors).toEqual([]);
  });
}
