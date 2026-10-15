import { create } from "zustand";
import { z } from "zod";
export const lightingSchema = z.object({
  ambient: z.number().finite().min(0).max(3),
  key: z.number().finite().min(0).max(6),
  fill: z.number().finite().min(0).max(30),
  environment: z.number().finite().min(0).max(3),
  shadows: z.boolean(),
});
export type Lighting = z.infer<typeof lightingSchema>;
export const DEFAULT_LIGHTING: Lighting = {
  ambient: 0.65,
  key: 2,
  fill: 15,
  environment: 1,
  shadows: true,
};
function initial() {
  try {
    return lightingSchema.parse(
      JSON.parse(localStorage.getItem("holobuild.lighting.v1") ?? "null"),
    );
  } catch {
    return { ...DEFAULT_LIGHTING };
  }
}
export const useLightingStore = create<{
  lighting: Lighting;
  update: (patch: Partial<Lighting>) => void;
  reset: () => void;
}>((set) => ({
  lighting: initial(),
  update(patch) {
    set((state) => {
      const result = lightingSchema.safeParse({ ...state.lighting, ...patch });
      if (!result.success) return state;
      try {
        localStorage.setItem(
          "holobuild.lighting.v1",
          JSON.stringify(result.data),
        );
      } catch {
        /* Export still works when storage is unavailable. */
      }
      return { lighting: result.data };
    });
  },
  reset() {
    useLightingStore.getState().update(DEFAULT_LIGHTING);
  },
}));
