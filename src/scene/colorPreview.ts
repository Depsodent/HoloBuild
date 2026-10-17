import { create } from "zustand";
import { useSceneStore } from "./sceneStore";
import type { SceneObject } from "./objectTypes";
export const useColorPreview = create(() => ({
  base: null as SceneObject[] | null,
  colors: {} as Record<string, string>,
}));
export function clearColorPreview() {
  useColorPreview.setState({ base: null, colors: {} });
}
export function previewColors(
  base: SceneObject[],
  ids: string[],
  color: string,
) {
  if (useSceneStore.getState().objects === base)
    useColorPreview.setState({
      base,
      colors: Object.fromEntries(ids.map((id) => [id, color])),
    });
}
export function usePreviewColor(id: string) {
  return useColorPreview((preview) =>
    preview.base === useSceneStore.getState().objects
      ? preview.colors[id]
      : undefined,
  );
}
