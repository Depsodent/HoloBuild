import { useGenerationStore } from "./generationStore";
import { useSceneStore } from "../scene/sceneStore";
import {
  applyStructure,
  frameMatrix,
  transformPart,
  structureInfo,
} from "../scene/structures";
import { geometry, materializePlan, validateBatch } from "./engine";
import { SHAPES } from "../scene/objectFactory";
import { planSchema, type PlanPart } from "../../shared/planSchema.mjs";
import type { StructureOperation } from "../../shared/editSchema.mjs";
/** Refine only draft data; confirmation remains the existing one-command batch. */
export function refineGenerationPreview(operation: StructureOperation) {
  const state = useGenerationStore.getState(),
    draft = state.prepared,
    scene = useSceneStore.getState();
  if (!draft || draft.base !== scene.objects || scene.preview)
    throw Error("Scene changed. Request a fresh design preview.");
  const group = draft.objects[0].construction!.structureId;
  const result = applyStructure(
    [...draft.base, ...draft.objects],
    group,
    operation,
    false,
  );
  const info = structureInfo(result.parts),
    inverse = frameMatrix(info).invert();
  const objects: PlanPart[] = result.parts.map((o) => {
    if (o.type === "model")
      throw Error(
        "Parametric draft refinement requires construction primitives.",
      );
    const local = transformPart(o, inverse),
      c = o.construction!;
    return {
      id: c.partId,
      name: o.name.split(" / ").at(-1)!.slice(0, 60),
      role: c.role,
      level: c.level,
      assembly: c.assembly,
      opening: c.opening,
      facade: c.facade,
      type: o.type,
      position: local.position,
      rotation: local.rotation,
      dimensions: local.scale.map(
        (v, i) => v * SHAPES[o.type as keyof typeof SHAPES].size[i],
      ) as PlanPart["dimensions"],
      material: o.material,
      color: o.color,
    };
  });
  const plan = planSchema.parse({
    ...draft.plan,
    template: info.template,
    objects,
    contacts: info.contacts,
    warnings: [
      ...new Set([
        ...draft.plan.warnings.filter((w) => !w.includes("no interior stairs")),
        "Architectural preview geometry is not certified for building regulations or structural safety.",
      ]),
    ],
  });
  materializePlan(plan);
  validateBatch(result.parts, draft.base, info.contacts);
  const summary = geometry(result.parts, info.contacts);
  useGenerationStore.setState({
    prepared: {
      ...draft,
      plan,
      objects: result.parts.map((o) => ({
        ...o,
        construction: { ...o.construction!, structure: structuredClone(info) },
      })),
      ...summary,
    },
    status: "preview",
    notice: state.notice.includes("Validated draft refinement")
      ? state.notice
      : state.notice +
        " · Validated draft refinement; no additional provider call.",
    message:
      "Draft refined. Confirm to construct it as one action; scene unchanged.",
  });
  return result.summary;
}
