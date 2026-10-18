import { setPlannerMode } from "../helpers/workspaceTools";
import { showTools, openWorkspaceSection } from "../helpers/workspaceTools";
import { test, expect, type Page } from "@playwright/test";
import { target, hold, poseAt } from "../helpers/gestureInput";
import { offlinePlan } from "../../src/generation/offline";
async function open(page: Page, key: string) {
  await openWorkspaceSection(page, key);
}
async function ready(page: Page) {
  await page.goto("/?testInput");
  await target(page);
  await setPlannerMode(page, "offline");
  await open(page, "tools.voice");
}
async function plan(
  page: Page,
  text = "Build a small house with four walls and a roof",
) {
  await showTools(page, "ai");
  await showTools(page, "ai");
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
}
test("live synthetic tracking continues with a generated multi-level structure and minimized input", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext("2d")!;
        let frame = 0;
        const draw = () => {
          context.fillStyle = `rgb(${frame++ % 100},20,30)`;
          context.fillRect(0, 0, 640, 480);
        };
        draw();
        const timer = setInterval(draw, 100);
        const stream = canvas.captureStream(10);
        stream.getTracks().forEach((track) => {
          const stop = track.stop.bind(track);
          track.stop = () => {
            clearInterval(timer);
            stop();
            document.documentElement.dataset.generationCameraStopped = "true";
          };
        });
        return stream;
      },
    }),
  );
  await ready(page);
  await plan(page, "Build a tower with five levels");
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  await open(page, "tools.scene");
  await page
    .getByRole("button", { name: "Fit structure in view", exact: true })
    .click();
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.locator(".camera-message")).toContainText(
    "Local tracking",
    { timeout: 60000 },
  );
  await expect(page.locator(".camera-meta")).toContainText(
    /No hand · [1-9]\d* Hz/,
    { timeout: 20000 },
  );
  await page
    .getByRole("button", { name: "Minimize Gesture Input", exact: true })
    .click();
  const time = await page
    .locator("video")
    .evaluate((video: HTMLVideoElement) => video.currentTime);
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((video: HTMLVideoElement) => video.currentTime),
    )
    .toBeGreaterThan(time + 0.2);
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.scene().length),
  ).toBeGreaterThan(20);
  await page
    .getByRole("button", { name: "Stop Gesture Input camera", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-generation-camera-stopped",
    "true",
  );
});
test("offline preview is inert, Cancel preserves scene, confirmed batch undoes/redoes atomically and saves/loads stable IDs", async ({
  page,
}) => {
  await ready(page);
  const original = await page.evaluate(() => window.__HOLO_TEST__!.scene());
  await plan(page);
  await expect(page.getByLabel("Planner source")).toContainText(
    "Offline deterministic",
  );
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    original,
  );
  await page
    .getByRole("button", { name: "Cancel generation", exact: true })
    .click();
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    original,
  );
  await plan(page);
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  const built = await page.evaluate(() => window.__HOLO_TEST__!.scene());
  expect(built.length).toBeGreaterThan(6);
  expect(built.slice(1).every((o) => !!o.construction)).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    original,
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    built,
  );
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await downloading;
  const json = await page.evaluate(() =>
    localStorage.getItem("holobuild.scene")!,
  );
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Reset scene", exact: true }).click();
  await page.locator("input[type=file][accept='.json']").setInputFiles({
    name: "generated.json",
    mimeType: "application/json",
    buffer: Buffer.from(json),
  });
  await expect
    .poll(() => page.evaluate(() => window.__HOLO_TEST__!.scene()))
    .toEqual(built);
});
test("two-story windows, parameter controls and component preview retain the adaptive workspace", async ({
  page,
}) => {
  await ready(page);
  await open(page, "tools.generator-parameters");
  await page.getByLabel("Width (m)", { exact: true }).fill("8");
  await page
    .getByLabel("Offline surface material", { exact: true })
    .selectOption("brick");
  await plan(page, "Create a modern two-story house with windows");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toContainText("8.00 × 6.60 × 6.00");
  await page.getByText("Generated components", { exact: true }).click();
  await expect(page.locator(".component-list")).toContainText("glass window");
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  const parts = await page.evaluate(() =>
    window.__HOLO_TEST__!.scene().filter((o) => o.construction),
  );
  expect(parts.some((o) => o.construction?.role === "window")).toBe(true);
  expect(
    parts
      .filter((o) => o.construction?.role === "wall")
      .every((o) => o.material === "brick"),
  ).toBe(true);
  await open(page, "tools.scene");
  await page
    .getByRole("button", { name: "Fit structure in view", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window
          .__HOLO_TEST__!.scene()
          .filter((o) => o.construction)
          .map((o) => window.__HOLO_TEST__!.project!(o.id)!)
          .every((p) => p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1),
      ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Collapse construction tools", exact: true })
    .click();
  await expect(page.getByTitle("Create Cube", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Expand construction tools", exact: true })
    .click();
  await open(page, "tools.voice");
  await expect(page.getByLabel("Generation result")).toContainText(
    "Constructed",
  );
  await showTools(page, "ai");
  await page
    .getByLabel("Ask HoloBuild", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/milestone-9-generated.png" });
});
test("scene changes invalidate reviewed placement; regeneration and rejected requests preserve edits", async ({
  page,
}) => {
  await ready(page);
  await plan(page, "Build a bridge supported by pillars");
  await showTools(page, "build");
  await page.getByTitle("Create Sphere", { exact: true }).click();
  await showTools(page, "ai");
  await expect(
    page.getByRole("button", { name: "Confirm construction", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Regenerate plan", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm construction", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Cancel generation", exact: true })
    .click();
  await showTools(page, "ai");
  await page
    .getByLabel("Ask HoloBuild", { exact: true })
    .fill("Build a castle");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(page.getByLabel("Generation result")).toContainText(
    "supported structure",
  );
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    2,
  );
});
test("mocked LLM validates to the same preview and clearly labels its source", async ({
  page,
}) => {
  const modelPlan = offlinePlan("room with a doorway");
  await page.route("**/api/planner/plan", (route) =>
    route.fulfill({
      json: { source: "llm", model: "mock-local", plan: modelPlan },
    }),
  );
  await ready(page);
  await showTools(page, "ai");
  await setPlannerMode(page, "llm");
  await plan(page, "Build a room");
  await expect(page.getByLabel("Planner source")).toContainText(
    "LLM · mock-local",
  );
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    1,
  );
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    modelPlan.objects.length + 1,
  );
});
test("invalid LLM output fails safely; Auto fallback is explicit and never called LLM", async ({
  page,
}) => {
  await page.route("**/api/planner/plan", (route) =>
    route.fulfill({
      json: { source: "llm", plan: { version: 1, execute: "alert(1)" } },
    }),
  );
  await ready(page);
  await showTools(page, "ai");
  await setPlannerMode(page, "llm");
  await showTools(page, "ai");
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill("Build a house");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(page.getByLabel("Generation result")).not.toContainText(
    "Planning…",
  );
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    1,
  );
  await showTools(page, "ai");
  await setPlannerMode(page, "auto");
  await plan(page, "Build a house with a gabled roof");
  await expect(page.getByLabel("Planner source")).toContainText(
    "Offline fallback",
  );
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toContainText("Offline");
});
test("Cancel aborts a pending model plan and late responses never create a preview", async ({
  page,
}) => {
  let release: () => void = () => {},
    received = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/planner/plan", async (route) => {
    received = true;
    await gate;
    await route
      .fulfill({ json: { source: "llm", plan: offlinePlan("house") } })
      .catch(() => {});
  });
  await ready(page);
  await showTools(page, "ai");
  await setPlannerMode(page, "llm");
  await showTools(page, "ai");
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill("Build a house");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect.poll(() => received).toBe(true);
  await page
    .getByRole("button", { name: "Cancel generation", exact: true })
    .click();
  release();
  await expect(page.getByLabel("Generation result")).toContainText("cancelled");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    1,
  );
});
test("text and final voice route explicit structures to preview; simple commands keep their old path", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("holobuild.voice-auto-submit.v1", "true");
    class Speech {
      onstart: (() => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      start() {
        this.onstart?.();
      }
      abort() {}
      constructor() {
        (window as unknown as { structureSpeech: Speech }).structureSpeech =
          this;
      }
    }
    Object.defineProperty(window, "SpeechRecognition", {
      value: Speech,
      configurable: true,
    });
  });
  await ready(page);
  await showTools(page, "ai");
  await setPlannerMode(page, "commands");
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill("Create a cube");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    2,
  );
  await showTools(page, "ai");
  await page
    .getByRole("button", { name: "Start listening", exact: true })
    .click();
  await setPlannerMode(page, "offline");
  const speak = () =>
    page.evaluate(() => {
      (
        window as unknown as {
          structureSpeech: { onresult: (e: unknown) => void };
        }
      ).structureSpeech.onresult?.({
        resultIndex: 0,
        results: [
          { isFinal: true, 0: { transcript: "Build a room with a doorway" } },
        ],
      });
    });
  await speak();
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  await speak();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    2,
  );
  await expect(page.getByLabel("Listening status")).toContainText(
    "Final transcript",
  );
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.scene().length),
  ).toBeGreaterThan(2);
});
test("generated parts remain targetable by the existing gesture ray/controller", async ({
  page,
}) => {
  await ready(page);
  await plan(page, "Build a bridge supported by pillars");
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  await page.getByLabel("Selection mode").selectOption("component");
  const scene = await page.evaluate(() => window.__HOLO_TEST__!.scene());
  const pillar = scene.filter((o) => o.construction?.role === "pillar").at(-1)!;
  const point = await page.evaluate(
    (id) => window.__HOLO_TEST__!.project!(id)!,
    pillar.id,
  );
  await hold(page, poseAt("pointing", point), 700);
  await hold(page, poseAt("pinch", point), 550);
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.snapshot().preview?.id),
  ).toBe(pillar.id);
  await hold(page, [], 100);
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    scene,
  );
});

