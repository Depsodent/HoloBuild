import { test, expect, type Page } from "@playwright/test";
import { showTools, openWorkspaceSection } from "../helpers/workspaceTools";
import { offlinePlan } from "../../src/generation/offline";
const ask = async (page: Page, text: string) => {
  await page.getByLabel("Ask HoloBuild", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
};
const scene = (page: Page) =>
  page.evaluate(() => window.__HOLO_TEST__!.scene());
test("examples fill and focus the active composer through mouse keyboard and touch without requests", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/planner/assistant", (r) => {
    calls++;
    return r.fulfill({ status: 503, json: { error: "unexpected" } });
  });
  await page.route("**/api/planner/plan", (r) => {
    calls++;
    return r.fulfill({ status: 503, json: { error: "unexpected" } });
  });
  await page.goto("/?testInput");
  for (const keyboard of [false, true]) {
    await openWorkspaceSection(page, "tools.ai-examples");
    const example = page.getByRole("button", {
      name: "Build a small house with four walls and a roof",
      exact: true,
    });
    if (keyboard) {
      await example.focus();
      await page.keyboard.press("Enter");
    } else await example.click();
    await expect(page.getByLabel("Ask HoloBuild", { exact: true })).toHaveValue(
      "Build a small house with four walls and a roof",
    );
    await expect(
      page.getByLabel("Ask HoloBuild", { exact: true }),
    ).toBeFocused();
    await page
      .getByLabel("Ask HoloBuild", { exact: true })
      .fill("An editable example");
  }
  expect(calls).toBe(0);
  expect(await scene(page)).toHaveLength(1);
  const touch = await page.context().browser()!.newContext({ hasTouch: true });
  try {
    const p = await touch.newPage();
    await p.goto("/?testInput");
    await openWorkspaceSection(p, "tools.ai-examples");
    await p
      .getByRole("button", {
        name: "Build a small house with four walls and a roof",
        exact: true,
      })
      .tap();
    await expect(p.getByLabel("Ask HoloBuild", { exact: true })).toBeFocused();
    await expect(p.getByLabel("Ask HoloBuild", { exact: true })).toHaveValue(
      "Build a small house with four walls and a roof",
    );
  } finally {
    await touch.close();
  }
});
test("model-backed flexible request streams to useful reply and actual preview in independent contexts", async ({
  browser,
}) => {
  for (const phrase of [
    "I want a modern two-storey villa.",
    "Something sheltered for storing farm machinery, please.",
  ]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      let calls = 0;
      await page.route("**/api/planner/assistant", async (r) => {
        calls++;
        expect(
          r.request().postDataJSON().context.conversation.length,
        ).toBeLessThanOrEqual(6);
        await r.fulfill({
          contentType: "text/event-stream",
          body:
            'event: progress\ndata: {"stage":"Generating","provider":"Gemini"}\n\nevent: result\ndata: ' +
            JSON.stringify({
              source: "llm",
              provider: "Gemini",
              model: "mock",
              requestId: "fresh-context-1041",
              plan: {
                kind: "create",
                design: offlinePlan("house floors 2 with two windows").template,
                message:
                  "I interpreted this as a two-story house with fixed window panels.",
              },
            }) +
            "\n\n",
        });
      });
      await page.goto("/?testInput");
      await showTools(page, "ai");
      const base = await scene(page);
      await ask(page, phrase);
      await expect(
        page.getByLabel("Construction plan preview", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("log", { name: "Design conversation" }),
      ).toContainText("validated design preview");
      await expect(page.getByLabel("Planner source")).toContainText(
        "interpreted design",
      );
      expect(await scene(page)).toEqual(base);
      expect(calls).toBe(1);
      await ask(page, "Yes");
      expect((await scene(page)).length).toBeGreaterThan(base.length);
      await expect(
        page.getByRole("log", { name: "Design conversation" }),
      ).toContainText("Would you like");
      await expect(
        page.getByLabel("Ask HoloBuild", { exact: true }),
      ).toBeEnabled();
      await ask(page, "I'm done");
      expect((await scene(page)).length).toBeGreaterThan(base.length);
    } finally {
      await context.close();
    }
  }
});
test("continuous roof additional-window and width edits preserve the same confirmed house and exact history", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await showTools(page, "ai");
  await ask(page, "Can you make me a house?");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  await ask(page, "Yes");
  await ask(page, "Make it two stories");
  await ask(page, "Yes");
  const original = await scene(page);
  const group = original.find((o) => o.construction)!.construction!.structureId;
  for (const request of [
    "Make its roof blue.",
    "Add three windows to the second floor.",
    "Make the entire house wider.",
  ]) {
    const before = await scene(page);
    await ask(page, request);
    await expect(
      page.getByLabel("Structure modification preview", { exact: true }),
    ).toBeVisible();
    expect(await scene(page)).toEqual(before);
    await ask(page, "Looks good");
    const after = await scene(page);
    expect(
      new Set(
        after
          .filter((o) => o.construction)
          .map((o) => o.construction!.structureId),
      ),
    ).toEqual(new Set([group]));
    await ask(page, "Undo");
    expect(await scene(page)).toEqual(before);
    await ask(page, "Redo");
    expect(await scene(page)).toEqual(after);
  }
  const final = await scene(page);
  expect(
    final.filter(
      (o) => o.construction?.role === "window" && o.construction.level === 1,
    ),
  ).toHaveLength(5);
  expect(final.find((o) => o.construction?.role === "roof")?.color).toBe(
    "#508ee8",
  );
});
test("network and SSE errors produce actionable assistant replies and permit typed recovery", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/planner/assistant", (r) =>
    r.fulfill(
      fail
        ? {
            contentType: "text/event-stream",
            body: 'event: error\ndata: {"status":429,"kind":"rate-limit","error":"Too many requests; retry in 12 seconds.","requestId":"safe-1041-browser"}\n\n',
          }
        : {
            json: {
              source: "llm",
              plan: {
                kind: "clarify",
                message: "Would you like a house or warehouse?",
              },
            },
          },
    ),
  );
  await page.goto("/?testInput");
  await showTools(page, "ai");
  const prompt = "I would like a villa";
  await ask(page, prompt);
  await expect(
    page.getByRole("log", { name: "Design conversation" }),
  ).toContainText("safe-1041-browser");
  await expect(page.getByLabel("Ask HoloBuild", { exact: true })).toHaveValue(
    prompt,
  );
  await expect(
    page.getByRole("button", { name: "Send request", exact: true }),
  ).toBeEnabled();
  expect(await scene(page)).toHaveLength(1);
  fail = false;
  await ask(page, "A sheltered garden design");
  await expect(
    page.getByRole("log", { name: "Design conversation" }),
  ).toContainText("house or warehouse");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toHaveCount(0);
});
test("cancelling semantic interpretation ignores a late result and unblocks the composer", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let called = false;
  await page.route("**/api/planner/assistant", async (r) => {
    called = true;
    await gate;
    await r
      .fulfill({
        json: {
          source: "llm",
          plan: {
            kind: "create",
            design: offlinePlan("house").template,
            message: "A house",
          },
        },
      })
      .catch(() => {});
  });
  await page.goto("/?testInput");
  await showTools(page, "ai");
  await ask(page, "I want a villa");
  await expect.poll(() => called).toBe(true);
  await page
    .getByRole("button", { name: "Cancel generation", exact: true })
    .click();
  release();
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Ask HoloBuild", { exact: true })).toBeEnabled();
  await ask(page, "Build a house");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
});

