import { expect, it } from "vitest";
import { bounds } from "../../src/interaction/placement";
import { createCube } from "../../src/scene/objectFactory";
it("cached collider bounds are isolated and invalidate for transforms and alternate positions", () => {
  const object = createCube();
  const first = bounds(object);
  first.min.x = 900;
  expect(bounds(object).min.x).toBe(-0.5);
  object.scale[0] = 2;
  expect(bounds(object).min.x).toBe(-1);
  object.rotation[1] = Math.PI / 4;
  expect(bounds(object).max.x).toBeCloseTo(1.5 / Math.sqrt(2));
  const at = bounds(object, [4, 1, 0]);
  expect(at.max.x).toBeCloseTo(4 + 1.5 / Math.sqrt(2));
  expect(bounds(object).max.x).toBeCloseTo(1.5 / Math.sqrt(2));
});
