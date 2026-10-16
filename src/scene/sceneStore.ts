import type { StructureOperation } from "../../shared/editSchema.mjs";
import { create } from "zustand";
import { createCube } from "./objectFactory";
import type { SceneObject, Tool, Vec3 } from "./objectTypes";
export interface Preview {
  scale?: Vec3;
  rotation?: Vec3;
  id: string;
  position: Vec3;
  valid: boolean;
  structure?: {
    id: string;
    objects: SceneObject[];
    operation: StructureOperation;
  };
}
interface SceneState {
  objects: SceneObject[];
  selectedId: string | null;
  selectionMode: "component" | "structure";
  selectedStructureId: string | null;
  setSelectionMode: (mode: "component" | "structure") => void;
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
  selectedStructureId: null,
  selectionMode: "component",
  tool: "select",
  snap: true,
  past: [],
  future: [],
  preview: null,
  status: "Workspace ready. Select a cube to begin.",
  fps: 0,
  drawCalls: 0,
  select: (selectedId) =>
    set((s) => ({
      selectedId,
      selectedStructureId:
        s.selectionMode === "structure"
          ? (s.objects.find((o) => o.id === selectedId)?.construction
              ?.structureId ?? null)
          : null,
      preview: null,
    })),
  setSelectionMode: (selectionMode) =>
    set((s) => ({
      selectionMode,
      selectedStructureId:
        selectionMode === "structure"
          ? (s.objects.find((o) => o.id === s.selectedId)?.construction
              ?.structureId ?? null)
          : null,
      preview: null,
    })),
  setTool: (tool) => set({ tool }),
}));
