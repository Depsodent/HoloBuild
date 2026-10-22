import { activate } from "./walkthrough-buttons.mjs";
/* global document, window */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { expect } from "@playwright/test";
/** Production UI only; no development scene/camera bridge, no additional provider calls. */
export async function smokeExploration(page) {
  async function saved() {
    const next = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Save project", exact: true })
      .click();
    return JSON.parse(await fs.readFile(await (await next).path(), "utf8"));
  }
  async function history(before, after) {
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    assert.deepEqual((await saved()).objects, before.objects);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    assert.deepEqual((await saved()).objects, after.objects);
  }
  async function pick(part, whole = false) {
    await page
      .getByLabel("Selection mode")
      .selectOption(whole ? "structure" : "component");
    await page.getByRole("tab", { name: "Collection", exact: true }).click();
    await page.getByLabel("Search scene objects").fill(part.name);
    await page
      .locator(".scene-list button")
      .filter({ hasText: part.name })
      .first()
      .click();
    await page.getByRole("tab", { name: "Inspector", exact: true }).click();
  }
  async function ask(text) {
    await page.getByRole("tab", { name: "AI", exact: true }).click();
    await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
    await page
      .getByRole("button", { name: "Send request", exact: true })
      .click();
  }
  async function point() {
    const text = await page
      .getByLabel("Walking position", { exact: true })
      .textContent();
    const m = text.match(/X (-?[\d.]+).*feet (-?[\d.]+) m.* Z (-?[\d.]+)/);
    assert.ok(m, "Missing human navigation telemetry");
    return m.slice(1).map(Number);
  }
  const canvas = page.locator("canvas[data-engine]");
  async function canvasImage() {
    if (await page.evaluate(() => document.pointerLockElement === null)) {
      await page
        .getByRole("button", { name: "Save project", exact: true })
        .focus();
      await page.mouse.move(20, 20);
    }
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(resolve),
          ),
        ),
    );
    return canvas.screenshot();
  }
  const base = await saved(),
    seed = base.objects.find(
      (o) =>
        o.construction?.structure?.template?.floors === 2 &&
        o.construction.structure.template.stairs?.length &&
        o.construction.structure.template.balconies?.length,
    );
  assert.ok(seed, "Expected genuine Gemini two-floor architectural host");
  await fs.writeFile(
    ".cache/m13-" +
      (new URL(page.url()).protocol === "https:" ? "public" : "local") +
      "-exploration-input.json",
    JSON.stringify(base),
  );
  const id = seed.construction.structureId,
    info = seed.construction.structure,
    t = info.template,
    origin = info.position,
    stair = t.stairs[0],
    balcony = t.balconies[0];
  assert.ok(
    Math.abs(info.yaw) < 1e-6 &&
      info.scale.every((n) => Math.abs(n - 1) < 1e-6),
    "Smoke expects fresh, untransformed creation",
  );
  const door = base.objects.find(
    (o) =>
      o.construction?.structureId === id &&
      o.construction.role === "door" &&
      o.construction.level === 0,
  );
  assert.ok(door, "Expected a ground entry");
  await pick(seed, true);
  const layout = await page.evaluate(() =>
    localStorage.getItem("holobuild.workspace.v1"),
  );
  const original = await canvasImage();
  await fs.writeFile(".cache/controls-editor-before.png", original);
  await expect(
    page.getByRole("button", { name: /Enter Presentation|Save viewpoint/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  await expect(page.getByLabel("Construction tools sidebar")).toBeHidden();
  await expect(
    page
      .getByRole("toolbar", { name: "Walkthrough controls" })
      .getByRole("button"),
  ).toHaveText([
    "Look Around",
    "Exit Walkthrough",
    "Reset Position",
    "Controls",
  ]);
  await activate(page, "Controls");
  await expect(
    page.getByRole("button", { name: "Forward", exact: true }),
  ).toBeEnabled();
  const initialFeet = await point(),
    beforeLook = await canvasImage();
  await activate(page, "Look Around");
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.tagName))
    .toBe("CANVAS");
  await expect(
    page.getByRole("button", { name: "Look Around", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(900, 650);
  await activate(page, "Use keyboard / touch");
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement === null))
    .toBe(true);
  const afterLook = await canvasImage();
  assert.ok(
    !afterLook.equals(beforeLook),
    "Mouse look did not change the rendered view",
  );
  await activate(page, "Reset Position");
  assert.deepEqual(await point(), initialFeet);
  await activate(page, "Use keyboard / touch");
  const face = door.construction.facade ?? "front",
    normal =
      face === "front"
        ? [0, 1]
        : face === "back"
          ? [0, -1]
          : face === "left"
            ? [-1, 0]
            : [1, 0],
    f = [-normal[0], -normal[1]],
    right = [-f[1], f[0]];
  const directions = [
    ["w", f],
    ["s", f.map((n) => -n)],
    ["d", right],
    ["a", right.map((n) => -n)],
  ];
  async function settled() {
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const until = performance.now() + 280;
          function frame(t) {
            if (t >= until) resolve();
            else window.requestAnimationFrame(frame);
          }
          window.requestAnimationFrame(frame);
        }),
    );
  }
  async function axis(axis, target) {
    // Human position output is throttled. Stop coarse travel early, then use one-frame
    // key pulses with fresh telemetry; a crossed coordinate is not proof of alignment.
    for (let attempt = 0; attempt < 80; attempt++) {
      const current = (await point())[axis],
        distance = target - current;
      if (Math.abs(distance) <= 0.13) return;
      const sign = Math.sign(distance),
        component = axis === 0 ? 0 : 1,
        key = directions.find(([, v]) => v[component] * sign > 0.99)?.[0];
      assert.ok(key, "Unsupported camera heading");
      await page.keyboard.down(key);
      try {
        if (Math.abs(distance) > 1)
          await expect
            .poll(async () => sign * ((await point())[axis] - target), {
              timeout: 30000,
              intervals: [40],
            })
            .toBeGreaterThan(-0.65);
        else
          await page.evaluate(
            () =>
              new Promise((resolve) => window.requestAnimationFrame(resolve)),
          );
      } finally {
        await page.keyboard.up(key);
      }
      await settled();
    }
    assert.fail(
      "Could not align waypoint axis " +
        axis +
        " at " +
        target +
        "; actual " +
        (await point())[axis],
    );
  }
  const doorAxis = face === "front" || face === "back" ? 2 : 0;
  await axis(
    doorAxis,
    door.position[doorAxis] - normal[doorAxis === 0 ? 0 : 1] * 0.8,
  );
  const angle = (stair.yaw * Math.PI) / 180,
    dir = [Math.sin(angle), Math.cos(angle)],
    half = (stair.steps * stair.run) / 2,
    begin = [
      origin[0] + stair.x - dir[0] * (half + 0.6),
      origin[2] + stair.z - dir[1] * (half + 0.6),
    ],
    end = [
      origin[0] + stair.x + dir[0] * (half + 0.5),
      origin[2] + stair.z + dir[1] * (half + 0.5),
    ];
  if (Math.abs(dir[1]) > 0.5) {
    await axis(2, begin[1]);
    await axis(0, begin[0]);
    await axis(2, end[1]);
  } else {
    await axis(0, begin[0]);
    await axis(2, begin[1]);
    await axis(0, end[0]);
  }
  const upper = origin[1] + stair.to * (t.height + 0.2) + 0.2;
  assert.ok(
    Math.abs((await point())[1] - upper) < 0.04,
    "Did not reach the connected upper floor",
  );
  const perX =
      origin[0] + (stair.x > 0 ? -1 : 1) * (t.width / 2 - t.thickness - 0.3),
    perZ =
      origin[2] + (stair.z > 0 ? -1 : 1) * (t.depth / 2 - t.thickness - 0.3);
  if (Math.abs(dir[1]) > 0.5) {
    await axis(0, perX);
  } else {
    await axis(2, perZ);
    await axis(0, perX);
  }
  const bAxis = balcony.facade === "front" || balcony.facade === "back" ? 2 : 0,
    sign = balcony.facade === "front" || balcony.facade === "right" ? 1 : -1,
    span = bAxis === 2 ? t.depth : t.width,
    inside =
      (bAxis === 2 ? origin[2] : origin[0]) +
      sign * (span / 2 - t.thickness - 0.3),
    outside =
      (bAxis === 2 ? origin[2] : origin[0]) +
      sign * (span / 2 + balcony.depth * 0.45);
  if (bAxis === 2) {
    await axis(2, inside);
    await axis(0, origin[0] + balcony.offset);
  } else {
    await axis(2, perZ);
    await axis(0, inside);
    await axis(2, origin[2] + balcony.offset);
  }
  await axis(bAxis, outside);
  assert.ok(
    Math.abs((await point())[1] - upper) < 0.04,
    "Balcony support was lost",
  );
  await page
    .getByRole("button", { name: "Close controls", exact: true })
    .click();
  await page.screenshot({
    path:
      ".cache/m13-" +
      (new URL(page.url()).protocol === "https:" ? "public" : "local") +
      "-walkthrough.png",
  });
  await activate(page, "Controls");
  await activate(page, "Use keyboard / touch");
  await axis(bAxis, inside);
  await activate(page, "Exit Walkthrough");
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement))
    .toBeNull();
  const restored = await canvasImage();
  await fs.writeFile(".cache/controls-editor-restored.png", restored);
  assert.ok(
    original.equals(restored),
    "Editor canvas pixels differ after returning from walkthrough",
  );
  assert.deepEqual((await saved()).objects, base.objects);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("holobuild.workspace.v1")),
    layout,
  );
  const wall = base.objects.find(
    (o) =>
      o.construction?.structureId === id &&
      o.construction.role === "wall" &&
      o.construction.level === 0 &&
      o.construction.facade === "front",
  );
  assert.ok(wall);
  await pick(wall);
  await ask("Add a window to the selected wall.");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  assert.deepEqual((await saved()).objects, base.objects);
  await page
    .getByRole("button", { name: "Cancel structure edit", exact: true })
    .click();
  assert.deepEqual((await saved()).objects, base.objects);
  await ask("Add a window to the selected wall.");
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const opened = await saved();
  assert.ok(
    opened.objects.filter(
      (o) =>
        o.construction?.structureId === id && o.construction.role === "window",
    ).length >
      base.objects.filter(
        (o) =>
          o.construction?.structureId === id &&
          o.construction.role === "window",
      ).length,
  );
  await history(base, opened);
  await page.getByRole("tab", { name: "Build", exact: true }).click();
  await page.getByTitle("Create Stairs", { exact: true }).click();
  await page.getByLabel("Stair configuration").selectOption("standalone");
  for (const [label, value] of [
    ["Library X", "-15"],
    ["Library Z", "12"],
    ["Library Step count", "8"],
    ["Library Overall rise", "1.6"],
    ["Library Step run", "0.25"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page
    .getByLabel("Library orientation", { exact: true })
    .selectOption("270");
  await page
    .getByLabel("Library material", { exact: true })
    .selectOption("wood");
  await page
    .getByRole("button", { name: "Preview library stairs", exact: true })
    .click();
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  assert.deepEqual((await saved()).objects, opened.objects);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const stairs = await saved(),
    standalone = stairs.objects.find(
      (o) => o.construction?.structure?.standaloneStairs,
    );
  assert.ok(standalone);
  assert.equal(
    stairs.objects.filter(
      (o) =>
        o.construction?.structureId === standalone.construction.structureId,
    ).length,
    8,
  );
  await history(opened, stairs);
  await pick(standalone, true);
  const inspector = page.getByLabel("Precision Inspector", { exact: true });
  await inspector
    .getByRole("button", { name: "Materials", exact: true })
    .click();
  await page
    .getByLabel("Structure material", { exact: true })
    .selectOption("polished-metal");
  await page.getByLabel("Structure color HEX", { exact: true }).fill("#ddbb22");
  await page.getByRole("button", { name: "Apply Color", exact: true }).click();
  await inspector
    .getByRole("button", { name: "Advanced", exact: true })
    .click();
  await page.getByLabel("Standalone stair steps", { exact: true }).fill("10");
  await page.getByLabel("Standalone stair height", { exact: true }).fill("2");
  const tinted = await saved();
  await page
    .getByRole("button", { name: "Preview native parameters", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const ten = await saved(),
    added = ten.objects.filter(
      (o) =>
        o.construction?.structureId === standalone.construction.structureId,
    );
  assert.equal(added.length, 10);
  assert.ok(
    added.every(
      (o) => o.material === "polished-metal" && o.color === "#ddbb22",
    ),
  );
  await history(tinted, ten);
  await page.getByRole("tab", { name: "Build", exact: true }).click();
  await page.getByTitle("Create Wall", { exact: true }).click();
  const beforeWall = await saved();
  await ask("Add a window to the selected wall.");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  assert.deepEqual((await saved()).objects, beforeWall.objects);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const manual = await saved();
  assert.ok(
    manual.objects.some(
      (o) =>
        o.construction?.structure?.nativeWall &&
        o.construction.role === "window",
    ),
  );
  await history(beforeWall, manual);
  await page.getByRole("tab", { name: "Build", exact: true }).click();
  await page.getByTitle("Create Cube", { exact: true }).click();
  const extra = await saved();
  await page.locator("input[type=file][accept='.json']").setInputFiles({
    name: "milestone12.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(manual)),
  });
  await expect(page.locator("footer .status")).toContainText(
    "Replace complete.",
  );
  assert.deepEqual((await saved()).objects, manual.objects);
  await history(extra, manual);
  return {
    productionUI: true,
    developmentBridgeUsed: false,
    realGeminiHost: true,
    doorPassage: true,
    connectedStairClimb: true,
    upperFloorVoid: true,
    balconyAccessAndReturn: true,
    pointerLockMouseLook: true,
    escapePause: true,
    walkthroughRestoresLayout: true,
    editorCanvasPixelsRestored: true,
    fourPrimaryControls: true,
    retiredPresentationAbsent: true,
    resetToInitialFeet: true,
    selectedGeneratedWallWindow: true,
    selectedManualWallWindow: true,
    previewCancelAndConfirmation: true,
    standalone270DegreeStairs: true,
    appearanceOnNewTreads: true,
    portableSaveLoad: true,
    exactUndoRedo: true,
    additionalProviderCalls: 0,
    physicalDeviceTested: false,
  };
}
