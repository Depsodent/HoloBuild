import { expect, it } from "vitest";
import {
  DEFAULT_LIGHTING,
  useLightingStore,
} from "../../src/scene/lightingStore";
it("lighting controls reject invalid values and restore defaults", () => {
  const store = useLightingStore.getState();
  store.reset();
  store.update({ ambient: 1.2, fill: 0, shadows: false });
  expect(useLightingStore.getState().lighting.ambient).toBe(1.2);
  store.update({ key: -1 });
  expect(useLightingStore.getState().lighting.key).toBe(DEFAULT_LIGHTING.key);
  store.reset();
  expect(useLightingStore.getState().lighting).toEqual(DEFAULT_LIGHTING);
});
