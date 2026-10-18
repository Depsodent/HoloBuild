import { offlinePlan } from "../../src/generation/offline";
import { showTools } from "../helpers/workspaceTools";
import { test, expect, type Page } from "@playwright/test";
import { target } from "../helpers/gestureInput";
async function command(page: Page, text: string) {
  await showTools(page, "ai");
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
}
async function ready(page: Page) {
  await page.goto("/?testInput");
  await target(page);
  await showTools(page, "ai");
}
async function mock(page: Page, unsupported = false) {
  await page.addInitScript(
    ({ unsupported }) => {
      class Fake {
        continuous = false;
        interimResults = false;
        lang = "";
        maxAlternatives = 1;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((e: { error: string }) => void) | null = null;
        onresult:
          | ((e: {
              resultIndex: number;
              results: { isFinal: boolean; 0: { transcript: string } }[];
            }) => void)
          | null = null;
        start() {
          this.onstart?.();
        }
        abort() {}
        constructor() {
          (window as unknown as { mockSpeech: Fake }).mockSpeech = this;
        }
      }
      Object.defineProperty(window, "SpeechRecognition", {
        value: unsupported ? undefined : Fake,
        configurable: true,
      });
      Object.defineProperty(window, "webkitSpeechRecognition", {
        value: undefined,
        configurable: true,
      });
    },
    { unsupported },
  );
}
async function speak(page: Page, text: string, final = true) {
  await page.evaluate(
    ({ text, final }) => {
      const w = window as unknown as {
        mockSpeech: { onresult: (e: unknown) => void };
      };
      w.mockSpeech.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: final, 0: { transcript: text } }],
      });
    },
    { text, final },
  );
}
test("text creation, transforms, materials, history and shared portable save work", async ({
  page,
}) => {
  await ready(page);
  await command(page, "Add a sphere");
  await expect(page.getByLabel("Command result")).toHaveText("Created sphere.");
  await command(page, "move it up by 2 meters");
  await command(page, "rotate it by 45 degrees");
  await command(page, "scale it by 1.5");
  await command(page, "Make the selected object red");
  await command(page, "Apply wood material");
  let scene = await page.evaluate(() => window.__HOLO_TEST__!.scene());
  expect(scene.at(-1)).toMatchObject({
    type: "sphere",
    color: "#ff0000",
    material: "wood",
    scale: [1.5, 1.5, 1.5],
  });
  await command(page, "Undo");
  await command(page, "Redo");
  await command(page, "Select last created object");
  const download = page.waitForEvent("download");
  await command(page, "Save the scene");
  expect((await download).suggestedFilename()).toBe("holobuild-scene.json");
  await expect(page.getByLabel("Command result")).toContainText(
    "Saved locally",
  );
  scene = await page.evaluate(
    () => JSON.parse(localStorage.getItem("holobuild.scene")!).objects,
  );
  expect(scene).toHaveLength(2);
});
test("errors never guess targets or bypass geometry limits; delete requires confirmation", async ({
  page,
}) => {
  await ready(page);
  await command(page, "Create a cube");
  await command(page, "Select cube");
  await expect(page.getByLabel("Command result")).toContainText("Ambiguous");
  await command(page, "Deselect");
  await command(page, "Make it blue");
  await expect(page.getByLabel("Command result")).toContainText(
    "Selected object required",
  );
  await command(page, "Select last created object");
  await command(page, "move it down 3");
  await expect(page.getByLabel("Command result")).toContainText(
    "Action rejected",
  );
  await command(page, "create a cube; delete it");
  await expect(page.getByLabel("Command result")).toContainText("Unsupported");
  await command(page, "delete it");
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    2,
  );
  await page
    .getByRole("button", { name: "Cancel command", exact: true })
    .click();
  await command(page, "delete it");
  await page
    .getByRole("button", { name: "Confirm command", exact: true })
    .click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    1,
  );
  await command(page, "undo");
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    2,
  );
  await command(page, "clear the scene");
  await page
    .getByRole("button", { name: "Confirm command", exact: true })
    .click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    0,
  );
  await command(page, "undo");
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    2,
  );
});
test("command section remembers collapse and text typing preserves keyboard editing", async ({
  page,
}) => {
  await ready(page);
  await showTools(page, "ai");
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill("rotate it 90");
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.scene()[0].rotation),
  ).toEqual([0, 0, 0]);
  await showTools(page, "ai");
  await page.getByLabel("Ask HoloBuild", { exact: true }).press("Enter");
  await expect(page.getByLabel("Command result")).toContainText("Updated");
  await showTools(page, "build");
  await expect(page.getByLabel("Ask HoloBuild", { exact: true })).toBeHidden();
  await page.reload();
  await target(page);
  await expect(
    page.getByRole("tab", { name: "Build", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Build", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Ask HoloBuild", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/milestone-8-commands.png" });
});
test("interim transcripts never execute; repeated final results execute once; stop ignores late results", async ({
  page,
}) => {
  await mock(page);
  await ready(page);
  await page
    .getByRole("button", { name: "Start listening", exact: true })
    .click();
  await expect(page.getByLabel("Listening status")).toHaveText("Listening…");
  await speak(page, "create a sphere", false);
  await expect(page.getByLabel("Live transcript")).toHaveText(
    "create a sphere",
  );
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    1,
  );
  await speak(page, "create a sphere");
  await speak(page, "create a sphere");
  await expect(page.getByLabel("Command result")).toHaveText("Created sphere.");
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    2,
  );
  await page
    .getByRole("button", { name: "Start listening", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Stop listening", exact: true })
    .click();
  await speak(page, "create a sphere");
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    2,
  );
});
test("speech permission failure and unsupported browsers retain text commands", async ({
  page,
}) => {
  await mock(page);
  await ready(page);
  await showTools(page, "ai");
  await page
    .getByRole("button", { name: "Start listening", exact: true })
    .click();
  await page.evaluate(() => {
    (
      window as unknown as {
        mockSpeech: { onerror: (e: { error: string }) => void };
      }
    ).mockSpeech.onerror({ error: "not-allowed" });
  });
  await expect(page.getByLabel("Listening status")).toContainText(
    "permission denied",
  );
  await command(page, "create a cone");
  await expect(page.getByLabel("Command result")).toHaveText("Created cone.");
});
test("unsupported speech still permits creation", async ({ page }) => {
  await mock(page, true);
  await ready(page);
  await expect(
    page.getByRole("button", { name: "Start listening", exact: true }),
  ).toBeDisabled();
  await command(page, "create a wall");
  await expect(page.getByLabel("Command result")).toHaveText("Created wall.");
});
test("collapsing commands stops microphone; confirmation cannot delete a changed selection", async ({
  page,
}) => {
  await mock(page);
  await ready(page);
  await showTools(page, "ai");
  await page
    .getByRole("button", { name: "Start listening", exact: true })
    .click();
  await showTools(page, "build");
  await showTools(page, "ai");
  await expect(page.getByLabel("Listening status")).toContainText("stopped");
  await command(page, "delete it");
  await showTools(page, "build");
  await showTools(page, "build");
  await page.getByTitle("Create Sphere", { exact: true }).click();
  await showTools(page, "ai");
  await page
    .getByRole("button", { name: "Confirm command", exact: true })
    .click();
  await expect(page.getByLabel("Command result")).toContainText(
    "Scene or selection changed",
  );
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    2,
  );
});

