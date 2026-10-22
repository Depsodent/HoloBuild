import { test, expect, type Page } from "@playwright/test";
import { createFurniture } from "../../src/furniture/factory";
const scene = (p: Page) => p.evaluate(() => window.__HOLO_TEST__!.scene());
const snap = (p: Page) => p.evaluate(() => window.__HOLO_TEST__!.snapshot());
const view = (p: Page) => p.evaluate(() => window.__HOLO_TEST__!.view!());
async function activate(p: Page, name: string) {
  await p.getByRole("button", { name, exact: true }).focus();
  await p.keyboard.press("Enter");
}
async function ready(p: Page, blocked = false) {
  await p.goto("/?testInput");
  await p.waitForFunction(() => !!window.__HOLO_TEST__?.view);
  const objects = [
    createFurniture("wardrobe", [0, 0, -4]),
    ...(blocked ? [createFurniture("wardrobe", [2.8, 0, -4])] : []),
  ];
  await p.locator('input[type=file][accept=".json"]').setInputFiles({
    name: "controls.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 1, objects })),
  });
  await expect(p.locator("footer .status")).toContainText("Replace complete.");
  return objects;
}
async function enter(p: Page) {
  const button = p.getByRole("button", {
      name: "Enter Walkthrough",
      exact: true,
    }),
    b = (await button.boundingBox())!;
  await button.click();
  await expect
    .poll(() => p.evaluate(() => document.pointerLockElement?.tagName))
    .toBe("CANVAS");
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
test("entry acquires real mouse lock; one native Escape restores camera, layout and history", async ({
  page,
}) => {
  await ready(page);
  const before = await view(page),
    h = await snap(page),
    data = await scene(page),
    layout = await page.evaluate(() =>
      localStorage.getItem("holobuild.workspace.v1"),
    );
  const point = await enter(page);
  await expect(
    page.getByRole("button", { name: "Look Around", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(point.x + 40, point.y + 10);
  await expect
    .poll(async () =>
      Math.abs((await view(page)).quaternion[1] - before.quaternion[1]),
    )
    .toBeGreaterThan(0.01);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Enter Walkthrough", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  expect(await scene(page)).toEqual(data);
  expect(await snap(page)).toEqual(h);
  await expect
    .poll(async () =>
      Math.max(
        ...(await view(page)).position.map((v, i) =>
          Math.abs(v - before.position[i]),
        ),
      ),
    )
    .toBeLessThan(0.001);
  expect(
    await page.evaluate(() => localStorage.getItem("holobuild.workspace.v1")),
  ).toBe(layout);
});
test("Ctrl right-drag picks at locked center, freezes camera, rotates preview and commits once", async ({
  page,
}) => {
  const data = await ready(page),
    h = (await snap(page)).history,
    point = await enter(page),
    before = await view(page);
  await page.keyboard.down("Control");
  await page.mouse.down({ button: "right" });
  await expect
    .poll(async () => (await snap(page)).preview?.id)
    .toBe(data[0].id);
  await page.mouse.move(point.x + 100, point.y);
  await page.keyboard.press("ArrowRight");
  expect(await scene(page)).toEqual(data);
  expect((await snap(page)).history).toBe(h);
  expect((await snap(page)).preview?.rotation?.[1]).toBeCloseTo(Math.PI / 12);
  expect((await view(page)).quaternion).toEqual(before.quaternion);
  expect(
    await page.evaluate(() =>
      document.querySelector("canvas[data-engine]")!.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
        }),
      ),
    ),
  ).toBe(false);
  await page.mouse.up({ button: "right" });
  await page.keyboard.up("Control");
  await expect.poll(async () => (await snap(page)).history).toBe(h + 1);
  const moved = await scene(page);
  expect(moved[0].position).not.toEqual(data[0].position);
  await page.keyboard.press("Escape");
  await activate(page, "Undo");
  expect(await scene(page)).toEqual(data);
  await activate(page, "Redo");
  expect(await scene(page)).toEqual(moved);
});
test("invalid drag cancels; Escape mid-drag exits once without mutation", async ({
  page,
}) => {
  const data = await ready(page, true),
    h = await snap(page),
    point = await enter(page);
  await page.keyboard.down("Control");
  await page.mouse.down({ button: "right" });
  await expect
    .poll(async () => (await snap(page)).preview?.id)
    .toBe(data[0].id);
  await page.mouse.move(point.x + 100, point.y);
  const perPixel =
    ((await snap(page)).preview!.position[0] - data[0].position[0]) / 100;
  await page.mouse.move(
    point.x + (data[1].position[0] - data[0].position[0]) / perPixel,
    point.y,
  );
  await expect.poll(async () => (await snap(page)).preview?.valid).toBe(false);
  await page.mouse.up({ button: "right" });
  await page.keyboard.up("Control");
  expect(await scene(page)).toEqual(data);
  expect((await snap(page)).history).toBe(h.history);
  await page.keyboard.down("Control");
  await page.mouse.down({ button: "right" });
  await page.mouse.move(point.x + 610, point.y);
  await page.keyboard.press("Escape");
  await page.mouse.up({ button: "right" });
  await page.keyboard.up("Control");
  await expect(
    page.getByRole("button", { name: "Enter Walkthrough", exact: true }),
  ).toBeVisible();
  expect(await scene(page)).toEqual(data);
  expect((await snap(page)).history).toBe(h.history);
  expect((await snap(page)).preview).toBeNull();
});
test("E toggles catalog and restores lock, typing ignores shortcuts, arrows rotate ghost, Escape exits placement", async ({
  page,
}) => {
  await ready(page);
  const data = await scene(page);
  await enter(page);
  await page.keyboard.press("e");
  await expect(
    page.getByRole("region", { name: "Furniture catalog" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  const search = page.getByRole("searchbox", { name: "Search furniture" });
  await search.fill("Armchair");
  await page.keyboard.press("e");
  await expect(search).toHaveValue("Armchaire");
  await page.keyboard.press("ArrowRight");
  await page.locator("canvas[data-engine]").focus();
  await page.keyboard.press("e");
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.tagName))
    .toBe("CANVAS");
  await page.keyboard.press("e");
  await search.fill("Armchair");
  await page.getByRole("button", { name: /^Armchair/ }).click();
  const b = (await page.locator("canvas[data-engine]").boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.25, b.y + b.height * 0.75);
  await expect(
    page.getByRole("button", { name: "Place furniture", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "Place furniture", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Enter Walkthrough", exact: true }),
  ).toBeVisible();
  expect(await scene(page)).toEqual(data);
});
test("refused automatic lock requests once and supports full Escape exit from keyboard or catalog", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let calls = 0;
    HTMLCanvasElement.prototype.requestPointerLock = () => {
      document.documentElement.dataset.lockRequests = String(++calls);
      return Promise.reject(new Error("test refusal"));
    };
  });
  await ready(page);
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  await expect(page.getByLabel("Exploration controls")).toContainText(
    "declined",
  );
  await expect(page.locator("html")).toHaveAttribute("data-lock-requests", "1");
  await activate(page, "Controls");
  await activate(page, "Use keyboard / touch");
  await page.keyboard.press("e");
  await expect(
    page.getByRole("region", { name: "Furniture catalog" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Enter Walkthrough", exact: true }),
  ).toBeVisible();
});

test("repeated entry/catalog/exit cleans listeners; arrows without selection do not turn the camera", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const counts: Record<string, number> = {},
      add = window.addEventListener.bind(window),
      remove = window.removeEventListener.bind(window);
    const publish = () => {
      if (document.documentElement)
        document.documentElement.dataset.controlsListeners = JSON.stringify(
          Object.fromEntries(Object.entries(counts).filter(([, v]) => v !== 0)),
        );
    };
    window.addEventListener = ((
      ...args: Parameters<typeof window.addEventListener>
    ) => {
      counts[args[0]] = (counts[args[0]] ?? 0) + 1;
      publish();
      add(...args);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((
      ...args: Parameters<typeof window.removeEventListener>
    ) => {
      counts[args[0]] = (counts[args[0]] ?? 0) - 1;
      publish();
      remove(...args);
    }) as typeof window.removeEventListener;
  });
  await ready(page);
  const baseline = await page
      .locator("html")
      .getAttribute("data-controls-listeners"),
    data = await scene(page),
    h = (await snap(page)).history;
  for (let i = 0; i < 3; i++) {
    await enter(page);
    const q = (await view(page)).quaternion;
    await page.keyboard.press("ArrowLeft");
    expect((await view(page)).quaternion).toEqual(q);
    expect((await snap(page)).history).toBe(h);
    await page.keyboard.press("e");
    await expect(
      page.getByRole("region", { name: "Furniture catalog" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Enter Walkthrough", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => page.locator("html").getAttribute("data-controls-listeners"))
      .toBe(baseline);
  }
  expect(await scene(page)).toEqual(data);
});
test("unlocked Ctrl right-drag uses screen targeting and selected arrow rotation stays undoable", async ({
  page,
}) => {
  const data = await ready(page),
    h = (await snap(page)).history;
  await enter(page);
  await activate(page, "Controls");
  await activate(page, "Use keyboard / touch");
  const point = await page.evaluate(
      (id) => window.__HOLO_TEST__!.project!(id),
      data[0].id,
    ),
    b = (await page.locator("canvas[data-engine]").boundingBox())!;
  await page.mouse.move(b.x + point!.x * b.width, b.y + point!.y * b.height);
  await page.keyboard.down("Control");
  await page.mouse.down({ button: "right" });
  await expect
    .poll(async () => (await snap(page)).preview?.id)
    .toBe(data[0].id);
  await page.mouse.move(
    b.x + point!.x * b.width + 60,
    b.y + point!.y * b.height,
  );
  await page.mouse.up({ button: "right" });
  await page.keyboard.up("Control");
  await expect.poll(async () => (await snap(page)).history).toBe(h + 1);
  const moved = await scene(page);
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await snap(page)).history).toBe(h + 2);
  const turned = await scene(page);
  expect(turned[0].position).toEqual(moved[0].position);
  await page.keyboard.press("Escape");
  await activate(page, "Undo");
  expect(await scene(page)).toEqual(moved);
  await activate(page, "Undo");
  expect(await scene(page)).toEqual(data);
  await activate(page, "Redo");
  await activate(page, "Redo");
  expect(await scene(page)).toEqual(turned);
});
