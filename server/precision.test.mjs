import { test } from "node:test";
import assert from "node:assert/strict";
import { editPlanSchema } from "../shared/editSchema.mjs";
import { operationContract } from "./plannerContracts.mjs";
test("precision surface transport accepts bounded optical values with role/floor targets", () => {
  for (const operation of [
    {
      type: "surface",
      values: { roughness: 0.2, metalness: 1, opacity: 0.5 },
      role: "roof",
      level: 1,
    },
    { type: "surface", reset: true },
  ])
    assert.deepEqual(editPlanSchema.parse({ version: 1, operation }), {
      version: 1,
      operation,
    });
  assert.ok(operationContract.includes("type:surface"));
});
test("precision contract does not accept provider executable fields or out of range material values", () => {
  for (const values of [
    { roughness: Infinity },
    { opacity: 0 },
    { metalness: -1 },
    { script: "run" },
    {},
  ])
    assert.throws(() =>
      editPlanSchema.parse({
        version: 1,
        operation: { type: "surface", values },
      }),
    );
  assert.throws(() =>
    editPlanSchema.parse({
      version: 1,
      operation: { type: "surface", reset: true, values: { roughness: 0.2 } },
    }),
  );
});
