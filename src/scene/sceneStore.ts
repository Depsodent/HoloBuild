import { create } from "zustand";
import { createCube } from "./objectFactory";
import type { SceneObject, Tool, Vec3 } from "./objectTypes";
export interface Preview {
  scale?: Vec3;
  rotation?: Vec3;
  id: string;
  position: Vec3;
  valid: boolean;
}
interface SceneState {
  objects: SceneObject[];
  selectedId: string | null;
  tool: Tool;
  snap: boolean;
  past: SceneObject[][];
  future: SceneObject[][];
  preview: Preview | null;
  status: string;
  fps: number;
  drawCalls: number;
  select: (id: string | null) => void;
  setTool: (tool: Tool) => void;
}
const initial = createCube();
export const useSceneStore = create<SceneState>((set) => ({
  objects: [initial],
  selectedId: initial.id,
  tool: "select",
  snap: true,
  past: [],
  future: [],
  preview: null,
  status: "Workspace ready. Select a cube to begin.",
  fps: 0,
  drawCalls: 0,
  select: (selectedId) => set({ selectedId }),
  setTool: (tool) => set({ tool }),
}));
