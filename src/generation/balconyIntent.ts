import type {
  BuildingTemplate,
  Balcony,
  Opening,
} from "../../shared/planSchema.mjs";
import type { StructureOperation } from "../../shared/editSchema.mjs";
import { openingDefinitions } from "./openings";
import { balconyOpeningChange } from "./balconies";
import { DESIGN_COLORS } from "./designLanguage";
export function balconyIntent(
  input: string,
  recipe?: BuildingTemplate,
  selected?: string,
): { operation?: StructureOperation; message?: string } | null {
  const t = input.toLowerCase();
  if (!/\bbalcon(?:y|ies)\b/.test(t)) return null;
  if (!recipe || recipe.kind === "bridge")
    return { message: "Select a generated building to add a balcony." };
  const list = recipe.balconies ?? [];
  const m = t.match(/\b(first|second|third|fourth|fifth|sixth|[1-6]) floor\b/);
  const level = m
    ? /^\d/.test(m[1])
      ? Number(m[1]) - 1
      : ["first", "second", "third", "fourth", "fifth", "sixth"].indexOf(m[1])
    : undefined;
  const facade = (t.match(
    /\b(front|back|left|right) (?:facade|side|wall|balcony)\b/,
  )?.[1] ??
    (/\badd|\binsert/.test(t)
      ? t.match(/\b(front|back|left|right)\b/)?.[1]
      : undefined)) as Balcony["facade"] | undefined;
  const current =
    (selected ? list.find((b) => b.id === selected) : undefined) ??
    (list.length === 1
      ? list[0]
      : list.find(
          (b) => b.level === level && (!facade || b.facade === facade),
        ));
  const adding = /\badd|\binsert/.test(t);
  if (/\bremove|\bdelete/.test(t)) {
    if (!current)
      return {
        message:
          "Which balcony should I remove? Select its Part or specify a floor and facade.",
      };
    const balconies = list.filter((b) => b.id !== current.id);
    return {
      operation: {
        type: "design",
        balconies,
        openings: balconyOpeningChange(recipe, balconies),
      },
      message:
        "Remove the balcony; preserve existing access, removing only its automatically created doorway.",
    };
  }
  if (!current && !adding)
    return {
      message:
        "Which balcony should change? Select it or specify a floor and facade.",
    };
  if (adding && level === undefined)
    return {
      message:
        "Which upper floor should receive the balcony, and on which facade (front, back, left or right)?",
    };
  if (adding && !facade)
    return {
      message:
        "Which facade should receive the balcony: front, back, left or right?",
    };
  const n = (key: string) => {
    const x = t.match(
      new RegExp("\\b" + key + "(?: of)?\\s+(-?\\d+(?:\\.\\d+)?)"),
    );
    return x ? Number(x[1]) : undefined;
  };
  const number = list.length + 1;
  let serial = number;
  while (list.some((b) => b.id === `balcony-${serial}`)) serial++;
  const updated: Balcony = {
    id: adding ? `balcony-${serial}` : current!.id,
    level: level ?? current!.level,
    facade: facade ?? current!.facade,
    offset: n("offset") ?? current?.offset ?? 0,
    width:
      n("width") ??
      (current?.width ?? 2.4) *
        (/\bwider\b/.test(t) ? 1.2 : /\bnarrower\b/.test(t) ? 0.8 : 1),
    depth: n("depth") ?? current?.depth ?? 1.5,
    railHeight: n("rail height") ?? current?.railHeight ?? 1.1,
    material: /\bwood(?:en)?\b/.test(t)
      ? "wood"
      : /\bmetal\b/.test(t)
        ? "polished-metal"
        : /\bconcrete\b/.test(t)
          ? "concrete"
          : (current?.material ?? "concrete"),
    color:
      t.match(/#[a-f0-9]{6}\b/)?.[0] ??
      Object.entries(DESIGN_COLORS).find(([name]) =>
        new RegExp("\\b" + name + "\\b").test(t),
      )?.[1] ??
      current?.color ??
      "#aab5c2",
    access: adding ? `balcony-${serial}-entry` : current!.access,
    ownsAccess: adding ? true : current!.ownsAccess,
  };
  if (updated.level < 1 || updated.level >= recipe.floors)
    return {
      message:
        "Choose an existing upper floor. A balcony must connect to that floor through a real doorway.",
    };
  if (!adding && /\bmove|\bput/.test(t) && /\bleft|\bright/.test(t) && !facade)
    updated.offset += /\bleft/.test(t) ? -0.25 : 0.25;
  let openings = openingDefinitions(recipe);
  if (adding) {
    const existing = openings.find(
      (o) =>
        o.kind === "door" &&
        o.level === updated.level &&
        o.facade === updated.facade &&
        Math.abs(o.offset - updated.offset) < 1e-6,
    );
    if (existing) {
      updated.access = existing.id;
      updated.ownsAccess = false;
    } else {
      const entry: Opening = {
        id: updated.access,
        kind: "door",
        level: updated.level,
        facade: updated.facade,
        offset: updated.offset,
        bottom: 0,
        width: 1,
        height: 2.1,
        panel: true,
      };
      if (
        openings.some(
          (o) =>
            o.level === entry.level &&
            o.facade === entry.facade &&
            Math.abs(o.offset - entry.offset) <
              (o.width + entry.width) / 2 + 0.1,
        )
      )
        return {
          message:
            "That balcony access would replace or overlap an existing opening. Choose another offset/facade, or remove that opening explicitly first.",
        };
      openings = [...openings, entry];
    }
  }
  const balconies = adding
    ? [...list, updated]
    : list.map((b) => (b.id === updated.id ? updated : b));
  openings = balconyOpeningChange({ ...recipe, openings }, balconies);
  return {
    operation: { type: "design", balconies, openings },
    message:
      "Review the balcony slab, rails and real access doorway. Visual geometry only; no structural or building-regulation certification.",
  };
}
