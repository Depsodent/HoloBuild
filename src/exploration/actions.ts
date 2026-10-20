import { useViewStore } from "./viewStore";
import { useSceneStore } from "../scene/sceneStore";
import { useGenerationStore } from "../generation/generationStore";
import { useEditStore } from "../generation/editStore";
import { useInteractionStore } from "../interaction/interactionStore";
export function enterExploration(walking: boolean) {
  const g = useGenerationStore.getState(),
    e = useEditStore.getState();
  if (
    g.prepared ||
    e.prepared ||
    g.status === "planning" ||
    e.status === "planning"
  ) {
    useViewStore.setState({
      message:
        "Confirm or cancel the pending AI preview before exploring; your scene and preview are unchanged.",
    });
    return false;
  }
  useSceneStore.setState({ preview: null });
  useInteractionStore.setState({ menuOpen: false });
  useViewStore.setState({
    walking,
    presentation: walking ? useViewStore.getState().presentation : true,
    paused: true,
    guide: true,
    message: "",
  });
  window.dispatchEvent(new Event("holobuild:exploration-enter"));
  return true;
}
export function exitExploration() {
  document.exitPointerLock?.();
  if (document.fullscreenElement?.matches(".viewport"))
    void document.exitFullscreen().catch(() => {});
  useViewStore.setState({
    walking: false,
    presentation: false,
    paused: true,
    virtual: { forward: 0, right: 0, turn: 0 },
    message: "",
  });
}
