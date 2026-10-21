import { it, expect } from "vitest";
import {
  navigationWorld,
  jumpBody,
  moveBody,
  bodyClear,
  type Body,
} from "../../src/exploration/navigation";
import { createObject } from "../../src/scene/objectFactory";
const grounded = (): Body => ({
  position: [0, 0, 0],
  velocity: 0,
  grounded: true,
});
it("grounded jump uses gravity, cannot re-jump in midair, and returns to stable ground", () => {
  const w = navigationWorld([]);
  let b = jumpBody(w, grounded()),
    peak = 0;
  expect(b.velocity).toBeGreaterThan(0);
  for (let i = 0; i < 120; i++) {
    if (i === 5) expect(jumpBody(w, b)).toBe(b);
    b = moveBody(w, b, 0, 0, 1 / 60);
    peak = Math.max(peak, b.position[1]);
  }
  expect(peak).toBeGreaterThan(0.8);
  expect(peak).toBeLessThan(1);
  expect(b.position[1]).toBe(0);
  expect(b.grounded).toBe(true);
  expect(b.velocity).toBe(0);
});
it.each([30, 60, 120])("jump is frame-rate independent at %i Hz", (hz) => {
  const w = navigationWorld([]);
  let b = jumpBody(w, grounded()),
    peak = 0;
  for (let i = 0; i < hz * 2; i++) {
    b = moveBody(w, b, 0, 0, 1 / hz);
    peak = Math.max(peak, b.position[1]);
  }
  expect(peak).toBeCloseTo(0.9, 1);
  expect(b.grounded).toBe(true);
});
it("ceiling blocks ascent without interpenetration at bounded slow frames", () => {
  const ceiling = {
      ...createObject("floor", [0, 2, 0]),
      scale: [1, 1, 1] as [number, number, number],
    },
    w = navigationWorld([ceiling]);
  let b = jumpBody(w, grounded());
  for (let i = 0; i < 30; i++) {
    b = moveBody(w, b, 0, 0, 0.1);
    expect(b.position[1] + 1.75).toBeLessThanOrEqual(1.90001);
    expect(bodyClear(w, b.position)).toBe(true);
  }
  expect(b.grounded).toBe(true);
});
it("sprint cannot tunnel through a thin wall even at a capped long frame", () => {
  const w = navigationWorld([
    {
      ...createObject("wall", [0, 1, 1]),
      scale: [1, 1, 0.4] as [number, number, number],
    },
  ]);
  let b = grounded();
  for (let i = 0; i < 10; i++) b = moveBody(w, b, 0, 0.44, 0.1);
  expect(b.position[2]).toBeLessThan(0.74);
  expect(bodyClear(w, b.position)).toBe(true);
});
it("jumping preserves horizontal motion and lands on a platform", () => {
  const platform = {
      ...createObject("cube", [0, 0.25, -1.1]),
      scale: [1, 0.5, 1] as [number, number, number],
    },
    w = navigationWorld([platform]);
  let b = jumpBody(w, grounded());
  for (let i = 0; i < 35; i++) b = moveBody(w, b, 0, -0.03, 1 / 60);
  for (let i = 0; i < 60; i++) b = moveBody(w, b, 0, 0, 1 / 60);
  expect(b.position[1]).toBeCloseTo(0.5);
  expect(b.grounded).toBe(true);
});
it("fabricated grounded state in midair does not allow a jump", () => {
  const b = { ...grounded(), position: [0, 3, 0] as [number, number, number] };
  expect(jumpBody(navigationWorld([]), b)).toBe(b);
});
