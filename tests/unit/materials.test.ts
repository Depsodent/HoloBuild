import { expect, it } from "vitest";
import {
  MATERIAL_IDS,
  MATERIAL_PRESETS,
  presetValues,
} from "../../src/scene/materialPresets";
import { createCube } from "../../src/scene/objectFactory";
import { objectSchema } from "../../src/scene/objectTypes";
import { serialize, deserialize } from "../../src/scene/sceneSerializer";
it("all nine presets remain valid and legacy IDs still round trip", () => {
  expect(MATERIAL_IDS).toHaveLength(9);
  for (const material of MATERIAL_IDS) {
    const object = objectSchema.parse({ ...createCube(), material });
    expect(deserialize(serialize([object]))[0].material).toBe(material);
  }
  expect(MATERIAL_PRESETS.solid.metalness).toBe(0.65);
  expect(MATERIAL_PRESETS.glass.transmission).toBe(0.65);
});
it("presets have distinct physical profiles, with no color override or UI metadata on Three materials", () => {
  expect(MATERIAL_PRESETS["matte-plastic"].roughness).toBeGreaterThan(
    MATERIAL_PRESETS["glossy-plastic"].roughness!,
  );
  expect(MATERIAL_PRESETS["polished-metal"].metalness).toBe(1);
  expect(MATERIAL_PRESETS.holographic.emissiveIntensity).toBeGreaterThan(0.5);
  expect(
    new Set(MATERIAL_IDS.map((id) => JSON.stringify(presetValues(id)))).size,
  ).toBe(9);
  expect(presetValues("wood")).not.toHaveProperty("color");
  expect(presetValues("wood")).not.toHaveProperty("texture");
});
