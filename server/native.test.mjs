import { test } from "node:test";
import assert from "node:assert/strict";
import {
  standaloneStairSchema,
  nativeWallSchema,
} from "../shared/nativeSchema.mjs";
import { operationSchema } from "../shared/editSchema.mjs";
const flight = {
  steps: 8,
  height: 1.6,
  run: 0.25,
  width: 1,
  material: "wood",
  color: "#aabbcc",
};
test("standalone native operations retain bounded physical recipe data without fictitious floor connections", () => {
  assert.deepEqual(
    operationSchema.parse({ type: "design", standaloneStairs: flight }),
    { type: "design", standaloneStairs: flight },
  );
  for (const patch of [
    { height: 5 },
    { steps: 3 },
    { width: 10 },
    { run: 0 },
    { height: Infinity },
    { from: 0, to: 1 },
    { code: "execute" },
  ])
    assert.equal(
      standaloneStairSchema.safeParse({ ...flight, ...patch }).success,
      false,
    );
});
test("native wall openings require bounded local facade data and reject unknown execution fields", () => {
  const wall = {
    width: 3,
    height: 2,
    thickness: 0.25,
    material: "solid",
    color: "#aabbcc",
    openings: [
      {
        id: "window-1",
        kind: "window",
        level: 0,
        facade: "front",
        offset: 0,
        bottom: 1.1,
        width: 1,
        height: 0.8,
        panel: true,
      },
    ],
  };
  assert.equal(nativeWallSchema.safeParse(wall).success, true);
  assert.equal(
    nativeWallSchema.safeParse({
      ...wall,
      openings: [{ ...wall.openings[0], level: 1 }],
    }).success,
    false,
  );
  assert.equal(
    operationSchema.safeParse({
      type: "design",
      nativeWall: { ...wall, script: "run" },
    }).success,
    false,
  );
  assert.equal(
    operationSchema.safeParse({
      type: "design",
      nativeWall: { ...wall, width: NaN },
    }).success,
    false,
  );
});
