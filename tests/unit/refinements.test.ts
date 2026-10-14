import { expect, it } from "vitest";
import {
  BAR_HEIGHT,
  clampLayout,
  defaultLayout,
  parseLayout,
} from "../../src/components/camera/panelLayout";
import { MATERIAL_PRESETS } from "../../src/scene/materialPresets";
it("floating window stays inside a shrinking workspace, expanded or minimized", () => {
  const initial = { x: 700, y: 500, width: 600, height: 700, minimized: false };
  const size = { width: 310, height: 300 };
  const full = clampLayout(initial, size);
  expect(full.x + full.width).toBeLessThanOrEqual(size.width);
  expect(full.y + full.height).toBeLessThanOrEqual(size.height);
  const bar = clampLayout({ ...initial, minimized: true }, size);
  expect(bar.y + BAR_HEIGHT).toBeLessThanOrEqual(size.height);
  expect(clampLayout({ ...initial, x: -50, y: -40 }, size).x).toBe(0);
  expect(defaultLayout({ width: 200, height: 180 }).width).toBe(200);
});
it("layout restore validates corrupted storage and preserves full window size while minimized", () => {
  for (const value of [
    null,
    "bad",
    "{}",
    '{"width":-1}',
    JSON.stringify({ x: 1, y: 1, width: "300", height: 400, minimized: false }),
  ])
    expect(parseLayout(value)).toBeNull();
  const layout = { x: 40, y: 70, width: 330, height: 420, minimized: true };
  expect(parseLayout(JSON.stringify(layout))).toEqual(layout);
});
it("existing material presets have distinct optical properties and keep color separate", () => {
  expect(MATERIAL_PRESETS.solid.metalness).toBeGreaterThan(0.5);
  expect(MATERIAL_PRESETS.solid.transmission).toBe(0);
  expect(MATERIAL_PRESETS.glass.metalness).toBe(0);
  expect(MATERIAL_PRESETS.glass.transmission).toBeGreaterThan(0.5);
  expect(MATERIAL_PRESETS.glass.roughness).toBeLessThan(
    MATERIAL_PRESETS.solid.roughness,
  );
  expect(MATERIAL_PRESETS.glass.opacity).toBeLessThan(1);
  expect(MATERIAL_PRESETS.glass).not.toHaveProperty("color");
});
