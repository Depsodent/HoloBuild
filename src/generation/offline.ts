import {
  normalizeDesignRequest,
  requestedAppearance,
  DESIGN_COLORS,
} from "./designLanguage";
import {
  cleanPrompt,
  planSchema,
  type ConstructionPlan,
  type PlanPart,
} from "../../shared/planSchema.mjs";
import { numeric } from "../commands/parser";
import { MATERIAL_IDS, type MaterialId } from "../scene/materialPresets";
import type { Vec3 } from "../scene/objectTypes";
export interface OfflineOptions {
  width?: number;
  depth?: number;
  height?: number;
  floors?: number;
  thickness?: number;
  doors?: number;
  windows?: number;
  windowWidth?: number;
  windowHeight?: number;
  windowCounts?: number[];
  doorOffset?: number;
  material?: MaterialId;
  roof?: "flat" | "none";
  appearance?: import("../../shared/planSchema.mjs").BuildingTemplate["appearance"];
}
const aliases = {
  house: /\bhouse\b/,
  room: /\broom\b/,
  tower: /\btower\b/,
  warehouse: /\bwarehouse\b/,
  bridge: /\bbridge\b/,
  shed: /\bshed\b/,
  office: /\boffice(?: building)?\b/,
};
export function offlinePlan(
  input: string,
  options: OfflineOptions = {},
): ConstructionPlan {
  const prompt = normalizeDesignRequest(cleanPrompt(input)).toLowerCase(),
    kinds = Object.entries(aliases).filter(([, pattern]) =>
      pattern.test(prompt),
    );
  if (/-\d/.test(prompt))
    throw Error(
      "Offline dimensions and counts cannot be negative. Use explicit positive values.",
    );
  if (kinds.length !== 1)
    throw Error(
      "Choose one supported structure: house, room, tower, warehouse, bridge, garden shed or office.",
    );
  const kind = kinds[0][0],
    warnings: string[] = [];
  const number = (pattern: RegExp, fallback: number) => {
    const match = prompt.match(pattern);
    if (!match) return fallback;
    const n = numeric(match[1].trim());
    if (!Number.isFinite(n))
      throw Error(
        "Unrecognized numeric parameter. Use explicit digits or number words.",
      );
    return n;
  };
  const w =
    options.width ??
    number(
      /\bwidth\s+(\d+(?:\.\d+)?)/,
      number(
        /(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?)?\s+wide\b/,
        kind === "bridge" ? 10 : kind === "warehouse" ? 10 : 6,
      ),
    );
  const d =
    options.depth ??
    number(
      /\bdepth\s+(\d+(?:\.\d+)?)/,
      number(
        /(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?)?\s+deep\b/,
        kind === "bridge" ? 3 : 6,
      ),
    );
  const h =
    options.height ??
    number(
      /\bheight\s+(\d+(?:\.\d+)?)/,
      number(/(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?)?\s+(?:high|tall)\b/, 3),
    );
  const floors =
    options.floors ??
    number(
      /(?:with\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|\d+)\s*(?:-?stor(?:y|ey|ies|eys)|floors?|levels?)\b/,
      number(
        /\b(?:floors|levels)\s+(\d+)\b/,
        kind === "tower" ? 5 : kind === "office" ? 3 : 1,
      ),
    );
  const t =
    options.thickness ?? number(/\bwall thickness\s+(\d+(?:\.\d+)?)/, 0.2);
  const doors =
    options.doors ??
    number(
      /\b(zero|one|two|\d+)\s+door(?:way)?s?\b/,
      number(
        /\bdoors?\s+(\d+)\b/,
        /\b(?:no|without)(?: any| a)? door(?:way)?s?\b/.test(prompt) ||
          kind === "tower" ||
          kind === "office"
          ? 0
          : 1,
      ),
    );
  let windows =
    options.windows ??
    number(
      /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+windows?\b/,
      number(
        /\bwindows?\s+(\d+)\b/,
        /\b(?:no|without)(?: any| a)? windows?\b/.test(prompt)
          ? 0
          : /\bwindows?\b/.test(prompt)
            ? 2
            : 0,
      ),
    );
  const perFloor = prompt.match(
    /\b(one|two|three|four|\d+)\s+(?:windows?\s+)?(?:on |per )?(?:each |every )floor\b/,
  );
  if (perFloor && options.windows === undefined) {
    const n = numeric(perFloor[1]);
    if (
      windows !== 2 &&
      /\b(?:six|five|seven|eight|nine|ten|\d+)\s+windows?/.test(prompt) &&
      windows !== n * floors
    )
      throw Error(
        "Window total conflicts with the per-floor count. Please clarify.",
      );
    windows = n;
    warnings.push(
      String(n * floors) + " windows total; " + n + " on each floor.",
    );
  }
  const appearance = options.appearance ?? requestedAppearance(prompt);
  const wallWords = prompt
    .replace(
      /\b(?:purple|yellow|pink|blue|red|green|white|black)?\s*wood(?:en)?\s+(?:front )?door\b/g,
      "door",
    )
    .replace(/\b(?:wood(?:en)?|metal|glass|brick|concrete) roof\b/g, "roof");
  const material =
    options.material ??
    (/\bglass\b/.test(wallWords)
      ? "glass"
      : /\bwood(?:en)?\b/.test(wallWords)
        ? "wood"
        : /\bmetal\b/.test(wallWords)
          ? "solid"
          : /\bbrick\b/.test(wallWords)
            ? "brick"
            : /\bconcrete\b/.test(wallWords)
              ? "concrete"
              : kind === "shed"
                ? "wood"
                : kind === "office"
                  ? "glass"
                  : "matte-plastic");
  const roof =
    options.roof ??
    (/\b(?:no|without)(?: a)? roof\b/.test(prompt) ||
    (kind === "room" && !/\broof\b/.test(prompt))
      ? "none"
      : "flat");
  for (const [label, value, min, max] of [
    ["width", w, 3, 20],
    ["depth", d, 2, 20],
    ["storey height", h, 2.5, 5],
    ["wall thickness", t, 0.1, 0.4],
    ["floors", floors, 1, 6],
    ["doors", doors, 0, 2],
    ["windows", windows, 0, 4],
  ] as const) {
    if (!Number.isFinite(value) || value < min || value > max)
      throw Error(`Offline ${label} must be ${min}–${max}.`);
  }
  if (
    ![floors, doors, windows].every(Number.isInteger) ||
    !MATERIAL_IDS.includes(material) ||
    !["flat", "none"].includes(roof)
  )
    throw Error("Invalid offline parameters.");
  if (
    (kind === "bridge" ||
      kind === "shed" ||
      kind === "room" ||
      kind === "warehouse") &&
    floors !== 1
  )
    throw Error(
      `The offline ${kind} template supports one level; choose house/tower/office for multiple floors.`,
    );
  if (doors + windows > 0 && w < 4.5 && windows > 0)
    throw Error("Use width at least 4.5 m for window openings.");
  if (/\b(gable|gable[d]?|pitched|sloped|hipped)\b/.test(prompt))
    warnings.push(
      "Pitched/gable geometry is unsupported offline; this preview uses the selected flat/none roof.",
    );
  if (/\bmetal roof\b/.test(prompt) && !options.material)
    warnings.push(
      "Metal roof requested: roof uses satin metal; wall material follows the template.",
    );
  const known = new Set(
    "build create generate add make a an the small simple modern garden with without and of four walls wall floor roof flat no none doorway door doors doorways window windows supported by pillars pillar levels level floors story storey stories meters meter metres metre m width depth height high tall wide deep thickness number wooden wood metal glass brick concrete office building house room tower warehouse bridge shed one two three four five six seven eight zero to please gable gabled pitched sloped hipped".split(
      " ",
    ),
  );
  for (const word of [
    ...Object.keys(DESIGN_COLORS),
    "on",
    "each",
    "per",
    "total",
    "front",
    "colored",
    "coloured",
  ])
    known.add(word);
  const extra = [
    ...new Set(prompt.replace(/[\d.]+/g, " ").match(/[a-z]+/g) ?? []),
  ].filter((word) => !known.has(word));
  if (extra.length)
    warnings.push(
      `Unsupported details/words not modeled: ${extra.slice(0, 12).join(", ")}.`,
    );
  if (
    options.width !== undefined ||
    options.depth !== undefined ||
    options.height !== undefined ||
    options.floors !== undefined ||
    options.material !== undefined ||
    options.roof !== undefined ||
    options.thickness !== undefined ||
    options.windows !== undefined ||
    options.doors !== undefined
  )
    warnings.push(
      "Explicit parameter controls override corresponding prompt values.",
    );
  const objects: PlanPart[] = [];
  let currentLevel: number | undefined;
  let levelPart = 0;
  function add(
    role: PlanPart["role"],
    name: string,
    dimensions: Vec3,
    position: Vec3,
    mat: MaterialId = material,
    type: PlanPart["type"] = role === "floor" || role === "roof"
      ? "floor"
      : role === "pillar"
        ? "cylinder"
        : "wall",
  ) {
    if (dimensions.some((v) => v < 0.0499))
      throw Error(
        "Openings leave a component too small. Use fewer openings or a wider structure.",
      );
    objects.push({
      id:
        currentLevel === undefined
          ? `part-${objects.length + 1}`
          : `level-${currentLevel + 1}-${++levelPart}`,
      ...(currentLevel === undefined ? {} : { level: currentLevel }),
      name,
      role,
      type,
      dimensions,
      position,
      rotation: [0, 0, 0],
      material: appearance[role]?.material ?? mat,
      color:
        appearance[role]?.color ?? (mat === "glass" ? "#89dfe5" : "#ffffff"),
    });
  }
  if (kind === "bridge") {
    const deckMaterial =
      options.material !== undefined ||
      /\b(?:wood(?:en)?|metal|glass|brick|concrete)\b/.test(wallWords)
        ? material
        : "concrete";
    add("floor", "Bridge deck", [w, 0.25, d], [0, h + 0.125, 0], deckMaterial);
    for (const x of [-w / 2 + 0.6, w / 2 - 0.6])
      for (const z of [-d / 2 + 0.4, d / 2 - 0.4])
        add(
          "pillar",
          "Support pillar",
          [0.6, h, 0.6],
          [x, h / 2, z],
          "concrete",
        );
    if (
      /\b(?:walls?|windows?|doors?|roof)\b/.test(prompt) ||
      (options.doors ?? 0) > 0 ||
      (options.windows ?? 0) > 0 ||
      options.roof === "flat" ||
      options.thickness !== undefined
    )
      warnings.push(
        "Bridge has a deck and four pillars only; wall/opening/roof parameters are unsupported.",
      );
    if (deckMaterial !== "concrete")
      warnings.push(
        "Bridge material applies to the deck; support pillars remain concrete.",
      );
  } else {
    const floorT = 0.2;
    for (let level = 0; level < floors; level++) {
      currentLevel = level;
      levelPart = 0;
      const y = level * (h + floorT);
      add(
        "floor",
        `Level ${level + 1} slab`,
        [w, floorT, d],
        [0, y + floorT / 2, 0],
        "concrete",
      );
      const levelWindows = options.windowCounts?.[level] ?? windows;
      const bottom = y + floorT,
        frontZ = d / 2 - t / 2,
        wallMaterial = material;
      for (const side of [-1, 1]) {
        add(
          "wall",
          `Level ${level + 1} side ${side}`,
          [d - 2 * t, h, t],
          [side * (w / 2 - t / 2), bottom + h / 2, 0],
          wallMaterial,
        );
        objects.at(-1)!.rotation = [0, Math.PI / 2, 0];
      }
      for (const side of [-1, 1]) {
        const holes: {
          x: number;
          width: number;
          bottom: number;
          height: number;
          role: "door" | "window";
        }[] = [];
        if (side === 1 && level === 0)
          for (let i = 0; i < doors; i++)
            holes.push({
              x:
                (doors === 1 ? 0 : i === 0 ? -w / 4 : w / 4) +
                (options.doorOffset ?? 0),
              width: 1,
              bottom: 0,
              height: 2.1,
              role: "door",
            });
        const count =
          side === 1
            ? Math.ceil(levelWindows / 2)
            : Math.floor(levelWindows / 2);
        for (let i = 0; i < count; i++)
          holes.push({
            x:
              side === 1 && level === 0 && doors > 0
                ? i === 0
                  ? -w * 0.31
                  : w * 0.31
                : (i - (count - 1) / 2) * 1.7,
            width: options.windowWidth ?? 1,
            bottom: 1.1,
            height: options.windowHeight ?? 1,
            role: "window",
          });
        holes.sort((a, b) => a.x - b.x);
        let left = -w / 2;
        for (const hole of holes) {
          const a = hole.x - hole.width / 2,
            b = hole.x + hole.width / 2;
          if (a < left + 0.05 || b > w / 2 - 0.05)
            throw Error(
              "Door/window layout does not fit. Reduce counts or increase width.",
            );
          add(
            "wall",
            `Level ${level + 1} facade pier`,
            [a - left, h, t],
            [(a + left) / 2, bottom + h / 2, side * frontZ],
            wallMaterial,
          );
          if (hole.bottom > 0)
            add(
              "wall",
              `Level ${level + 1} sill`,
              [hole.width, hole.bottom, t],
              [hole.x, bottom + hole.bottom / 2, side * frontZ],
              wallMaterial,
            );
          const top = h - hole.bottom - hole.height;
          add(
            "wall",
            `Level ${level + 1} lintel`,
            [hole.width, top, t],
            [
              hole.x,
              bottom + hole.bottom + hole.height + top / 2,
              side * frontZ,
            ],
            wallMaterial,
          );
          if (hole.role === "window")
            add(
              "window",
              `Level ${level + 1} glass window`,
              [hole.width, hole.height, Math.min(t, 0.1)],
              [hole.x, bottom + hole.bottom + hole.height / 2, side * frontZ],
              "glass",
            );
          else if (kind !== "room" && !/\bdoorway\b/.test(prompt))
            add(
              "door",
              "Door panel",
              [hole.width, hole.height, Math.min(t, 0.12)],
              [hole.x, bottom + hole.height / 2, side * frontZ],
              "wood",
            );
          left = b;
        }
        add(
          "wall",
          `Level ${level + 1} facade`,
          [w / 2 - left, h, t],
          [(w / 2 + left) / 2, bottom + h / 2, side * frontZ],
          wallMaterial,
        );
      }
    }
    currentLevel = undefined;
    if (roof === "flat") {
      add(
        "roof",
        "Flat roof",
        [w, 0.2, d],
        [0, floors * (h + 0.2) + 0.1, 0],
        /\bwood(?:en)? roof\b/.test(prompt)
          ? "wood"
          : /\bglass roof\b/.test(prompt)
            ? "glass"
            : /\bbrick roof\b/.test(prompt)
              ? "brick"
              : /\bconcrete roof\b/.test(prompt)
                ? "concrete"
                : kind === "warehouse" || /\bmetal roof\b/.test(prompt)
                  ? "solid"
                  : material,
      );
      objects.at(-1)!.id = "roof";
    }
    warnings.push(
      "Openings are segmented wall geometry; no interior stairs, hinges or engineering simulation.",
    );
  }
  return planSchema.parse({
    version: 1,
    name: `${kind[0].toUpperCase() + kind.slice(1)} · ${floors} level${floors === 1 ? "" : "s"}`,
    units: "meters",
    template: {
      kind,
      ...(Object.keys(appearance).length ? { appearance } : {}),
      width: w,
      depth: d,
      height: h,
      floors,
      thickness: t,
      doors,
      windows,
      ...(options.windowWidth === undefined
        ? {}
        : { windowWidth: options.windowWidth }),
      ...(options.windowHeight === undefined
        ? {}
        : { windowHeight: options.windowHeight }),
      ...(options.windowCounts === undefined
        ? {}
        : { windowCounts: options.windowCounts.slice(0, floors) }),
      ...(options.doorOffset === undefined
        ? {}
        : { doorOffset: options.doorOffset }),
      material,
      roof,
    },
    objects,
    contacts: [],
    warnings,
  });
}
