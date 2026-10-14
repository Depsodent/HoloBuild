import { beforeEach, expect, it } from "vitest";
import { SHAPES, createObject } from "../../src/scene/objectFactory";
import type { ObjectType } from "../../src/scene/objectTypes";
import { execute, undo, redo } from "../../src/scene/commandManager";
import { useSceneStore } from "../../src/scene/sceneStore";
import { serialize, deserialize } from "../../src/scene/sceneSerializer";
import { bounds, placement } from "../../src/interaction/placement";
const types = Object.keys(SHAPES) as ObjectType[];
beforeEach(() =>
  useSceneStore.setState({
    objects: [],
    past: [],
    future: [],
    selectedId: null,
    preview: null,
    snap: true,
  }),
);
it.each(types)(
  "%s supports commands, appearance, duplication, history and persistence",
  (type) => {
    expect(execute({ type: "create", objectType: type })).toBe(true);
    const object = useSceneStore.getState().objects[0];
    expect(object.type).toBe(type);
    expect(bounds(object).min.y).toBeCloseTo(0);
    expect(
      execute({
        type: "update",
        id: object.id,
        patch: {
          position: [6, 4, 3],
          rotation: [0, Math.PI / 4, 0],
          scale: [1.5, 1.2, 0.8],
          color: "#ff8844",
          material: "glass",
        },
      }),
    ).toBe(true);
    const edited = structuredClone(useSceneStore.getState().objects);
    undo();
    expect(useSceneStore.getState().objects[0]).toEqual(object);
    redo();
    expect(useSceneStore.getState().objects).toEqual(edited);
    expect(execute({ type: "duplicate", id: object.id })).toBe(true);
    const copy = useSceneStore.getState().objects[1];
    expect(copy.id).not.toBe(object.id);
    expect(copy.type).toBe(type);
    expect(copy.scale).toEqual(edited[0].scale);
    expect(execute({ type: "delete", id: copy.id })).toBe(true);
    undo();
    expect(useSceneStore.getState().objects).toHaveLength(2);
    expect(deserialize(serialize(useSceneStore.getState().objects))).toEqual(
      useSceneStore.getState().objects,
    );
  },
);
it("wall bounds account for dimensions, scale and rotation; touching a floor is allowed", () => {
  const wall = createObject("wall");
  wall.scale = [2, 1, 1];
  wall.rotation[1] = Math.PI / 2;
  const b = bounds(wall);
  expect(b.max.x - b.min.x).toBeCloseTo(0.25);
  expect(b.max.z - b.min.z).toBeCloseTo(6);
  const floor = createObject("floor");
  const cube = createObject("cube", [0, 0.7, 0]);
  expect(placement(cube, cube.position, [cube, floor], true).valid).toBe(true);
  expect(placement(cube, [0, 0.5, 0], [cube, floor], true).valid).toBe(false);
});
it("mixed scenes round trip, old cube JSON loads, and unsupported types are rejected", () => {
  const objects = types.map((type, i) => createObject(type, [i * 6, 4, 0]));
  expect(deserialize(serialize(objects))).toEqual(objects);
  const old = createObject("cube");
  expect(
    deserialize(JSON.stringify({ version: 1, objects: [old] }))[0].type,
  ).toBe("cube");
  expect(() =>
    deserialize(
      JSON.stringify({ version: 1, objects: [{ ...old, type: "torus" }] }),
    ),
  ).toThrow();
});

it("new shapes find non-overlapping space on create and duplicate", () => {
  for (const objectType of types)
    expect(execute({ type: "create", objectType })).toBe(true);
  const s = useSceneStore.getState();
  for (const o of s.objects)
    expect(placement(o, o.position, s.objects, false).valid).toBe(true);
  const floor = s.objects.find((o) => o.type === "floor")!;
  expect(execute({ type: "duplicate", id: floor.id })).toBe(true);
  const next = useSceneStore.getState();
  expect(
    placement(
      next.objects.at(-1)!,
      next.objects.at(-1)!.position,
      next.objects,
      false,
    ).valid,
  ).toBe(true);
});
it("shared transform commands snap, reject collision atomically, and keep scaled objects grounded", () => {
  execute({ type: "create", objectType: "wall" });
  const wall = useSceneStore.getState().objects[0];
  expect(
    execute({
      type: "update",
      id: wall.id,
      patch: { scale: [1, 2, 1], rotation: [0, Math.PI / 2, 0] },
    }),
  ).toBe(true);
  expect(bounds(useSceneStore.getState().objects[0]).min.y).toBeCloseTo(0);
  execute({
    type: "update",
    id: wall.id,
    patch: { position: [0.26, 2, 0.26] },
  });
  expect(useSceneStore.getState().objects[0].position).toEqual([0.5, 2, 0.5]);
  useSceneStore.setState({ snap: false });
  execute({
    type: "update",
    id: wall.id,
    patch: { position: [0.26, 2, 0.26] },
  });
  expect(useSceneStore.getState().objects[0].position[0]).toBe(0.26);
  execute({ type: "create", objectType: "floor" });
  const before = structuredClone(useSceneStore.getState().objects),
    history = useSceneStore.getState().past.length;
  expect(
    execute({
      type: "update",
      id: before[1].id,
      patch: { position: [0.26, 0.1, 0.26] },
    }),
  ).toBe(false);
  expect(useSceneStore.getState().objects).toEqual(before);
  expect(useSceneStore.getState().past).toHaveLength(history);
  expect(
    execute({ type: "update", id: wall.id, patch: { position: [49.9, 2, 0] } }),
  ).toBe(false);
});
it("curved primitive bounds respect rotation and nonuniform scale", () => {
  const sphere = createObject("sphere", [0, 2, 0]);
  sphere.rotation = [0.6, 0.9, 0.3];
  const b = bounds(sphere);
  expect(b.max.x - b.min.x).toBeCloseTo(1);
  sphere.rotation = [0, 0, Math.PI / 2];
  sphere.scale = [2, 1, 1];
  expect(bounds(sphere).max.y - bounds(sphere).min.y).toBeCloseTo(2);
  const cylinder = createObject("cylinder", [0, 2, 0]);
  cylinder.scale = [1, 3, 1];
  cylinder.rotation[2] = Math.PI / 2;
  expect(bounds(cylinder).max.x - bounds(cylinder).min.x).toBeCloseTo(3);
  const cone = createObject("cone", [0, 2, 0]);
  cone.rotation[2] = Math.PI / 4;
  expect(bounds(cone).max.y).toBeCloseTo(2 + Math.SQRT1_2 / 2);
  expect(bounds(cone).min.y).toBeCloseTo(2 - Math.SQRT1_2);
});
