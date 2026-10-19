import type { BuildingTemplate, Opening } from "../../shared/planSchema.mjs";
import type { StructureOperation } from "../../shared/editSchema.mjs";
import { openingDefinitions } from "./openings";
import { DESIGN_COLORS } from "./designLanguage";
const ordinal = ["first", "second", "third", "fourth", "fifth", "sixth"];
const levelOf = (text: string) => {
  const m = text.match(
    /\b(first|second|third|fourth|fifth|sixth|[1-6]) floor\b/,
  );
  if (m) return /^\d/.test(m[1]) ? Number(m[1]) - 1 : ordinal.indexOf(m[1]);
  const n = text.match(/\bfloor ([1-6])\b/);
  return n ? Number(n[1]) - 1 : undefined;
};
const numeric = (text: string, key: string) => {
  const m = text.match(
    new RegExp("\\b" + key + "(?: of)?\\s+(-?\\d+(?:\\.\\d+)?)"),
  );
  return m ? Number(m[1]) : undefined;
};
function fits(recipe: BuildingTemplate, others: Opening[], d: Opening) {
  const span =
    d.facade === "front" || d.facade === "back"
      ? recipe.width
      : recipe.depth - 2 * recipe.thickness;
  return (
    d.offset - d.width / 2 >= -span / 2 + 0.1 - 1e-6 &&
    d.offset + d.width / 2 <= span / 2 - 0.1 + 1e-6 &&
    d.bottom + d.height <= recipe.height - 0.1 + 1e-6 &&
    others.every(
      (o) =>
        o.level !== d.level ||
        o.facade !== d.facade ||
        Math.abs(o.offset - d.offset) - (o.width + d.width) / 2 >= 0.1 - 1e-6,
    )
  );
}
export function openingIntent(
  input: string,
  recipe?: BuildingTemplate,
  selected?: string,
  layouts?: readonly ("ground" | "upper")[],
): { operation?: StructureOperation; message?: string } | null {
  const t = input.toLowerCase();
  if (!selected && !/\b(?:windows?|doors?|entrance|openings?)\b/.test(t))
    return null;
  if (!recipe || recipe.kind === "bridge")
    return selected
      ? { message: "Select a certified building opening before editing it." }
      : null;
  if (/\b(?:each|per) floor\b/.test(t) || /^put\b.*\bwindows?\b/i.test(t))
    return null;
  if (/\b(?:add|insert)\b|\bput (?:a|one|another|[1-6]) /.test(t))
    selected = undefined;
  const list = openingDefinitions(recipe, layouts),
    floor = levelOf(t);
  const facet = (t.match(
    /\b(front|back|left|right) (?:wall|facade|side|door|window)\b/,
  )?.[1] ?? t.match(/\bto the (front|back)\b/)?.[1]) as
    Opening["facade"] | undefined;
  let current = selected ? list.find((d) => d.id === selected) : undefined;
  const isDoor = /\bdoor|\bentrance/.test(t);
  const movingEntrance =
    !selected && isDoor && /\bmove|\breposition|\bremove|\bdelete/.test(t);
  if (movingEntrance) {
    const candidates = list.filter(
      (d) =>
        d.kind === "door" &&
        d.level === (floor ?? 0) &&
        d.facade === (facet ?? "front"),
    );
    if (candidates.length !== 1)
      return {
        message:
          "Which door or entrance? Select its Part, or specify one facade and floor.",
      };
    current = candidates[0];
  }
  if (!current) {
    if (selected)
      return {
        message: "The selected opening no longer exists. Select it again.",
      };
    if (
      /\bremove\b.*\bwindow\b/.test(t) &&
      !/\ball\b|\bwindows\b|\bfloor\b/.test(t)
    )
      return {
        message:
          "Which window should I remove? Select its Part or specify a floor/count.",
      };
    const adding = /\badd|\bput|\binsert/.test(t);
    if (!adding) return null;
    if (
      isDoor &&
      list.some(
        (d) =>
          d.kind === "door" &&
          d.level === (floor ?? 0) &&
          d.facade === (facet ?? "front"),
      ) &&
      !/\banother|\bsecond/.test(t)
    )
      return {
        message:
          "A front entrance already exists. Do you want another door, or should I move the existing entrance?",
      };
    if (!isDoor && floor === undefined && recipe.floors > 1)
      return { message: "Which floor should receive that window?" };
    const level = floor ?? 0;
    if (level < 0 || level >= recipe.floors)
      return { message: "Choose an existing destination floor." };
    const facade = isDoor
      ? t.includes("back door")
        ? "back"
        : facet
          ? facet
          : "front"
      : (facet ?? "front");
    const kind = isDoor ? "door" : "window";
    const countMatch = t.match(/\b(one|two|three|[1-6]) windows?\b/);
    const count = isDoor
      ? 1
      : countMatch
        ? ["one", "two", "three"].indexOf(countMatch[1]) + 1 ||
          Number(countMatch[1])
        : 1;
    const result = [...list];
    for (let i = 0; i < count; i++) {
      const prefix = `${kind}-${level}-new`;
      let serial = 0;
      while (result.some((d) => d.id === prefix + "-" + serial)) serial++;
      const entry: Opening = {
        id: prefix + "-" + serial,
        kind,
        facade,
        level,
        offset: 0,
        bottom: isDoor ? 0 : 1.1,
        width: isDoor ? 1 : (recipe.windowWidth ?? 1),
        height: isDoor ? 2.1 : (recipe.windowHeight ?? 1),
        panel: true,
      };
      const offset = numeric(t, "offset");
      const span =
        facade === "front" || facade === "back"
          ? recipe.width
          : recipe.depth - 2 * recipe.thickness;
      const choices =
        offset === undefined
          ? [0, -span * 0.3, span * 0.3, -span * 0.15, span * 0.15]
          : [offset];
      const candidateFaces =
        facet || isDoor
          ? [facade]
          : (["front", "back", "left", "right"] as Opening["facade"][]);
      let chosen: Opening | undefined;
      for (const face of candidateFaces) {
        const faceSpan =
          face === "front" || face === "back"
            ? recipe.width
            : recipe.depth - 2 * recipe.thickness;
        const positions =
          offset === undefined
            ? [
                0,
                -faceSpan * 0.3,
                faceSpan * 0.3,
                -faceSpan * 0.15,
                faceSpan * 0.15,
              ]
            : choices;
        for (const x of positions) {
          const candidate = { ...entry, facade: face, offset: x };
          if (fits(recipe, result, candidate)) {
            chosen = candidate;
            break;
          }
        }
        if (chosen) break;
      }
      if (!chosen)
        return {
          message:
            "No free opening fits without moving an existing opening. Choose another facade/offset or resize the building.",
        };
      result.push(chosen);
    }
    return {
      operation: { type: "design", openings: result },
      message:
        "Review the new static opening(s) and the exact facade offsets; existing openings are preserved.",
    };
  }
  if (
    selected &&
    /\broof|\bwall[s]?\b|\bstairs?\b|\bbalcony\b/.test(t) &&
    /\band\b/.test(t)
  )
    return {
      message:
        "A single opening is selected. Edit it first, or choose Structure for a combined building change.",
    };
  if (/\bremove|\bdelete/.test(t))
    return {
      operation: {
        type: "design",
        openings: list.filter((d) => d.id !== current!.id),
      },
      message: "Remove the opening and fill its surrounding wall.",
    };
  if (/\bduplicate|\bcopy/.test(t))
    return {
      message:
        "Use Add another window/door on a facade so the new opening and wall geometry are validated together.",
    };
  const color =
    t.match(/#[a-f0-9]{6}\b/)?.[0] ??
    Object.entries(DESIGN_COLORS).find(([name]) =>
      new RegExp("\\b" + name + "\\b").test(t),
    )?.[1];
  const material = /\bwood(?:en)?\b/.test(t)
    ? "wood"
    : /\bglass\b/.test(t)
      ? "glass"
      : /\bmetal\b/.test(t)
        ? "polished-metal"
        : /\bconcrete\b/.test(t)
          ? "concrete"
          : undefined;
  if (color || material) {
    const operations: StructureOperation[] = [];
    if (color)
      operations.push({
        type: "color",
        role: current.kind,
        opening: current.id,
        color,
      });
    if (material)
      operations.push({
        type: "material",
        role: current.kind,
        opening: current.id,
        material,
      });
    return {
      operation:
        operations.length === 1
          ? operations[0]
          : {
              type: "batch",
              operations: operations as Exclude<
                StructureOperation,
                { type: "batch" }
              >[],
            },
      message: "Only the selected opening panel appearance will change.",
    };
  }
  const next = { ...current };
  let changed = false;
  const numberWidth = numeric(t, "width"),
    numberHeight = numeric(t, "height");
  if (numberWidth !== undefined) {
    next.width = numberWidth;
    changed = true;
  }
  if (numberHeight !== undefined) {
    next.height = numberHeight;
    changed = true;
  }
  if (/\bwider|\bnarrower/.test(t)) {
    next.width *= t.includes("narrower") ? 0.8 : 1.2;
    changed = true;
  }
  if (/\blarger|\bbigger|\bsmaller/.test(t)) {
    const factor = t.includes("smaller") ? 0.8 : 1.2;
    next.width *= factor;
    next.height *= factor;
    if (next.kind === "window")
      next.bottom += (current.height - next.height) / 2;
    changed = true;
  }
  if (
    /\bmove|\breposition|\bput/.test(t) &&
    /\bleft|\bright|\bup|\bdown/.test(t)
  ) {
    const amount = t.match(/(\d+(?:\.\d+)?)\s*(?:m|metres?|meters?)\b/);
    const n = amount ? Number(amount[1]) : 0.25;
    if (/\bleft|\bright/.test(t)) next.offset += t.includes("left") ? -n : n;
    else if (next.kind === "window") next.bottom += t.includes("down") ? -n : n;
    else
      return {
        message:
          "The door must remain on its floor. Move it along its facade instead.",
      };
    changed = true;
  }
  const offset = numeric(t, "offset");
  if (offset !== undefined) {
    next.offset = offset;
    changed = true;
  }
  if (
    facet &&
    /\b(?:facade|wall|side|to the front|to the back)\b/.test(t) &&
    facet !== current.facade
  ) {
    next.facade = facet;
    changed = true;
  }
  if (floor !== undefined && floor !== current.level) {
    next.level = floor;
    changed = true;
  }
  if (!changed)
    return {
      message:
        "What should change on this opening? Specify width, height, offset, facade or floor.",
    };
  if (
    !fits(
      recipe,
      list.filter((d) => d.id !== current!.id),
      next,
    )
  )
    return {
      message:
        "That opening would overlap another opening or leave an invalid pier/lintel. Choose another size or position.",
    };
  return {
    operation: {
      type: "design",
      openings: list.map((d) => (d.id === current!.id ? next : d)),
    },
    message:
      "Review the moved/resized opening and its regenerated wall sections before confirming.",
  };
}
