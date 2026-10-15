import { expect, it } from "vitest";
import {
  DEFAULT_WORKSPACE,
  fitCameraHeight,
  fitSidebars,
  parseWorkspace,
} from "../../src/workspace/layoutStore";

it("recovers corrupt layout storage and filters invalid field types", () => {
  for (const value of [null, "garbage", "null", "[]", "42"])
    expect(parseWorkspace(value)).toEqual(DEFAULT_WORKSPACE);
  expect(
    parseWorkspace(
      '{"leftWidth":"440","rightCollapsed":"false","cameraDocked":false}',
    ),
  ).toEqual({ ...DEFAULT_WORKSPACE, cameraDocked: false });
});
it("restores panel preferences with bounded dimensions and ignores unexpected properties", () => {
  const saved = {
    ...DEFAULT_WORKSPACE,
    leftWidth: 400,
    rightWidth: 210,
    cameraHeight: 510,
    cameraMinimized: true,
    inspectorMinimized: true,
    leftCollapsed: true,
  };
  expect(parseWorkspace(JSON.stringify(saved))).toEqual(saved);
  const recovered = parseWorkspace(
    '{"leftWidth":1e100,"rightWidth":-10,"cameraHeight":1e100,"bad":"unused"}',
  );
  expect(recovered.leftWidth).toBe(440);
  expect(recovered.rightWidth).toBe(166);
  expect(recovered.cameraHeight).toBe(1000);
  expect(recovered).not.toHaveProperty("bad");
  expect(parseWorkspace('{"mobileDrawer":"right"}').mobileDrawer).toBe("right");
  expect(parseWorkspace('{"mobileDrawer":"broken"}').mobileDrawer).toBeNull();
});
it("keeps the center usable when sidebars shrink and reclaims collapsed space", () => {
  for (const width of [780, 900, 1024, 1600]) {
    const fitted = fitSidebars(width, 440, 360);
    expect(width - fitted.left - fitted.right - 12).toBeGreaterThanOrEqual(300);
    expect(fitted.left).toBeGreaterThanOrEqual(280);
    expect(fitted.right).toBeGreaterThanOrEqual(166);
  }
  expect(fitSidebars(900, 44, 60)).toEqual({ left: 44, right: 60 });
});
it("reserves an independently scrollable inspector below a bounded camera section", () => {
  expect(fitCameraHeight(700, 360)).toBe(360);
  expect(fitCameraHeight(700, 1000)).toBe(546);
  expect(fitCameraHeight(450, 10)).toBe(180);
  expect(fitCameraHeight(136, 360)).toBeLessThanOrEqual(89);
});
