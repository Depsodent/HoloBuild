import { expect, it } from "vitest";
import {
  MATERIAL_IDS,
  MATERIAL_PRESETS,
  presetValues,
} from "../../src/scene/materialPresets";
import { createCube } from "../../src/scene/objectFactory";
import { objectSchema } from "../../src/scene/objectTypes";
import { serialize, deserialize } from "../../src/scene/sceneSerializer";
import { execute, undo, redo } from "../../src/scene/commandManager";
import { useSceneStore } from "../../src/scene/sceneStore";
import {
  makeSurfaceTextures,
  texturePixels,
} from "../../src/scene/proceduralTextures";
import { surfaceControls, surfaceValues } from "../../src/scene/surface";
it("all nine presets remain valid and legacy IDs still round trip", () => {
  expect(MATERIAL_IDS).toHaveLength(9);
  for (const material of MATERIAL_IDS) {
    const object = objectSchema.parse({ ...createCube(), material });
    expect(deserialize(serialize([object]))[0].material).toBe(material);
  }
  expect(MATERIAL_PRESETS.solid.metalness).toBe(0.65);
  expect(MATERIAL_PRESETS.glass.transmission).toBe(0.65);
});
it("surface parameters validate atomically, undo/redo and persist without changing color", () => {
  const object = createCube();
  useSceneStore.setState({ objects: [object], past: [], future: [] });
  expect(
    execute({
      type: "update",
      id: object.id,
      patch: { material: "wood", surface: { roughness: 0.6, textureScale: 2 } },
    }),
  ).toBe(true);
  expect(useSceneStore.getState().past).toHaveLength(1);
  const changed = useSceneStore.getState().objects;
  expect(surfaceValues(changed[0]).roughness).toBe(0.6);
  expect(changed[0].color).toBe(object.color);
  expect(deserialize(serialize(changed))).toEqual(changed);
  expect(
    execute({
      type: "update",
      id: object.id,
      patch: { surface: { textureScale: 100 } },
    }),
  ).toBe(false);
  expect(useSceneStore.getState().past).toHaveLength(1);
  undo();
  expect(useSceneStore.getState().objects[0]).toEqual(object);
  redo();
  expect(useSceneStore.getState().objects).toEqual(changed);
  expect(
    surfaceControls(changed[0]).some((c) => c.key === "textureScale"),
  ).toBe(true);
  expect(surfaceControls(object).some((c) => c.key === "opacity")).toBe(false);
});
it("procedural surfaces are deterministic and distinct; resources repeat and can be disposed", () => {
  const textures = makeSurfaceTextures();
  expect(
    new Set(
      Object.values(textures).map((t) =>
        Array.from(t.image.data!.slice(0, 200)).join(","),
      ),
    ).size,
  ).toBe(4);
  expect(texturePixels("wood")).toEqual(texturePixels("wood"));
  let disposed = 0;
  for (const t of Object.values(textures)) {
    expect(t.wrapS).toBe(t.wrapT);
    t.addEventListener("dispose", () => disposed++);
    t.dispose();
  }
  expect(disposed).toBe(4);
});
it("presets have distinct physical profiles, with no color override or UI metadata on Three materials", () => {
  expect(MATERIAL_PRESETS["matte-plastic"].roughness).toBeGreaterThan(
    MATERIAL_PRESETS["glossy-plastic"].roughness!,
  );
  expect(MATERIAL_PRESETS["polished-metal"].metalness).toBe(1);
  expect(MATERIAL_PRESETS.holographic.emissiveIntensity).toBeGreaterThan(0.5);
  expect(MATERIAL_PRESETS.holographic.envMapIntensity).toBeLessThan(0.2);
  expect(MATERIAL_PRESETS.holographic.specularIntensity).toBeLessThan(0.1);
  expect(MATERIAL_PRESETS.holographic.toneMapped).toBe(false);
  expect(
    new Set(MATERIAL_IDS.map((id) => JSON.stringify(presetValues(id)))).size,
  ).toBe(9);
  expect(presetValues("wood")).not.toHaveProperty("color");
  expect(presetValues("wood")).not.toHaveProperty("texture");
});
