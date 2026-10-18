import { it, expect } from "vitest";
import { offlinePlan } from "../../src/generation/offline";
import { materializePlan } from "../../src/generation/engine";
import {
  requestedAppearance,
  normalizeDesignRequest,
} from "../../src/generation/designLanguage";
const detailed =
  "Build a two-story modern house with yellow walls, a purple wooden door, six windows, three on each floor, and a pink roof.";
it("retains detailed house attributes with segmented openings", () => {
  const p = offlinePlan(detailed);
  materializePlan(p);
  expect(p.template?.floors).toBe(2);
  expect(p.objects.filter((o) => o.role === "window")).toHaveLength(6);
  for (const level of [0, 1])
    expect(
      p.objects.filter((o) => o.role === "window" && o.level === level),
    ).toHaveLength(3);
  expect(
    p.objects
      .filter((o) => o.role === "wall")
      .every((o) => o.color === "#f5d76e"),
  ).toBe(true);
  expect(p.objects.find((o) => o.role === "door")).toMatchObject({
    color: "#aa79df",
    material: "wood",
  });
  expect(p.objects.find((o) => o.role === "roof")?.color).toBe("#f18db5");
});
it("normalizes paraphrases without deleting details", () => {
  expect(normalizeDesignRequest("Can you make a two-floor home? ")).toBe(
    "make a two-story house",
  );
  expect(requestedAppearance("make the roof blue").roof?.color).toBe("#508ee8");
});
import { validateDesignAttributes } from "../../src/generation/designValidation";
it("rejects missing explicit requirements without repairing provider geometry", () => {
  const plan = offlinePlan("house");
  expect(() =>
    validateDesignAttributes("Build a two-story house", plan),
  ).toThrow(/floor count/);
  expect(() =>
    validateDesignAttributes("Build a house with six windows", plan),
  ).toThrow(/window count/);
  expect(() =>
    validateDesignAttributes("Build a house with yellow walls", plan),
  ).toThrow(/color/);
  expect(() =>
    validateDesignAttributes("Build a house with a wooden door", {
      ...plan,
      objects: plan.objects.map((p) =>
        p.role === "door" ? { ...p, material: "concrete" } : p,
      ),
    }),
  ).toThrow(/material/);
  expect(() =>
    validateDesignAttributes(
      "Build a house with two windows on each floor",
      offlinePlan("house with two windows"),
    ),
  ).not.toThrow();
});
