import { useSceneStore } from "../scene/sceneStore";
import { openingIntent } from "./openingIntent";
import {
  frameMatrix,
  transformPart,
  validateStructure,
  applyStructure,
} from "../scene/structures";
import { facadeAt } from "./openings";
import { nativeParts } from "../scene/nativeAssemblies";
import { objectSize } from "../scene/objectFactory";
import { prepareComponentCommand } from "./editStore";
import { useGenerationStore } from "./generationStore";
import type { BuildingTemplate } from "../../shared/planSchema.mjs";
import type { StructureMetadata } from "../scene/objectTypes";
export function selectedWallIntent(text: string): string | null {
  const adding =
      /^(?:please )?(?:add|insert|put)\b.*\b(?:window|opening)\b.*\b(?:selected|this|that) wall\b/i.test(
        text,
      ),
    s = useSceneStore.getState(),
    o = s.objects.find((o) => o.id === s.selectedId),
    info = o?.construction?.structure;
  const nativeWindow =
    !!info?.nativeWall &&
    !!o?.construction?.opening &&
    /^(?:make|move|resize|remove|delete|change)\b/i.test(text);
  if (!adding && !nativeWindow) return null;
  if (useGenerationStore.getState().prepared)
    throw Error("Confirm or cancel the construction preview first.");
  if (!o)
    throw Error("Select the native wall that should receive the window first.");
  if (
    adding &&
    (o.type === "model" || !["wall"].includes(o.construction?.role ?? o.type))
  )
    throw Error(
      "Select a native editable wall. Imported meshes cannot be cut into architectural openings.",
    );
  if (s.selectedStructureId && adding)
    throw Error(
      "Choose Part and select the intended wall, or specify a facade and floor in Structure mode.",
    );
  const recipe = info?.template ?? info?.architectureTemplate;
  if (recipe) {
    const local = transformPart(o, frameMatrix(info!).invert()),
      face =
        o.construction?.facade ??
        facadeAt({ position: local.position, role: "wall" }, recipe),
      level = o.construction?.level;
    if (!face || level === undefined)
      throw Error(
        "This wall has no certified facade/floor relationship. Select an intact native facade wall.",
      );
    const result = openingIntent(
      "Add a window on " + face + " wall floor " + (level + 1),
      recipe,
      undefined,
      info?.floorLayouts,
    );
    if (!result?.operation)
      throw Error(result?.message ?? "No valid opening fits this wall.");
    const built = applyStructure(
      s.objects,
      o.construction!.structureId,
      result.operation,
      false,
    );
    prepareComponentCommand(
      {
        type: "structure",
        structureId: o.construction!.structureId,
        operation: result.operation,
        base: s.objects,
        prepared: built,
        snap: false,
      },
      built.objects,
      built.parts,
      "Add a validated window to the selected facade; existing openings are preserved.",
    );
    return "Review the new window opening on the selected wall, then confirm or cancel.";
  }
  if (o.construction && !info?.nativeWall)
    throw Error(
      "This wall is not certified for opening edits. Undo incompatible manual geometry edits or use an editable native wall.",
    );
  if (!info?.nativeWall && [0, 2].some((i) => Math.abs(o.rotation[i]) > 1e-5))
    throw Error(
      "Standalone wall openings support upright native walls. Remove pitch/roll first.",
    );
  const size = objectSize(o).map((v, i) => v * o.scale[i]);
  const wall = info?.nativeWall ?? {
    width: size[0],
    height: size[1],
    thickness: size[2],
    material: o.material,
    color: o.color,
    openings: [],
  };
  const t = {
    kind: "room",
    width: wall.width,
    depth: 2,
    height: wall.height,
    thickness: wall.thickness,
    floors: 1,
    doors: 0,
    windows: 0,
    roof: "none",
    material: wall.material,
    openings: wall.openings,
    windowHeight: Math.min(1, wall.height - 1.2),
  } as BuildingTemplate;
  const result = openingIntent(
    adding ? "Add a window on front wall floor 1" : text,
    t,
    nativeWindow ? o.construction!.opening : undefined,
  );
  if (
    !result?.operation ||
    result.operation.type !== "design" ||
    !result.operation.openings
  )
    throw Error(
      result?.message ?? "Specify a valid window size or offset for this wall.",
    );
  const id = o.construction?.structureId ?? crypto.randomUUID(),
    next: StructureMetadata = info
      ? {
          ...info,
          nativeWall: { ...wall, openings: result.operation.openings },
        }
      : {
          name: o.name,
          type: "native-wall",
          position: [
            o.position[0],
            o.position[1] - wall.height / 2,
            o.position[2],
          ],
          yaw: o.rotation[1],
          scale: [1, 1, 1],
          contacts: [],
          nativeWall: { ...wall, openings: result.operation.openings },
        };
  const before = info
      ? s.objects.filter((p) => p.construction?.structureId === id)
      : [o],
    parts = nativeParts(next, id, info ? before : []);
  if (!info) parts[0].id = o.id;
  const others = s.objects.filter((p) => !before.some((b) => b.id === p.id));
  validateStructure(parts, others);
  const objects = [...others, ...parts];
  prepareComponentCommand(
    {
      type: "replace",
      objects,
      selection: {
        id:
          parts.find((p) => p.construction?.opening === o.construction?.opening)
            ?.id ?? parts[0].id,
        mode: "component",
      },
    },
    objects,
    parts,
    "Validated wall segments and real window opening. No scene change before confirmation.",
  );
  return "Review the wall opening and confirm; Cancel keeps the existing wall.";
}
