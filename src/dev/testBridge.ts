import { landmarkStream, type Landmark } from "../vision/landmarkStream";
import { useSceneStore } from "../scene/sceneStore";
import { useTrackingStore } from "../vision/trackingStore";
declare global {
  interface Window {
    __HOLO_TEST__?: {
      feed: (points: Landmark[], aspectRatio?: number) => void;
      repeat: (points: Landmark[], aspectRatio?: number) => void;
      pause: () => void;
      snapshot: () => {
        history: number;
        redo: number;
        preview: ReturnType<typeof useSceneStore.getState>["preview"];
      };
      scene: () => ReturnType<typeof useSceneStore.getState>["objects"];
      project?: (id: string) => { x: number; y: number } | null;
    };
  }
}
export function installTestBridge() {
  let timer: ReturnType<typeof setInterval> | undefined;
  window.__HOLO_TEST__ = {
    feed(points, aspectRatio = 1) {
      if (useTrackingStore.getState().status === "running")
        throw Error("Stop the real camera before injecting test landmarks.");
      landmarkStream.publish({
        landmarks: points,
        timestamp: performance.now(),
        inferenceMs: 0,
        aspectRatio,
      });
    },
    scene: () => structuredClone(useSceneStore.getState().objects),
    repeat(points, aspectRatio = 1) {
      clearInterval(timer);
      window.__HOLO_TEST__!.feed(points, aspectRatio);
      timer = setInterval(
        () => window.__HOLO_TEST__!.feed(points, aspectRatio),
        35,
      );
    },
    pause() {
      clearInterval(timer);
    },
    snapshot() {
      const s = useSceneStore.getState();
      return {
        history: s.past.length,
        redo: s.future.length,
        preview: structuredClone(s.preview),
      };
    },
  };
  const label = document.createElement("div");
  label.className = "test-mode-label";
  label.textContent = "SYNTHETIC INPUT · TEST MODE";
  document.body.append(label);
}
