import { test, expect } from "../helpers/editorTest";
import { hold, poseAt, target } from "../helpers/gestureInput";
async function pair(
  page: import("@playwright/test").Page,
  d: number,
  pinch: boolean,
  angle = 0,
  ms = 600,
) {
  const points = [
    { x: 0.5 - (d * Math.cos(angle)) / 2, y: 0.4 - (d * Math.sin(angle)) / 2 },
    { x: 0.5 + (d * Math.cos(angle)) / 2, y: 0.4 + (d * Math.sin(angle)) / 2 },
  ];
  await page.evaluate(
    (hands) =>
      window.__HOLO_TEST__!.repeatHands(
        hands.map((landmarks) => ({ landmarks })),
      ),
    points.map((p) => poseAt(pinch ? "pinch" : "pointing", p)),
  );
  await page.clock.runFor(ms);
}
test("Auto is default: one-hand movement, release and Undo still work", async ({
  page,
}) => {
  await page.goto("/?testInput");
  const start = await target(page);
  await expect(page.getByLabel("Gesture mode", { exact: true })).toHaveValue(
    "auto",
  );
  await hold(page, poseAt("pointing", start.cursor));
  await hold(page, poseAt("pinch", start.cursor));
  await hold(
    page,
    poseAt("pinch", { x: start.cursor.x + 0.08, y: start.cursor.y }),
  );
  await hold(
    page,
    poseAt("pointing", { x: start.cursor.x + 0.08, y: start.cursor.y }),
  );
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.snapshot().history),
  ).toBe(1);
  await hold(page, [], 50);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await page.evaluate(() => window.__HOLO_TEST__!.scene()))[0]).toEqual(
    start.object,
  );
});
for (const intent of ["scale", "rotate"] as const)
  test(`Auto recognizes and locks ${intent} without a mode switch`, async ({
    page,
  }) => {
    await page.goto("/?testInput");
    await target(page);
    await hold(page, [], 50);
    await pair(page, 0.25, false);
    await pair(page, 0.25, true);
    await expect(page.getByLabel("Advanced gesture feedback")).toContainText(
      "Detecting",
    );
    await pair(
      page,
      intent === "scale" ? 0.36 : 0.25,
      true,
      intent === "rotate" ? 0.5 : 0,
      1000,
    );
    await expect(page.getByLabel("Advanced gesture feedback")).toContainText(
      intent.toUpperCase(),
    );
    const history = await page.evaluate(
      () => window.__HOLO_TEST__!.snapshot().history,
    );
    await pair(
      page,
      intent === "scale" ? 0.36 : 0.25,
      false,
      intent === "rotate" ? 0.5 : 0,
    );
    expect(
      await page.evaluate(() => window.__HOLO_TEST__!.snapshot().history),
    ).toBe(history + 1);
    await hold(page, [], 50);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect(
      (await page.evaluate(() => window.__HOLO_TEST__!.scene()))[0].scale,
    ).toEqual([1, 1, 1]);
  });

test("Auto manipulates a confirmed whole structure, remains locked, saves and reverses atomically", async ({
  page,
}) => {
  await page.goto("/?testInput");
  await target(page);
  await page.getByRole("tab", { name: "AI", exact: true }).click();
  await page
    .getByLabel("Ask HoloBuild", { exact: true })
    .fill("Build a house without doors");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(
    page.getByText("Preview only · nonselectable", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm construction", exact: true })
    .click();
  await expect(page.getByLabel("Selection mode")).toHaveValue("structure");
  await expect(
    page.getByRole("button", { name: "Edit Structure", exact: true }),
  ).toBeVisible();
  const before = await page.evaluate(() => window.__HOLO_TEST__!.scene());
  await hold(page, [], 50);
  await pair(page, 0.25, false);
  await pair(page, 0.25, true);
  await pair(page, 0.32, true, 0, 900);
  await expect(page.getByLabel("Advanced gesture feedback")).toContainText(
    "SCALE",
  );
  await pair(page, 0.32, true, 0.4, 500);
  await expect(page.getByLabel("Advanced gesture feedback")).toContainText(
    "SCALE",
  );
  await pair(page, 0.32, false, 0.4);
  expect(
    await page.evaluate(() => window.__HOLO_TEST__!.snapshot().history),
  ).toBe(2);
  const changed = await page.evaluate(() => window.__HOLO_TEST__!.scene());
  expect(changed[0]).toEqual(before[0]);
  expect(
    changed
      .filter((o) => o.construction)
      .some(
        (o, i) =>
          JSON.stringify(o) !==
          JSON.stringify(before.filter((o) => o.construction)[i]),
      ),
  ).toBe(true);
  await hold(page, [], 50);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    before,
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await page.evaluate(() => window.__HOLO_TEST__!.scene())).toEqual(
    changed,
  );
});
