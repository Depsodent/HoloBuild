import { activate } from "../helpers/walkthrough";
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import { showTools, showLeft, setPlannerMode } from "../helpers/workspaceTools";
async function keyboard(page: Page) {
  if (
    !(await page
      .getByRole("button", { name: "Use keyboard / touch", exact: true })
      .isVisible())
  )
    await activate(page, "Controls");
  await activate(page, "Use keyboard / touch");
}
const scene = (p: Page) => p.evaluate(() => window.__HOLO_TEST__!.scene());
const view = (p: Page) => p.evaluate(() => window.__HOLO_TEST__!.view!());
async function ready(p: Page) {
  await p.goto("/?testInput");
  await p.waitForFunction(() => !!window.__HOLO_TEST__?.view);
}
async function ask(p: Page, text: string) {
  await showTools(p, "ai");
  await p.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
  await p.getByRole("button", { name: "Send request", exact: true }).click();
}
async function move(
  p: Page,
  key: string,
  axis: number,
  target: number,
  direction: number,
) {
  await p.keyboard.down(key);
  try {
    await p.waitForFunction(
      ({ axis, target, direction }) => {
        const feet = window.__HOLO_TEST__?.view?.().feet;
        return feet && direction * (feet[axis] - target) > 0;
      },
      { axis, target, direction },
      { timeout: 20000 },
    );
  } finally {
    await p.keyboard.up(key);
  }
}
async function sameCamera(p: Page, b: Awaited<ReturnType<typeof view>>) {
  await expect
    .poll(async () => {
      const a = await view(p);
      return Math.max(
        ...a.position.map((v, i) => Math.abs(v - b.position[i])),
        ...a.target.map((v, i) => Math.abs(v - b.target[i])),
      );
    })
    .toBeLessThan(0.001);
}
test("generated two-story house walkthrough crosses a door, climbs stairs and reaches balcony before exact editing/history/IO", async ({
  page,
}) => {
  test.setTimeout(180000);
  const plan = JSON.parse(
    fs.readFileSync("tests/fixtures/ollama-architecture.json", "utf8"),
  );
  let calls = 0;
  await page.route("**/api/planner/assistant", (r) => {
    calls++;
    return r.fulfill({
      json: { source: "llm", model: "recorded-native", plan },
    });
  });
  await ready(page);
  await setPlannerMode(page, "llm");
  await ask(page, "generate a 2 story house including a balcony and stairs");
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  const built = await scene(page),
    meta = built.find((o) => o.construction)!.construction!.structure!,
    origin = meta.position,
    beforeView = await view(page),
    history = await page.evaluate(() => window.__HOLO_TEST__!.snapshot()),
    layout = await page.evaluate(() =>
      localStorage.getItem("holobuild.workspace.v1"),
    );
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  await expect(page.getByLabel("Exploration controls")).toBeVisible();
  const initialFeet = [...(await view(page)).feet!];
  await keyboard(page);
  await move(page, "w", 2, origin[2] + 2, -1);
  await move(page, "w", 2, origin[2] - 2.1, -1);
  await move(page, "a", 0, origin[0] - 1.45, -1);
  await move(page, "s", 2, origin[2] + 1.95, 1);
  expect((await view(page)).feet![1]).toBeCloseTo(3.4, 1);
  await move(page, "d", 0, origin[0] - 0.05, 1);
  await move(page, "s", 2, origin[2] + 3.55, 1);
  expect((await view(page)).feet![1]).toBeCloseTo(3.4, 1);
  await move(page, "w", 2, origin[2] + 2.35, -1);
  await activate(page, "Reset Position");
  await expect.poll(async () => (await view(page)).feet).toEqual(initialFeet);
  await activate(page, "Reset Position");
  await expect.poll(async () => (await view(page)).feet).toEqual(initialFeet);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Enter Walkthrough", exact: true }),
  ).toBeVisible();
  await sameCamera(page, beforeView);
  expect(await scene(page)).toEqual(built);
  expect(await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).toEqual(
    history,
  );
  expect(
    await page.evaluate(() => localStorage.getItem("holobuild.workspace.v1")),
  ).toBe(layout);
  const wall = built.find(
    (o) =>
      o.construction?.role === "wall" &&
      o.construction.level === 0 &&
      o.construction.facade === "front",
  )!;
  await page.getByLabel("Selection mode").selectOption("component");
  await showLeft(page, "collection");
  await page.getByLabel("Search scene objects").fill(wall.name);
  await page
    .locator(".scene-list button")
    .filter({ hasText: wall.name })
    .first()
    .click();
  await ask(page, "Add a window to the selected wall.");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  expect(await scene(page)).toEqual(built);
  await page
    .getByRole("button", { name: "Confirm structure edit", exact: true })
    .click();
  const edited = await scene(page);
  expect(
    edited.filter((o) => o.construction?.role === "window").length,
  ).toBeGreaterThan(
    built.filter((o) => o.construction?.role === "window").length,
  );
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await scene(page)).toEqual(built);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await scene(page)).toEqual(edited);
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const saved = await readFile((await (await d).path())!, "utf8");
  await showTools(page, "build");
  await page.getByTitle("Create Cube", { exact: true }).click();
  await page.locator("input[type=file][accept='.json']").setInputFiles({
    name: "walkthrough.json",
    mimeType: "application/json",
    buffer: Buffer.from(saved),
  });
  await expect
    .poll(async () => JSON.parse(JSON.stringify(await scene(page))))
    .toEqual(JSON.parse(saved).objects);
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  await expect(page.getByLabel("Construction tools sidebar")).toBeHidden();
  await activate(page, "Exit Walkthrough");
  await expect(page.getByLabel("Construction tools sidebar")).toBeVisible();
  expect(JSON.parse(JSON.stringify(await scene(page)))).toEqual(
    JSON.parse(saved).objects,
  );
});
test("read-only modes block shortcuts and selection; pointer lock failure and empty/narrow scenes recover", async ({
  page,
}) => {
  await ready(page);
  const base = await scene(page),
    pose = await view(page);
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  await keyboard(page);
  await page.keyboard.press("Delete");
  await page.keyboard.press("Control+z");
  await page.keyboard.press("g");
  expect(await scene(page)).toEqual(base);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() =>
    document.dispatchEvent(new Event("pointerlockerror")),
  );
  await expect(page.getByLabel("Exploration controls")).toContainText(
    /keyboard\/touch/i,
  );
  await activate(page, "Exit Walkthrough");
  await sameCamera(page, pose);
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Reset scene", exact: true }).click();
  await page.setViewportSize({ width: 480, height: 720 });
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  await expect(page.getByLabel("Exploration controls")).toContainText(
    "Mouse look active",
  );
  await keyboard(page);
  await move(page, "w", 2, -0.5, -1);
  expect((await view(page)).feet![1]).toBeCloseTo(0);
  await page.keyboard.press("Escape");
  expect(await scene(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    480,
  );
  await expect(
    page.getByRole("button", { name: "Enter Walkthrough", exact: true }),
  ).toBeFocused();
});
test("pending AI preview is preserved when entry is refused", async ({
  page,
}) => {
  await ready(page);
  await setPlannerMode(page, "offline");
  await ask(page, "Build a house");
  const before = await scene(page);
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  await expect(page.getByLabel("Explore scene")).toContainText(
    "Confirm or cancel",
  );
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  expect(await scene(page)).toEqual(before);
  await expect(page.getByLabel("Exploration controls")).toHaveCount(0);
});
test("synthetic webcam tracking stays mounted and emergency Stop works during walkthrough", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const c = document.createElement("canvas");
        c.width = 640;
        c.height = 480;
        const ctx = c.getContext("2d")!;
        let n = 0;
        const timer = setInterval(() => {
          ctx.fillStyle = "rgb(" + (n++ % 100) + ",30,40)";
          ctx.fillRect(0, 0, 640, 480);
        }, 100);
        const stream = c.captureStream(10);
        for (const t of stream.getTracks()) {
          const stop = t.stop.bind(t);
          t.stop = () => {
            clearInterval(timer);
            stop();
            document.documentElement.dataset.exploreStopped = "true";
          };
        }
        return stream;
      },
    });
  });
  await page.goto("/");
  await showLeft(page, "gesture");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.locator(".camera-message")).toContainText(
    "Local tracking",
    { timeout: 60000 },
  );
  const video = page.locator("video"),
    before = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(before + 0.2);
  expect(
    await video.evaluate(
      (v: HTMLVideoElement) =>
        (v.srcObject as MediaStream).getVideoTracks()[0].readyState,
    ),
  ).toBe("live");
  await activate(page, "Stop camera");
  await expect(page.locator("html")).toHaveAttribute(
    "data-explore-stopped",
    "true",
  );
  await activate(page, "Exit Walkthrough");
});