test("an offline client gets a settled network error and recovers without losing its draft or scene", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await showTools(page, "ai");
  const before = await scene(page);
  await page.context().setOffline(true);
  const prompt = "I would like a two-storey villa";
  await ask(page, prompt);
  await expect(
    page.getByRole("log", { name: "Design conversation" }),
  ).toContainText("Cannot reach the planner");
  await expect(page.getByLabel("Ask HoloBuild", { exact: true })).toHaveValue(
    prompt,
  );
  await expect(
    page.getByRole("button", { name: "Send request", exact: true }),
  ).toBeEnabled();
  expect(await scene(page)).toEqual(before);
  await page.context().setOffline(false);
  await page.route("**/api/planner/assistant", (r) =>
    r.fulfill({
      json: {
        source: "llm",
        provider: "Gemini",
        plan: {
          kind: "create",
          design: offlinePlan("house floors 2").template,
          message: "A two-story house",
        },
      },
    }),
  );
  await ask(page, prompt);
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  expect(await scene(page)).toEqual(before);
});

test("flexible custom primitive composition remains available beyond named templates", async ({
  page,
}) => {
  await page.route("**/api/planner/assistant", (r) =>
    r.fulfill({
      json: {
        source: "llm",
        provider: "Gemini",
        model: "mock",
        plan: {
          kind: "compose",
          message: "One concrete display platform",
          plan: {
            version: 1,
            name: "Platform",
            units: "meters",
            objects: [
              {
                id: "slab",
                name: "Platform",
                role: "floor",
                type: "floor",
                position: [0, 0.1, 0],
                rotation: [0, 0, 0],
                dimensions: [4, 0.2, 4],
                material: "concrete",
                color: "#ffffff",
              },
            ],
            contacts: [],
            warnings: [],
          },
        },
      },
    }),
  );
  await page.goto("/?testInput");
  await showTools(page, "ai");
  const before = await scene(page);
  await ask(page, "A flat place to display my models");
  await expect(
    page.getByLabel("Construction plan preview", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Planner source")).toContainText(
    "validated generated geometry",
  );
  expect(await scene(page)).toEqual(before);
  await ask(page, "Yes");
  expect((await scene(page)).length).toBe(before.length + 1);
  await ask(page, "Undo");
  expect(await scene(page)).toEqual(before);
});
