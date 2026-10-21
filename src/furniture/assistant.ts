import { FURNITURE } from "../../shared/furnitureCatalog.mjs";
import { createFurniture } from "./factory";
import { furniturePlacement, anchorFurnitureTransform } from "./placement";
import { useSceneStore } from "../scene/sceneStore";
import { useGenerationStore } from "../generation/generationStore";
import { useEditStore, prepareComponentCommand } from "../generation/editStore";
import { bounds, findFreePosition } from "../interaction/placement";
import { colorPatch } from "../scene/colors";
import { DESIGN_COLORS } from "../generation/designLanguage";
import type { SceneObject, Vec3 } from "../scene/objectTypes";
import type { Command } from "../scene/commandManager";
const aliases: Record<string, string> = {
  sofa: "sofa-two",
  couch: "sofa-two",
  bed: "bed-double",
  desk: "study-desk",
  wardrobe: "wardrobe",
  "dining table": "dining-table",
  "coffee table": "coffee-table",
  "bedside table": "bedside-table",
  "double bed": "bed-double",
  "single bed": "bed-single",
  armchair: "armchair",
  bookshelf: "bookshelf",
  "office chair": "ergonomic-chair",
  television: "television",
};
function matches(text: string) {
  return [
    ...Object.values(FURNITURE).map((d) => [d.name.toLowerCase(), d.id]),
    ...Object.entries(aliases),
  ]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([name]) =>
      new RegExp(
        "\\b" + name.replace(/[.*+?^$()|[\]\\]/g, "\\$&") + "\\b",
        "i",
      ).test(text),
    );
}
export function prepareFurnitureCreation(
  preset: string,
  base?: Vec3,
  message = "Review furniture placement.",
) {
  const s = useSceneStore.getState(),
    selected = s.objects.find((o) => o.id === s.selectedId),
    d = FURNITURE[preset];
  if (!d)
    throw Error(
      "That furniture preset is not supported. Choose an item from the native catalog.",
    );
  if (
    !base &&
    selected &&
    !s.selectedStructureId &&
    (selected.type === "floor" || selected.furniture)
  ) {
    const b = bounds(selected);
    base = [(b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2];
  }
  if (!base)
    return "Which support/location? Select a floor or tabletop Part, provide base X, Y, Z in metres, or place it through Furniture & interiors. Room labels are not stored in this scene.";
  if (d.attachment === "wall" || d.attachment === "ceiling")
    return (
      "Use the furniture catalog to aim at a validated " +
      d.attachment +
      " attachment; a base coordinate alone does not identify its face."
    );
  const o = createFurniture(preset, base),
    valid = furniturePlacement(o, s.objects);
  if (!valid.valid)
    return (
      "Furniture preview rejected: " +
      valid.reason +
      " Choose another support/location."
    );
  prepareComponentCommand(
    { type: "furniture", object: o },
    [...s.objects, o],
    [o],
    message,
  );
  return (
    message +
    " A native furniture preview is ready; Confirm places it as one undoable action."
  );
}
export function furnitureIntent(raw: string): string | null {
  const t = raw.trim().replace(/[.!?]$/, ""),
    match = matches(t),
    s = useSceneStore.getState(),
    o = s.objects.find((p) => p.id === s.selectedId);
  const creation =
    /^(?:please )?(?:add|insert|place|put|create) (?:a |an |the )?/i.test(t) &&
    match;
  if (creation) {
    // A building request mentioning furniture is not intercepted by this object-level route.
    if (/\b(?:house|building|floor plan|generate)\b/i.test(t)) return null;
    if (
      useGenerationStore.getState().prepared ||
      useEditStore.getState().prepared
    )
      return "Confirm or cancel the current preview before adding a separate furniture item.";
    if (/\b(?:and|both|several|all|each)\b/i.test(t))
      return "Add one furniture item at a time so its support and placement can be validated.";
    const point = t.match(
      /\bat\s*\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?(?:\s*m(?:et(?:er|re)s)?)?$/i,
    );
    if (/\b(?:room|bedroom|near|window|left|right|corner)\b/i.test(t) && !point)
      return "Which floor/support and exact location? Rooms and distances such as near the window are ambiguous here. Select the intended floor Part and use the catalog to aim, or provide base X, Y, Z.";
    return prepareFurnitureCreation(
      match[1],
      point ? (point.slice(1).map(Number) as Vec3) : undefined,
    );
  }
  if (!o?.furniture)
    return match &&
      /^(?:change|paint|rotate|remove|delete|resize|make|duplicate)\b/i.test(t)
      ? "Select the intended furniture Part first; your structure is unchanged."
      : null;
  if (
    !/^(?:change|paint|rotate|remove|delete|resize|make|duplicate|move)\b/i.test(
      t,
    )
  )
    return null;
  const withoutItem = match ? t.toLowerCase().replace(match[0], "") : t;
  if (
    /\b(?:walls?|roofs?|houses?|buildings?|windows?|doors?|stairs?|staircases?|balcon(?:y|ies)|floors?)\b/i.test(
      withoutItem,
    )
  )
    return null;
  if (/\b(?:all|every)\b/i.test(t))
    return "Furniture edits target one selected Part. Select the intended item or make separate previews.";
  if (/\b(?:near|beside|next to|corner|bedroom|living room)\b/i.test(t))
    return "Specify an exact position/distance or reposition through the catalog. I cannot infer that room or near-window location.";
  if (
    match &&
    match[1] !== o.furniture.preset &&
    !(match[0] === "sofa" && o.furniture.preset.startsWith("sofa-"))
  )
    return "The selected furniture differs from the requested item. Select the intended Part.";
  if (
    useGenerationStore.getState().prepared ||
    useEditStore.getState().prepared
  )
    return "Confirm or cancel the current preview before editing this furniture.";
  let objects: SceneObject[], parts: SceneObject[], command: Command;
  if (/^(?:remove|delete)\b/i.test(t)) {
    objects = s.objects.filter((p) => p.id !== o.id);
    parts = [];
    command = { type: "delete", id: o.id };
  } else if (/^duplicate\b/i.test(t)) {
    const copy = {
        ...structuredClone(o),
        id: crypto.randomUUID(),
        name: o.name.slice(0, 55) + " copy",
      },
      free = findFreePosition(copy, s.objects);
    if (!free)
      return "No valid supported space for a duplicate. Use the catalog to choose another position.";
    copy.position = free;
    objects = [...s.objects, copy];
    parts = [copy];
    command = { type: "furniture", object: copy };
  } else {
    const patch: Partial<SceneObject> = {},
      color =
        t.match(/#[a-f0-9]{6}/i)?.[0] ??
        Object.entries(DESIGN_COLORS).find(([name]) =>
          new RegExp("\\b" + name + "\\b", "i").test(t),
        )?.[1];
    const rotation = t.match(
      /\brotate\b.*?(-?\d+(?:\.\d+)?)\s*(?:degrees?|°)?$/i,
    );
    if (rotation)
      patch.rotation = [
        0,
        o.rotation[1] + (Number(rotation[1]) * Math.PI) / 180,
        0,
      ];
    else if (color) Object.assign(patch, colorPatch(o, color));
    else if (/\b(?:wood|wooden|metal|metallic|glass|plastic)\b/i.test(t)) {
      patch.material = /wood/i.test(t)
        ? "wood"
        : /metal/i.test(t)
          ? "polished-metal"
          : /glass/i.test(t)
            ? "glass"
            : "matte-plastic";
      patch.surface = undefined;
    } else if (/\b(?:wider|narrower|larger|smaller)\b/i.test(t)) {
      const f = /narrower|smaller/i.test(t) ? 0.8 : 1.2;
      patch.scale = o.scale.map(
        (v, i) => v * (/wider|narrower/i.test(t) && i !== 0 ? 1 : f),
      ) as Vec3;
    } else return null;
    let candidate = { ...o, ...patch };
    if (patch.scale) candidate = anchorFurnitureTransform(o, candidate);
    const valid = furniturePlacement(candidate, s.objects);
    if (!valid.valid) return "Furniture edit rejected: " + valid.reason;
    command = {
      type: "update",
      id: o.id,
      patch: { ...patch, position: candidate.position },
      precise: true,
    };
    objects = s.objects.map((p) => (p.id === o.id ? candidate : p));
    parts = [candidate];
  }
  for (const p of objects)
    if (p.furniture) {
      const v = furniturePlacement(p, objects);
      if (!v.valid) return "Edit would invalidate " + p.name + ": " + v.reason;
    }
  prepareComponentCommand(
    command,
    objects,
    parts,
    "Review the selected furniture change.",
  );
  return "Furniture change preview ready. Confirm applies one action; Cancel leaves the scene unchanged.";
}
