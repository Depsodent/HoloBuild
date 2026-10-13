import { landmarkStream, type Landmark } from "../vision/landmarkStream";
import { useSceneStore } from "../scene/sceneStore";
import { useTrackingStore } from "../vision/trackingStore";
declare global {
  interface Window {
    __HOLO_TEST__?: {
      feed: (points: Landmark[]) => void;
      scene: () => ReturnType<typeof useSceneStore.getState>["objects"];
      project?: (id: string) => { x: number; y: number } | null;
    };
  }
}
export function installTestBridge() {
  window.__HOLO_TEST__ = {
    feed(points) {
      if (useTrackingStore.getState().status === "running")
        throw Error("Stop the real camera before injecting test landmarks.");
      landmarkStream.publish({
        landmarks: points,
        timestamp: performance.now(),
        inferenceMs: 0,
      });
    },
    scene: () => structuredClone(useSceneStore.getState().objects),
  };
  const label = document.createElement("div");
  label.className = "test-mode-label";
  label.textContent = "SYNTHETIC INPUT · TEST MODE";
  document.body.append(label);
}
