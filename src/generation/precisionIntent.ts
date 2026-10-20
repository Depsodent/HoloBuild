import { useSceneStore } from "../scene/sceneStore";
import { surfaceValues } from "../scene/surface";
import { surfacePatchSchema } from "../../shared/editSchema.mjs";
import {
  precisionUpdate,
  meters,
  dimensionPatch,
  floorPosition,
  structureDimensionOperation,
} from "../scene/precision";
import {
  prepareComponentCommand,
  requestEdit,
  useEditStore,
  cancelEdit,
} from "./editStore";
import { useGenerationStore } from "./generationStore";
import type { PlannerMode } from "./planner";
import type { Vec3 } from "../scene/objectTypes";
export async function precisionIntent(
  text: string,
  settings: { mode: PlannerMode; model?: string; timeoutMs?: number },
): Promise<string | null> {
  const t = text.toLowerCase().trim();
  if (
    /^(?:please\s+)?(?:build|generate|create|add|insert)\b/.test(t) ||
    /^make (?:a|an|new)\b/.test(t)
  )
    return null;
  const surface =
    /\b(roughness|rough|metalness|opacity|transparent)\b/.test(t) ||
    (/^make\b/.test(t) &&
      /\bmetallic\b/.test(t) &&
      /\b(this|selected|railing|wall|roof|floor|window|door|cube|sphere|cylinder|cone)\b/.test(
        t,
      ));
  const move = t.match(
    /^move\b.*?([\d.]+)\s*(centimeters?|cm|millimeters?|mm|meters?|m)\b.*?\b(left|right|up|down|forward|backward|back)\b/,
  );
  const dim =
    t.match(
      /\b(width|height|depth)\s+(?:to|by)\s+([\d.]+)\s*(centimeters?|cm|millimeters?|mm|meters?|m)\b/,
    ) ??
    t.match(
      /\b([\d.]+)\s*(centimeters?|cm|millimeters?|mm|meters?|m)\s+(wide|high|tall|deep)\b/,
    );
  const align = /^align\b.*\b(?:with|to) (?:the )?floor\b/.test(t);
  if (!surface && !move && !dim && !align) return null;
  cancelEdit();
  if (/\b(?:and|then|also)\b/.test(t))
    throw Error("Use one precision edit per request; nothing was changed.");
  if (useGenerationStore.getState().prepared)
    throw Error(
      "Confirm or cancel the construction preview before a precision edit.",
    );
  if (/-\s*\d/.test(t))
    throw Error(
      "Use a positive measurement and an explicit direction; nothing was changed.",
    );
  const properties = t.match(/\b(?:roughness|metalness|opacity)\b/g);
  if (properties && new Set(properties).size > 1)
    throw Error("Use one optical property per request.");
  const scene = useSceneStore.getState(),
    o = scene.objects.find((v) => v.id === scene.selectedId);
  if (!o) throw Error("Select the intended Part or Structure first.");
  const role = t.match(
    /\b(wall|roof|floor|window|door|railing|cube|sphere|cylinder|cone)s?\b/,
  )?.[1];
  const mappedRole = role === "railing" ? "balcony" : role;
  const whole =
    !!scene.selectedStructureId || /\b(all|every|entire|whole)\b/.test(t);
  const group =
    scene.selectedStructureId ??
    (whole ? o.construction?.structureId : undefined);
  if (!whole && mappedRole && mappedRole !== (o.construction?.role ?? o.type))
    throw Error(
      "Select the intended component in Part mode, or select its Structure and specify a role.",
    );
  if (
    scene.selectedStructureId &&
    /\b(this|selected) (wall|roof|window|door|floor)\b/.test(t) &&
    !/\b(all|every)\b/.test(t)
  )
    throw Error(
      "Choose Part and select the intended component, or explicitly request all matching parts.",
    );
  if (role === "railing" && (group || !/rail|post/i.test(o.name)))
    throw Error(
      "Select the intended railing Part; the balcony slab must not be changed implicitly.",
    );
  if (whole && !group)
    throw Error("Select a structure before requesting a group precision edit.");
  if (surface) {
    const key: "roughness" | "metalness" | "opacity" = /rough/.test(t)
      ? "roughness"
      : /metal/.test(t)
        ? "metalness"
        : "opacity";
    const n =
      t.match(/(?:to|of)\s+([\d.]+)\s*(%)?/) ??
      t.match(/(?:roughness|metalness|opacity)\s+([\d.]+)\s*(%)?/);
    const value = n
      ? Number(n[1]) * (n[2]?.includes("%") ? 0.01 : 1)
      : /less rough/.test(t)
        ? Math.max(0, surfaceValues(o).roughness - 0.1)
        : /more rough/.test(t)
          ? Math.min(1, surfaceValues(o).roughness + 0.1)
          : /metallic/.test(t)
            ? 1
            : /slightly transparent/.test(t)
              ? 0.75
              : NaN;
    if (group && !n && /rough/.test(t))
      throw Error(
        "Use an explicit roughness value for a structure with potentially mixed surfaces.",
      );
    const parsed = surfacePatchSchema.safeParse({ [key]: value });
    if (!parsed.success)
      throw Error(
        "Specify roughness or metalness between 0 and 1, or opacity between 5% and 100%. Scene unchanged.",
      );
    const values = parsed.data;
    if (group) {
      await requestEdit(
        text,
        settings,
        {
          type: "surface",
          values,
          ...(mappedRole ? { role: mappedRole as "wall" } : {}),
        },
        true,
      );
      if (useEditStore.getState().status !== "preview")
        throw Error(useEditStore.getState().message);
    } else {
      const result = precisionUpdate(scene.objects, o, {
        surface: { ...o.surface, ...values },
        ...(o.model ? { model: { ...o.model, originalMaterials: false } } : {}),
      });
      prepareComponentCommand(
        result.command,
        result.objects,
        result.parts,
        "Preview surface properties. Confirm to apply one Undo step.",
      );
    }
    return "Surface preview ready. Review and confirm; the scene is unchanged.";
  }
  let patch;
  if (move) {
    const amount = meters(Number(move[1]), move[2]);
    const axes: Record<string, Vec3> = {
      left: [-1, 0, 0],
      right: [1, 0, 0],
      up: [0, 1, 0],
      down: [0, -1, 0],
      forward: [0, 0, -1],
      backward: [0, 0, 1],
      back: [0, 0, 1],
    };
    const delta = axes[move[3]].map((v) => v * amount) as Vec3;
    if (group) {
      await requestEdit(text, settings, { type: "move", delta }, true);
    } else patch = { position: o.position.map((v, i) => v + delta[i]) as Vec3 };
  } else if (dim) {
    const named = /width|height|depth/.test(dim[1]);
    const axis = named
      ? ["width", "height", "depth"].indexOf(dim[1])
      : /wide/.test(dim[3])
        ? 0
        : /deep/.test(dim[3])
          ? 2
          : 1;
    let value = meters(Number(dim[named ? 2 : 1]), dim[named ? 3 : 2]);
    if (/\b(increase|decrease)\b/.test(t)) {
      if (group)
        throw Error("Use an explicit final dimension for a structure.");
      const { dimensions } = await import("../scene/precision");
      value = dimensions(o)[axis] + value * (/decrease/.test(t) ? -1 : 1);
    }
    if (group)
      await requestEdit(
        text,
        settings,
        structureDimensionOperation(scene.objects, group, axis, value),
        true,
      );
    else patch = dimensionPatch(o, axis, value);
  } else if (align) {
    if (group)
      throw Error(
        "Use the structure position Y control to change its elevation; floor connections must remain intact.",
      );
    patch = { position: floorPosition(o, scene.objects) };
  }
  if (patch) {
    const r = precisionUpdate(scene.objects, o, patch);
    prepareComponentCommand(
      r.command,
      r.objects,
      r.parts,
      "Preview precise transform in metres. Confirm for one Undo step.",
    );
  } else if (useEditStore.getState().status !== "preview")
    throw Error(useEditStore.getState().message);
  return "Precision preview ready. Review before confirming.";
}
