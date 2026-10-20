import { create } from "zustand";
import { z } from "zod";
const v = z.tuple([
  z.number().finite().min(-500).max(500),
  z.number().finite().min(-100).max(200),
  z.number().finite().min(-500).max(500),
]);
export const cameraViewSchema = z
  .object({
    id: z.string().max(100),
    name: z.string().trim().min(1).max(50),
    position: v,
    target: v,
    quaternion: z
      .tuple([
        z.number().finite(),
        z.number().finite(),
        z.number().finite(),
        z.number().finite(),
      ])
      .refine((q) => Math.abs(Math.hypot(...q) - 1) < 0.01),
    walking: z.boolean(),
    eyeHeight: z.number().min(1.2).max(1.9),
  })
  .strict();
export type CameraView = z.infer<typeof cameraViewSchema>;
const preferences = z.object({
  speed: z.number().min(0.5).max(6),
  eyeHeight: z.number().min(1.2).max(1.9),
  views: z.array(cameraViewSchema).max(12),
});
function restored() {
  try {
    return preferences.parse(
      JSON.parse(localStorage.getItem("holobuild.exploration.v1") ?? "null"),
    );
  } catch {
    return { speed: 2.2, eyeHeight: 1.6, views: [] as CameraView[] };
  }
}
const initial = restored();
export const useViewStore = create(() => ({
  ...initial,
  walking: false,
  presentation: false,
  paused: true,
  guide: true,
  message: "",
  approximate: 0,
  doors: 0,
  feet: [0, 0, 0] as [number, number, number],
  request: {
    seq: 0,
    type: "none" as "none" | "fit" | "save" | "recall" | "reset",
    name: "",
    id: "",
  },
  virtual: { forward: 0, right: 0, turn: 0 },
}));
export const exploring = () => {
  const s = useViewStore.getState();
  return s.walking || s.presentation;
};
export function viewPreferences(patch: Partial<z.infer<typeof preferences>>) {
  const s = useViewStore.getState(),
    next = preferences.parse({
      speed: s.speed,
      eyeHeight: s.eyeHeight,
      views: s.views,
      ...patch,
    });
  useViewStore.setState(next);
  try {
    localStorage.setItem("holobuild.exploration.v1", JSON.stringify(next));
  } catch {
    useViewStore.setState({
      message:
        "View preferences could not be stored. Scene files are unaffected.",
    });
  }
}
export function viewRequest(
  type: "fit" | "save" | "recall" | "reset",
  value = "",
) {
  const s = useViewStore.getState();
  if (type === "recall") {
    const view = s.views.find((v) => v.id === value);
    if (!view) return;
    useViewStore.setState({
      walking: view.walking,
      eyeHeight: view.eyeHeight,
      paused: true,
    });
  }
  useViewStore.setState({
    request: {
      seq: s.request.seq + 1,
      type,
      name: type === "save" ? value : "",
      id: type === "recall" ? value : "",
    },
  });
}
