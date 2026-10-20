import { setPlannerMode } from "../helpers/workspaceTools";
import { test, expect } from "@playwright/test";
import { showTools } from "../helpers/workspaceTools";
const prompt =
  "Build a two-story modern house with yellow walls, a purple wooden door, six windows, three on each floor, and a pink roof.";
test("detailed house retains six real segmented windows and appearance through history and save/load", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await showTools(page, "ai");
  await setPlannerMode(page, "offline");
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

test("default assistant refines a confirmed structure through a real multi-turn preview and shared history", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await showTools(page, "ai");
  await expect(
    page.getByLabel("Planner mode", { exact: true }),
  ).not.toBeVisible();
  const ask = async (text: string) => {
    await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
    await page
      .getByRole("button", { name: "Send request", exact: true })
      .click();
  };
  const scene = () => page.evaluate(() => window.__HOLO_TEST__!.scene());
  await ask("Can you make a small modern home?");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  const base = await scene();
  await ask("Yes.");
  const initial = await scene();
  expect(initial.length).toBeGreaterThan(base.length);
  await expect(
    page.getByRole("log", { name: "Design conversation" }),
  ).toContainText("Would you like to make any changes");
  await ask("Give it a blue roof and larger windows");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  expect(await scene()).toEqual(initial);
  await ask("Looks good.");
  const refined = await scene();
  expect(refined.find((p) => p.construction?.role === "roof")?.color).toBe(
    "#508ee8",
  );
  await ask("Make it two stories");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  await ask("Perfect.");
  const two = await scene();
  expect(
    two.find((p) => p.construction)?.construction?.structure?.template?.floors,
  ).toBe(2);
  expect(two.find((p) => p.construction?.role === "roof")?.color).toBe(
    "#508ee8",
  );
  await ask("Actually, undo that.");
  expect(await scene()).toEqual(refined);
  await ask("Redo");
  expect(await scene()).toEqual(two);
  await ask("Add an animated hinged door");
  await expect(
    page.getByRole("log", { name: "Design conversation" }),
  ).toContainText("not supported");
  expect(await scene()).toEqual(two);
  await ask("That's perfect, I'm done.");
  await expect(
    page.getByRole("log", { name: "Design conversation" }),
  ).toContainText("design is complete");
  await page
    .getByRole("button", { name: "New design conversation", exact: true })
    .click();
  expect(await scene()).toEqual(two);
  await expect(
    page.getByRole("log", { name: "Design conversation" }),
  ).toContainText("New conversation");
});
test("manual voice transcript remains editable and speech failures preserve typed input", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class Speech {
      onstart: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      start() {
        this.onstart?.();
      }
      abort() {}
      constructor() {
        (window as unknown as { voice104: Speech }).voice104 = this;
      }
    }
    Object.defineProperty(window, "SpeechRecognition", {
      value: Speech,
      configurable: true,
    });
  });
  await page.goto("/?testInput");
  await showTools(page, "ai");
  const input = page.getByLabel("Ask HoloBuild", { exact: true });
  await input.fill("Build a house");
  await page
    .getByRole("button", { name: "Start listening", exact: true })
    .click();
  await page.evaluate(() =>
    (
      window as unknown as {
        voice104: { onerror: (e: { error: string }) => void };
      }
    ).voice104.onerror({ error: "network" }),
  );
  await expect(input).toHaveValue("Build a house");
  await expect(page.getByLabel("Listening status")).toContainText(
    "Speech service network",
  );
  await page
    .getByRole("button", { name: "Start listening", exact: true })
    .click();
  await page.evaluate(() =>
    (
      window as unknown as { voice104: { onresult: (e: unknown) => void } }
    ).voice104.onresult({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: "Generate a home" } }],
    }),
  );
  await expect(input).toHaveValue("Generate a home");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toHaveCount(0);
  await input.fill("Generate a home with two windows");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
});

test("Part-scoped natural editing coexists with mouse selection, inspector edits and explicit whole-structure commands", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await showTools(page, "ai");
  const ask = async (text: string) => {
    await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
    await page
      .getByRole("button", { name: "Send request", exact: true })
      .click();
  };
  const scene = () => page.evaluate(() => window.__HOLO_TEST__!.scene());
  await ask("Build a house with two windows");
  await ask("Yes");
  const initial = await scene();
  const wall = initial.find((o) => o.construction?.role === "wall")!;
  await page.getByLabel("Selection mode").selectOption("component");
  await page.getByRole("tab", { name: "Collection", exact: true }).click();
  await page.getByLabel("Search scene objects").fill(wall.name);
  await page
    .locator(".scene-list button")
    .filter({ hasText: wall.name })
    .last()
    .click();
  await page.getByRole("tab", { name: "Inspector", exact: true }).click();
  await expect(
    page
      .getByLabel("Precision Inspector", { exact: true })
      .getByRole("heading", { name: wall.name, exact: true }),
  ).toBeVisible();
  await ask("Make this wall blue");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  expect(await scene()).toEqual(initial);
  await ask("Yes");
  const blue = await scene();
  expect(
    blue.filter((o, i) => JSON.stringify(o) !== JSON.stringify(initial[i])),
  ).toHaveLength(1);
  expect(blue.find((o) => o.id === wall.id)?.color).toBe("#0000ff");
  expect(blue.find((o) => o.id === wall.id)?.construction).toEqual(
    wall.construction,
  );
  await expect(page.getByLabel("Selection mode")).toHaveValue("component");
  await page.getByRole("tab", { name: "Inspector", exact: true }).click();
  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await page.getByLabel("Material", { exact: true }).selectOption("brick");
  const inspected = await scene();
  expect(inspected.find((o) => o.id === wall.id)?.material).toBe("brick");
  await ask("Make this wall yellow");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Inspector", exact: true }).click();
  await page.getByLabel("Material", { exact: true }).selectOption("wood");
  const latest = await scene();
  await ask("Yes");
  expect(await scene()).toEqual(latest);
  await expect(
    page.getByRole("log", { name: "Design conversation" }),
  ).toContainText("changed");
  await ask("Cancel");
  await ask("Change all the walls to yellow");
  await expect(
    page.getByLabel("Structure modification preview", { exact: true }),
  ).toBeVisible();
  expect(await scene()).toEqual(latest);
  await ask("Yes");
  const whole = await scene();
  expect(
    whole
      .filter((o) => o.construction?.role === "wall")
      .every((o) => o.color === "#f5d76e"),
  ).toBe(true);
  expect(whole.find((o) => o.id === wall.id)?.material).toBe("wood");
  await expect(page.getByLabel("Selection mode")).toHaveValue("structure");
  await ask("Undo");
  expect(await scene()).toEqual(latest);
  await ask("Redo");
  expect(await scene()).toEqual(whole);
});
