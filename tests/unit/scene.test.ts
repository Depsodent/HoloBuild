import { beforeEach, describe, expect, it } from "vitest";
import { execute, undo, redo } from "../../src/scene/commandManager";
import { useSceneStore } from "../../src/scene/sceneStore";
import { serialize, deserialize } from "../../src/scene/sceneSerializer";
beforeEach(() =>
  useSceneStore.setState({
    objects: [],
    past: [],
    future: [],
    selectedId: null,
  }),
);
describe("shared scene commands", () => {
  it("creates unique cubes and reverses create, transform, duplicate, delete", () => {
    execute({ type: "create" });
    const id = useSceneStore.getState().objects[0].id;
    execute({ type: "update", id, patch: { position: [3, 0.5, 2] } });
    undo();
    expect(useSceneStore.getState().objects[0].position).toEqual([0, 0.5, 0]);
    redo();
    expect(useSceneStore.getState().objects[0].position[0]).toBe(3);
    execute({ type: "duplicate", id });
    expect(
      new Set(useSceneStore.getState().objects.map((o) => o.id)).size,
    ).toBe(2);
    execute({ type: "delete", id });
    expect(useSceneStore.getState().objects).toHaveLength(1);
    undo();
    expect(useSceneStore.getState().objects).toHaveLength(2);
  });
  it("rejects invalid transforms atomically", () => {
    execute({ type: "create" });
    const before = useSceneStore.getState().objects;
    expect(
      execute({
        type: "update",
        id: before[0].id,
        patch: { scale: [-1, 1, 1] },
      }),
    ).toBe(false);
    expect(useSceneStore.getState().objects).toEqual(before);
  });
  it("round trips scenes and rejects malformed or duplicate objects", () => {
    execute({ type: "create" });
    const objects = useSceneStore.getState().objects;
    expect(deserialize(serialize(objects))).toEqual(objects);
    expect(() => deserialize('{"version":2}')).toThrow();
    expect(() => serialize([...objects, ...objects])).toThrow();
  });
});
