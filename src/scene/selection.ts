import type { SceneObject } from "./objectTypes";
export function selectionForHit(
  objects: SceneObject[],
  id: string | null,
  mode: "component" | "structure",
) {
  const object = objects.find((o) => o.id === id);
  return {
    selectedId: object?.id ?? null,
    selectedStructureId:
      mode === "structure" ? (object?.construction?.structureId ?? null) : null,
  };
}
