import { beforeEach, expect, it } from "vitest";
import {
  colorPatch,
  normalizeHex,
  MATERIAL_DEFAULT_COLORS,
} from "../../src/scene/colors";
import { createCube } from "../../src/scene/objectFactory";
import { useSceneStore } from "../../src/scene/sceneStore";
import { execute, undo, redo } from "../../src/scene/commandManager";
import { materializePlan } from "../../src/generation/engine";
import { offlinePlan } from "../../src/generation/offline";
import { serialize, deserialize } from "../../src/scene/sceneSerializer";
import { operationSchema } from "../../shared/editSchema.mjs";
beforeEach(() =>
  useSceneStore.setState({
    objects: [],
    past: [],
    future: [],
    selectedId: null,
    selectedStructureId: null,
    selectionMode: "component",
    preview: null,
  }),
);
it("normalizes HEX without accepting CSS or malformed values", () => {
  expect(normalizeHex(" #AbC ")).toBe("#aabbcc");
  expect(normalizeHex("#AA1234")).toBe("#aa1234");
  for (const input of ["red", "#12345", "#gg0000", "url(x)"])
    expect(normalizeHex(input)).toBeNull();
});
it("object color preserves material optics, textures and original imported surfaces", () => {
  const object = {
    ...createCube(),
    material: "glass" as const,
    surface: { roughness: 0.2, opacity: 0.4 },
    model: {
      assetId: crypto.randomUUID(),
      size: [1, 1, 1] as [number, number, number],
      originalMaterials: true,
    },
    type: "model" as const,
  };
  const changed = { ...object, ...colorPatch(object, "#f80") };
  expect(changed.color).toBe("#ff8800");
  expect(changed.surface).toEqual(object.surface);
  expect(changed.material).toBe("glass");
  expect(changed.model).toMatchObject({ originalMaterials: true, tint: true });
  expect(colorPatch(changed, "#ffffff", true).model).toMatchObject({
    originalMaterials: true,
    tint: false,
  });
});
it("role color/reset are atomic, preserve finishes and survive Undo/Redo and JSON", () => {
  const objects = materializePlan(offlinePlan("house with windows")).objects;
  const id = objects[0].construction!.structureId;
  useSceneStore.setState({ objects });
  expect(
    execute({
      type: "structure",
      structureId: id,
      operation: { type: "color", role: "wall", color: "#aa3322" },
    }),
  ).toBe(true);
  let s = useSceneStore.getState();
  expect(s.past).toHaveLength(1);
  expect(
    s.objects
      .filter((o) => o.construction?.role === "wall")
      .every((o) => o.color === "#aa3322"),
  ).toBe(true);
  expect(s.objects.filter((o) => o.construction?.role !== "wall")).toEqual(
    objects.filter((o) => o.construction?.role !== "wall"),
  );
  s.objects.forEach((o, i) => {
    expect(o.material).toBe(objects[i].material);
    expect(o.surface).toEqual(objects[i].surface);
  });
  expect(deserialize(serialize(s.objects))).toEqual(s.objects);
  const changed = s.objects;
  undo();
  expect(useSceneStore.getState().objects).toEqual(objects);
  redo();
  expect(useSceneStore.getState().objects).toEqual(changed);
  execute({
    type: "structure",
    structureId: id,
    operation: { type: "color", role: "wall", reset: true },
  });
  s = useSceneStore.getState();
  expect(
    s.objects
      .filter((o) => o.construction?.role === "wall")
      .every((o) => o.color === MATERIAL_DEFAULT_COLORS[o.material]),
  ).toBe(true);
  expect(s.past).toHaveLength(2);
});
it("rejects unsupported roles, invalid colors, conflicting reset and empty color operations", () => {
  for (const operation of [
    { type: "color", role: "stairs", color: "#ffffff" },
    { type: "color", color: "red" },
    { type: "color", color: "#ffffff", reset: true },
    { type: "color" },
  ])
    expect(operationSchema.safeParse(operation).success).toBe(false);
});

it("object Apply is one history entry and round-trips color without changing glass optics", () => {
  const object = {
    ...createCube(),
    material: "glass" as const,
    surface: { roughness: 0.25, opacity: 0.4, metalness: 0.1 },
  };
  useSceneStore.setState({ objects: [object] });
  expect(
    execute({
      type: "update",
      id: object.id,
      patch: colorPatch(object, "#123abc"),
    }),
  ).toBe(true);
  const changed = useSceneStore.getState().objects;
  expect(changed[0].surface).toEqual(object.surface);
  expect(useSceneStore.getState().past).toHaveLength(1);
  expect(deserialize(serialize(changed))).toEqual(changed);
  undo();
  expect(useSceneStore.getState().objects).toEqual([object]);
  redo();
  expect(useSceneStore.getState().objects).toEqual(changed);
});
it("whole-structure color changes every real role and preserves unrelated objects", () => {
  const parts = materializePlan(offlinePlan("house with windows")).objects,
    unrelated = createCube();
  unrelated.position = [30, 0.5, 0];
  const objects = [...parts, unrelated];
  useSceneStore.setState({ objects });
  expect(
    execute({
      type: "structure",
      structureId: parts[0].construction!.structureId,
      operation: { type: "color", color: "#20252d" },
    }),
  ).toBe(true);
  const after = useSceneStore.getState().objects;
  expect(
    after.filter((o) => o.construction).every((o) => o.color === "#20252d"),
  ).toBe(true);
  expect(after.find((o) => o.id === unrelated.id)).toEqual(unrelated);
  undo();
  expect(useSceneStore.getState().objects).toEqual(objects);
});
