import { exportProject } from "./projectIO";
import { useSceneStore } from "../scene/sceneStore";
// Shared by the existing Save button and deterministic construction commands.
export async function saveProject() {
  const { json, local } = await exportProject(useSceneStore.getState().objects);
  let stored = true;
  try {
    localStorage.setItem("holobuild.scene", local);
  } catch {
    stored = false;
  }
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = "holobuild-scene.json";
    a.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  useSceneStore.setState({
    status: stored
      ? "Saved locally and exported self-contained project JSON."
      : "Exported project JSON. Local metadata storage is unavailable.",
  });
}
