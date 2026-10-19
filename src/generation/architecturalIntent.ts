import type { BuildingTemplate, Staircase } from "../../shared/planSchema.mjs";
import type { StructureOperation } from "../../shared/editSchema.mjs";
import { DESIGN_COLORS } from "./designLanguage";
export function architecturalIntent(
  input: string,
  recipe?: BuildingTemplate,
  selectedAssembly?: string,
): { operation?: StructureOperation; message?: string } | null {
  const t = input.toLowerCase();
  if (!/\bstairs?\b|\bstaircases?\b/.test(t)) return null;
  if (/\b(?:spiral|curved|switchback|winder|u-shaped|l-shaped)\b/.test(t))
    return {
      message:
        "Only straight staircase flights are supported in this phase. Would you like a straight flight with a real floor opening?",
    };
  if (!recipe || !["house", "tower", "office"].includes(recipe.kind))
    return {
      message:
        "Select an intact generated house, tower or office to edit its staircase.",
    };
  const stairs = recipe.stairs ?? [];
  const floor = t.match(
    /\b(first|second|third|fourth|fifth|sixth|[1-6])(?:\s+floor|\s+level)\b/,
  );
  const to = floor
    ? (["first", "second", "third", "fourth", "fifth", "sixth"].indexOf(
        floor[1],
      ) + 1 || Number(floor[1])) - 1
    : undefined;
  const existing =
    to === undefined
      ? selectedAssembly
        ? stairs.find((s) => s.id === selectedAssembly)
        : stairs.length === 1
          ? stairs[0]
          : undefined
      : stairs.find((s) => s.to === to);
  if (/\b(remove|delete)\b/.test(t))
    return existing
      ? {
          operation: {
            type: "design",
            stairs: stairs.filter((s) => s.id !== existing.id),
          },
          message: "Remove the staircase and restore its floor slab.",
        }
      : {
          message:
            "Which staircase should I remove? Specify its destination floor.",
        };
  if (!existing && stairs.length > 0 && to === undefined)
    return {
      message: "Which destination floor should the staircase connect to?",
    };
  if (recipe.floors < 2)
    return {
      message:
        "This building has one floor. Add another floor before connecting it with stairs.",
    };
  if (!existing && recipe.floors > 2 && to === undefined)
    return {
      message:
        "Which destination floor should the staircase connect to, and should it be on the left or right?",
    };
  if (!existing && !/\b(left|right)\b/.test(t))
    return {
      message:
        "Where should I put the staircase—on the left or right? You can also specify its destination floor.",
    };
  const target = existing?.to ?? to ?? 1;
  const span = recipe.height + 0.2;
  const count = t.match(/\b(\d+) (?:steps|treads)\b/);
  const steps = count
    ? Number(count[1])
    : (existing?.steps ?? Math.ceil(span / 0.25));
  const number = (field: string) => {
    const m = t.match(
      new RegExp("\\b" + field + "(?: of)?\\s+(\\d+(?:\\.\\d+)?)"),
    );
    return m ? Number(m[1]) : undefined;
  };
  const wide = t.match(/(\d+(?:\.\d+)?)\s*(?:m(?:et(?:er|re)s?)?\s*)?wide\b/);
  const width =
    number("width") ??
    (wide ? Number(wide[1]) : undefined) ??
    (existing
      ? existing.width *
        (/\bwider\b/.test(t) ? 1.2 : /\bnarrower\b/.test(t) ? 0.8 : 1)
      : 1);
  const run =
    number("run") ??
    existing?.run ??
    Math.min(0.25, (recipe.depth - 2 * recipe.thickness - 1.4) / steps);
  if (run < 0.15)
    return {
      message:
        "This floor is too short for a straight staircase with clear landings. Increase building depth or specify a suitable step count.",
    };
  const material = /\bwood(?:en)?\b/.test(t)
    ? "wood"
    : /\bconcrete\b/.test(t)
      ? "concrete"
      : /\bmetal\b/.test(t)
        ? "polished-metal"
        : (existing?.material ?? "concrete");
  const color =
    Object.entries(DESIGN_COLORS).find(([name]) =>
      new RegExp("\\b" + name + "\\b").test(t),
    )?.[1] ??
    existing?.color ??
    "#aab5c2";
  const side = recipe.width / 2 - recipe.thickness - 0.3 - width / 2;
  const x =
    number("x") ??
    (/\bleft\b/.test(t)
      ? -side
      : /\bright\b/.test(t)
        ? side
        : (existing?.x ?? 0));
  const yaw = number("orientation") ?? existing?.yaw ?? 0;
  const updated: Staircase = {
    id: existing?.id ?? `stairs-${target}`,
    from: target - 1,
    to: target,
    steps,
    rise: number("rise") ?? (count || !existing ? span / steps : existing.rise),
    run,
    width,
    x,
    z: number("z") ?? existing?.z ?? 0,
    yaw: yaw as Staircase["yaw"],
    material,
    color,
  };
  if (existing && JSON.stringify(updated) === JSON.stringify(existing))
    return {
      message:
        "That staircase already has those parameters. Specify a different width, position, orientation or material; scene unchanged.",
    };
  return {
    operation: {
      type: "design",
      stairs: [...stairs.filter((s) => s.id !== updated.id), updated],
    },
    message:
      "Review the staircase and real floor opening. This visual model is not certified for regulations or structural safety.",
  };
}