test("planner budget defaults to 120s, pending requests are deduplicated and SSE labels real provider", async ({
  page,
}) => {
  await page.route("**/api/planner/status", (route) =>
    route.fulfill({
      json: {
        configured: true,
        models: ["mock-local"],
        model: "mock-local",
        provider: "Ollama",
        timeoutMs: 120000,
        connection: "connected",
      },
    }),
  );
  let calls = 0;
  let finish: () => void = () => {};
  const gate = new Promise<void>((r) => (finish = r));
  const plan = offlinePlan("Build a room");
  await page.route("**/api/planner/plan", async (route) => {
    calls++;
    expect(route.request().postDataJSON().timeoutMs).toBe(120000);
    await gate;
    await route.fulfill({
      contentType: "text/event-stream",
      body: `event: progress\ndata: {"stage":"Generating","provider":"Ollama"}\n\nevent: result\ndata: ${JSON.stringify({ source: "llm", provider: "Ollama", model: "mock-local", plan })}\n\n`,
    });
  });
  await ready(page);
  await setPlannerMode(page, "llm");
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill("Build a room");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(page.getByLabel("Planner activity")).toContainText("Connecting");
  await expect(
    page.getByRole("button", { name: "Send request", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Ask HoloBuild", { exact: true }).press("Enter");
  expect(calls).toBe(1);
  finish();
  await expect(page.getByLabel("Planner activity")).toContainText(
    "Ollama · Preview Ready",
  );
  await expect(page.getByLabel("Planner source")).toContainText("Ollama · LLM");
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Structure", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Edit", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByLabel("Structure Inspector", { exact: true }),
  ).toBeVisible();
});