test("pointer-lock mouse look changes orientation and Escape releases it without scene history", async ({
  page,
}) => {
  await ready(page);
  const before = await scene(page),
    history = await page.evaluate(() => window.__HOLO_TEST__!.snapshot()),
    original = await view(page);
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  await activate(page, "Look Around");
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.tagName))
    .toBe("CANVAS");
  const start = await view(page);
  await page.mouse.move(700, 500);
  await expect
    .poll(async () => {
      const v = await view(page);
      return Math.max(
        ...v.quaternion.map((n, i) => Math.abs(n - start.quaternion[i])),
      );
    })
    .toBeGreaterThan(0.01);
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement === null))
    .toBe(true);
  await expect(
    page.getByRole("button", { name: "Enter Walkthrough", exact: true }),
  ).toBeVisible();
  await sameCamera(page, original);
  expect(await scene(page)).toEqual(before);
  expect(await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).toEqual(
    history,
  );
});

test("a delayed microphone permission precheck cannot start hidden capture after entering exploration", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as {
      m12Starts: number;
      finishM12Permission?: () => void;
    };
    w.m12Starts = 0;
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: {
        query: () =>
          new Promise((resolve) => {
            w.finishM12Permission = () => resolve({ state: "prompt" });
          }),
      },
    });
    class Fake {
      onstart: (() => void) | null = null;
      start() {
        w.m12Starts++;
        this.onstart?.();
      }
      abort() {}
    }
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: Fake,
    });
  });
  await ready(page);
  await showTools(page, "ai");
  await page
    .getByRole("button", { name: "Start listening", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof (window as unknown as { finishM12Permission?: () => void })
            .finishM12Permission,
      ),
    )
    .toBe("function");
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  const starts = await page.evaluate(async () => {
    const w = window as unknown as {
      m12Starts: number;
      finishM12Permission: () => void;
    };
    w.finishM12Permission();
    await Promise.resolve();
    await Promise.resolve();
    return w.m12Starts;
  });
  expect(starts).toBe(0);
  await activate(page, "Exit Walkthrough");
});