test("final capture can wait for manual submission; cancel discards late audio", async ({
  page,
}) => {
  await mock(page);
  await ready(page);
  await page.getByRole("button", { name: "AI Settings", exact: true }).click();
  await page.getByLabel("Auto-submit final transcript").uncheck();
  await page.getByRole("button", { name: "Request", exact: true }).click();
  await page
    .getByRole("button", { name: "Start listening", exact: true })
    .click();
  await speak(page, "create a cylinder");
  await expect(page.getByLabel("Listening status")).toContainText(
    "Final transcript",
  );
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    1,
  );
  await expect(page.getByLabel("Ask HoloBuild", { exact: true })).toHaveValue(
    "create a cylinder",
  );
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    2,
  );
  await page
    .getByRole("button", { name: "Start listening", exact: true })
    .click();
  await speak(page, "create a sphere", false);
  await page
    .getByRole("button", { name: "Cancel voice request", exact: true })
    .click();
  await speak(page, "create a sphere");
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    2,
  );
  await page.reload();
  await target(page);
  await showTools(page, "ai");
  await page.getByRole("button", { name: "AI Settings", exact: true }).click();
  await expect(
    page.getByLabel("Auto-submit final transcript"),
  ).not.toBeChecked();
});

test("Commands explains natural-language builds without sending an AI request", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/planner/plan", (route) => {
    calls++;
    return route.fulfill({ status: 503, json: { error: "unexpected" } });
  });
  await ready(page);
  await page
    .getByLabel("Planner mode", { exact: true })
    .selectOption("commands");
  await command(page, "Build a small house with four walls and a roof");
  await expect(page.getByLabel("Command result")).toContainText(
    "Switch from Commands",
  );
  expect(calls).toBe(0);
  await command(page, "Create a sphere");
  await expect(page.getByLabel("Command result")).toHaveText("Created sphere.");
});
test("typed and final speech share LLM quota diagnostics and recover in browsers without new AbortSignal APIs", async ({
  page,
}) => {
  await mock(page);
  await page.addInitScript(() => {
    Object.defineProperty(AbortSignal, "any", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(AbortSignal, "timeout", {
      value: undefined,
      configurable: true,
    });
  });
  const prompts: string[] = [];
  let reject = true;
  await page.route("**/api/planner/status", (route) =>
    route.fulfill({
      json: {
        configured: true,
        models: ["mock"],
        model: "mock",
        provider: "Gemini",
        timeoutMs: 30000,
        connection: "connected",
      },
    }),
  );
  await page.route("**/api/planner/plan", (route) => {
    prompts.push(route.request().postDataJSON().prompt);
    return route.fulfill(
      reject
        ? {
            status: 429,
            headers: { "Retry-After": "12" },
            json: {
              kind: "rate-limit",
              error: "Too many requests; retry in 12 seconds.",
              requestId: "regression-123",
            },
          }
        : {
            json: {
              source: "llm",
              model: "mock",
              plan: offlinePlan("Build a house"),
            },
          },
    );
  });
  await ready(page);
  await page.getByLabel("Planner mode", { exact: true }).selectOption("llm");
  const prompt = "Build a small house with four walls and a roof";
  await command(page, prompt);
  await expect(page.getByLabel("Generation result")).toContainText(
    "retry in 12 seconds. Reference: regression-123",
  );
  await page
    .getByRole("button", { name: "Start listening", exact: true })
    .click();
  await speak(page, prompt);
  await expect.poll(() => prompts.length).toBe(2);
  await expect(page.getByLabel("Generation result")).toContainText(
    "Reference: regression-123",
  );
  expect(prompts).toEqual([prompt, prompt]);
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    1,
  );
  reject = false;
  await command(page, prompt);
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.scene().length),
  ).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene().length)).toBe(
    1,
  );
});
