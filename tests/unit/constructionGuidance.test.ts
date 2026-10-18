import { it, expect } from "vitest";
import { referenceHouse } from "../../server/constructionGuidance.mjs";
import { materializePlan } from "../../src/generation/engine";
it("server house example has four local-axis walls and a grounded roof without overlaps", () => {
  const result = materializePlan(referenceHouse);
  expect(result.objects).toHaveLength(6);
  expect(referenceHouse.objects.filter((o) => o.role === "wall")).toHaveLength(
    4,
  );
  expect(result.dimensions[1]).toBeCloseTo(3.2);
});
it("guidance does not weaken rejection of corner/floor intersections", () => {
  const invalid = structuredClone(referenceHouse);
  invalid.objects[3].dimensions[0] = 4;
  expect(() => materializePlan(invalid)).toThrow("Excessive component overlap");
  const sunk = structuredClone(referenceHouse);
  sunk.objects[1].position[1] = 1.5;
  expect(() => materializePlan(sunk)).toThrow("Excessive component overlap");
});