test("four primary controls, retired preferences and repeated mode cleanup preserve exact editor context", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    localStorage.setItem(
      "holobuild.exploration.v1",
      JSON.stringify({ speed: 6, eyeHeight: 1.2, views: [] }),
    );
    const tracked = new Map<string, Set<EventListenerOrEventListenerObject>>(),
      add = window.addEventListener.bind(window),
      remove = window.removeEventListener.bind(window);
    window.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (!tracked.has(type)) tracked.set(type, new Set());
      tracked.get(type)!.add(listener);
      add(type, listener, options);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) => {
      tracked.get(type)?.delete(listener);
      remove(type, listener, options);
    }) as typeof window.removeEventListener;
    (window as unknown as { m13Listeners: () => number[] }).m13Listeners =
      () => [tracked.get("keydown")?.size ?? 0, tracked.get("blur")?.size ?? 0];
  });
  await ready(page);
  const base = await scene(page),
    pose = await view(page),
    history = await page.evaluate(() => window.__HOLO_TEST__!.snapshot()),
    counts = await page.evaluate(() =>
      (window as unknown as { m13Listeners: () => number[] }).m13Listeners(),
    );
  expect(
    await page.evaluate(() => localStorage.getItem("holobuild.exploration.v1")),
  ).toBeNull();
  await expect(
    page.getByRole("button", { name: /Presentation|Present|Save viewpoint/ }),
  ).toHaveCount(0);
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole("button", { name: "Enter Walkthrough", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => document.pointerLockElement?.tagName))
      .toBe("CANVAS");
    const toolbar = page.getByRole("toolbar", { name: "Walkthrough controls" });
    await expect(toolbar.getByRole("button")).toHaveText([
      "Look Around",
      "Exit Walkthrough",
      "Reset Position",
      "Controls",
    ]);
    await expect(page.getByLabel("Walkthrough help")).toHaveCount(0);
    await toolbar
      .getByRole("button", { name: "Controls", exact: true })
      .press("Enter");
    await expect(page.getByLabel("Walkthrough help")).toContainText("WASD");
    await activate(page, "Close controls");
    await expect(
      toolbar.getByRole("button", { name: "Controls", exact: true }),
    ).toBeFocused();
    await activate(page, "Exit Walkthrough");
    await expect
      .poll(() => page.evaluate(() => document.pointerLockElement))
      .toBeNull();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as unknown as { m13Listeners: () => number[] }
          ).m13Listeners(),
        ),
      )
      .toEqual(counts);
    await sameCamera(page, pose);
  }
  expect((await view(page)).navigationBuilds).toBe(5);
  expect(await scene(page)).toEqual(base);
  expect(await page.evaluate(() => window.__HOLO_TEST__!.snapshot())).toEqual(
    history,
  );
});

test("pointer-lock rejection has keyboard fallback and four controls fit narrow text-zoom layout", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.requestPointerLock = () =>
      Promise.reject(new Error("deliberate denial"));
  });
  await page.setViewportSize({ width: 480, height: 720 });
  await ready(page);
  await page.evaluate(() => {
    document.body.style.zoom = "1.25";
  });
  const base = await scene(page);
  await page
    .getByRole("button", { name: "Enter Walkthrough", exact: true })
    .click();
  await activate(page, "Look Around");
  await expect(page.getByLabel("Exploration controls")).toContainText(
    "declined",
  );
  await expect(
    page.getByRole("button", { name: "Look Around", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await activate(page, "Controls");
  await expect(page.getByLabel("Walkthrough help")).toBeVisible();
  await keyboard(page);
  await move(page, "w", 2, -0.4, -1);
  await activate(page, "Reset Position");
  const toolbar = page.getByRole("toolbar", { name: "Walkthrough controls" });
  expect(await toolbar.getByRole("button").count()).toBe(4);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(481);
  await activate(page, "Exit Walkthrough");
  expect(await scene(page)).toEqual(base);
});
