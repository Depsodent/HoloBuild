import type {
  BuildingTemplate,
  ConstructionPlan,
  Opening,
  PlanPart,
} from "../../shared/planSchema.mjs";
const faces = ["front", "back", "left", "right"] as const;
export function openingDefinitions(
  recipe: BuildingTemplate,
  layouts?: readonly ("ground" | "upper")[],
): Opening[] {
  if (recipe.openings) return structuredClone(recipe.openings);
  const list: Opening[] = [];
  for (let level = 0; level < recipe.floors; level++) {
    const sourceLevel = layouts?.[level] === "ground" ? 0 : level;
    if (sourceLevel === 0)
      for (let i = 0; i < recipe.doors; i++)
        list.push({
          id: `door-${level}-${i}`,
          kind: "door",
          level,
          facade: "front",
          offset:
            (recipe.doors === 1
              ? 0
              : i === 0
                ? -recipe.width / 4
                : recipe.width / 4) + (recipe.doorOffset ?? 0),
          bottom: 0,
          width: 1,
          height: 2.1,
          panel: recipe.kind !== "room",
        });
    const count = recipe.windowCounts?.[sourceLevel] ?? recipe.windows;
    for (const facade of ["front", "back"] as const) {
      const n =
        facade === "front" ? Math.ceil(count / 2) : Math.floor(count / 2);
      for (let i = 0; i < n; i++)
        list.push({
          id: `window-${level}-${facade}-${i}`,
          kind: "window",
          level,
          facade,
          offset:
            facade === "front" && sourceLevel === 0 && recipe.doors > 0
              ? i === 0
                ? -recipe.width * 0.31
                : recipe.width * 0.31
              : (i - (n - 1) / 2) * 1.7,
          bottom: 1.1,
          width: recipe.windowWidth ?? 1,
          height: recipe.windowHeight ?? 1,
          panel: true,
        });
    }
  }
  return list;
}
export function facadeAt(
  part: {
    position: readonly number[];
    role?: string;
    facade?: Opening["facade"];
  },
  recipe: BuildingTemplate,
): Opening["facade"] | undefined {
  if (part.facade) return part.facade;
  if (!["wall", "window", "door"].includes(part.role ?? "")) return;
  if (
    Math.abs(part.position[2] - (recipe.depth / 2 - recipe.thickness / 2)) <
    1e-5
  )
    return "front";
  if (
    Math.abs(part.position[2] + (recipe.depth / 2 - recipe.thickness / 2)) <
    1e-5
  )
    return "back";
  if (
    Math.abs(part.position[0] + (recipe.width / 2 - recipe.thickness / 2)) <
    1e-5
  )
    return "left";
  if (
    Math.abs(part.position[0] - (recipe.width / 2 - recipe.thickness / 2)) <
    1e-5
  )
    return "right";
}
export function openingPlan(input: ConstructionPlan): ConstructionPlan {
  const recipe = input.template;
  if (!recipe || recipe.kind === "bridge") return input;
  const definitions = openingDefinitions(recipe);
  if (!recipe.openings) {
    const panels = definitions.map((d) =>
      d.kind === "door" &&
      d.panel &&
      !input.objects.some(
        (o) =>
          o.role === "door" &&
          o.level === d.level &&
          Math.abs(o.position[0] - d.offset) < 1e-6,
      )
        ? { ...d, panel: false }
        : d,
    );
    if (panels.some((d, i) => d.panel !== definitions[i].panel))
      return openingPlan({
        ...input,
        template: { ...recipe, openings: panels },
      });

    // Tag existing segmented geometry without changing its physical layout or IDs.
    const objects = input.objects.map((o) => {
      const facade = facadeAt(o, recipe);
      const candidate = ["window", "door"].includes(o.role)
        ? definitions.find(
            (d) =>
              d.kind === o.role &&
              d.level === o.level &&
              d.facade === facade &&
              Math.abs(d.offset - o.position[0]) < 1e-5,
          )
        : undefined;
      return {
        ...o,
        ...(facade ? { facade } : {}),
        ...(candidate ? { opening: candidate.id } : {}),
      };
    });
    return { ...input, objects };
  }
  const ids = new Set<string>();
  for (const d of definitions) {
    if (ids.has(d.id)) throw Error("Duplicate opening identity.");
    ids.add(d.id);
    if (d.level >= recipe.floors)
      throw Error("Opening destination floor does not exist.");
    if (d.bottom + d.height > recipe.height - 0.1 + 1e-6)
      throw Error("Opening needs a valid sill/lintel within its storey.");
  }
  const counts = Array.from(
    { length: recipe.floors },
    (_, level) =>
      definitions.filter((d) => d.level === level && d.kind === "window")
        .length,
  );
  if (counts.some((n) => n > 6))
    throw Error(
      "This architectural phase supports up to six windows per floor.",
    );
  const doors = definitions.filter(
    (d) => d.level === 0 && d.facade === "front" && d.kind === "door",
  ).length;
  if (doors > 2) throw Error("Use at most two ground-floor front entrances.");
  const objects: PlanPart[] = input.objects.filter((o) => !facadeAt(o, recipe));
  for (let level = 0; level < recipe.floors; level++)
    for (const facade of faces) {
      const side = facade === "left" || facade === "right";
      const span = side ? recipe.depth - 2 * recipe.thickness : recipe.width;
      const plane =
        facade === "front"
          ? recipe.depth / 2 - recipe.thickness / 2
          : facade === "back"
            ? -recipe.depth / 2 + recipe.thickness / 2
            : facade === "left"
              ? -recipe.width / 2 + recipe.thickness / 2
              : recipe.width / 2 - recipe.thickness / 2;
      const base = level * (recipe.height + 0.2) + 0.2;
      const old = input.objects.filter(
        (o) =>
          o.level === level &&
          o.role === "wall" &&
          facadeAt(o, recipe) === facade,
      );
      const appearance = recipe.appearance;
      const emit = (
        id: string,
        role: "wall" | "window" | "door",
        a: number,
        b: number,
        y: number,
        height: number,
        opening?: string,
      ) => {
        const width = Number((b - a).toFixed(10));
        if (width < 0.1 - 1e-8 || height < 0.1 - 1e-8)
          throw Error(
            "Opening leaves a wall section smaller than the primitive geometry limits.",
          );
        const thickness =
          role === "wall"
            ? recipe.thickness
            : Math.min(recipe.thickness, role === "door" ? 0.12 : 0.1);
        const type =
          role === "wall" && (width < 0.3 || height < 0.2) ? "cube" : "wall";
        objects.push({
          id,
          name: `Level ${level + 1} ${facade} ${role === "wall" ? "wall section" : role === "door" ? "static door panel" : "window panel"}`,
          role,
          level,
          facade,
          ...(opening ? { opening } : {}),
          type,
          position: side
            ? [plane, base + y + height / 2, (a + b) / 2]
            : [(a + b) / 2, base + y + height / 2, plane],
          dimensions: [width, Number(height.toFixed(10)), thickness],
          rotation: [0, side ? Math.PI / 2 : 0, 0],
          material:
            appearance?.[role]?.material ??
            (role === "wall"
              ? (old[0]?.material ?? recipe.material)
              : role === "window"
                ? "glass"
                : "wood"),
          color:
            appearance?.[role]?.color ??
            (role === "wall"
              ? (old[0]?.color ?? "#ffffff")
              : role === "window"
                ? "#89dfe5"
                : "#ffffff"),
        });
      };
      const holes = definitions
        .filter((d) => d.level === level && d.facade === facade)
        .sort((a, b) => a.offset - b.offset);
      let left = -span / 2;
      for (const hole of holes) {
        const a = hole.offset - hole.width / 2,
          b = hole.offset + hole.width / 2;
        if (a < left + 0.1 - 1e-6 || b > span / 2 - 0.1 + 1e-6)
          throw Error(
            "Openings overlap, touch a corner or do not leave a valid wall pier.",
          );
        emit(
          `face-${level}-${facade}-${hole.id}-pier`,
          "wall",
          left,
          a,
          0,
          recipe.height,
        );
        if (hole.bottom > 0)
          emit(
            `face-${level}-${facade}-${hole.id}-sill`,
            "wall",
            a,
            b,
            0,
            hole.bottom,
          );
        emit(
          `face-${level}-${facade}-${hole.id}-top`,
          "wall",
          a,
          b,
          hole.bottom + hole.height,
          recipe.height - hole.bottom - hole.height,
        );
        if (hole.panel)
          emit(
            `opening-${hole.id}`,
            hole.kind,
            a,
            b,
            hole.bottom,
            hole.height,
            hole.id,
          );
        left = b;
      }
      emit(
        `face-${level}-${facade}-end`,
        "wall",
        left,
        span / 2,
        0,
        recipe.height,
      );
    }
  return {
    ...input,
    template: {
      ...recipe,
      openings: definitions,
      windowCounts: counts,
      windows: counts[0],
      doors,
    },
    objects,
    warnings: [
      ...input.warnings,
      "Doors and windows use segmented wall openings and static panels; hinged animation is not implemented.",
    ],
  };
}

/** Preserve explicit layouts while adapting the pre-existing count/scale commands. */
export function openingDesign(
  recipe: BuildingTemplate,
  change: {
    openings?: Opening[];
    windows?: number;
    level?: number;
    windowScale?: number;
    doors?: number;
    doorOffset?: number;
  },
): Opening[] | undefined {
  if (change.openings) return structuredClone(change.openings);
  if (!recipe.openings) return undefined;
  let list = openingDefinitions(recipe);
  if (change.windows !== undefined) {
    const floors =
      change.level === undefined
        ? Array.from({ length: recipe.floors }, (_, i) => i)
        : [change.level];
    for (const level of floors) {
      const old = list.filter((d) => d.level === level && d.kind === "window");
      if (old.length === change.windows) continue;
      const defaults = openingDefinitions({
        ...recipe,
        openings: undefined,
        windows: change.windows,
        windowCounts: Array(recipe.floors).fill(change.windows),
      }).filter((d) => d.level === level && d.kind === "window");
      list = list.filter((d) => d.level !== level || d.kind !== "window");
      const used = new Set(list.map((d) => d.id));
      for (const [i, d] of defaults.entries()) {
        let id = old[i]?.id ?? `window-${level}-set-${i}`;
        let serial = 0;
        while (used.has(id) && serial < 64)
          id = `window-${level}-set-${i}-${++serial}`;
        if (used.has(id)) throw Error("Opening identity budget exceeded.");
        used.add(id);
        list.push({ ...d, id });
      }
    }
  }
  if (change.windowScale !== undefined)
    list = list.map((d) =>
      d.kind === "window" &&
      (change.level === undefined || change.level === d.level)
        ? {
            ...d,
            width: d.width * change.windowScale!,
            height: d.height * change.windowScale!,
          }
        : d,
    );
  if (change.doorOffset !== undefined)
    list = list.map((d) =>
      d.kind === "door" && d.facade === "front" && d.level === 0
        ? {
            ...d,
            offset: d.offset + change.doorOffset! - (recipe.doorOffset ?? 0),
          }
        : d,
    );
  if (change.doors !== undefined) {
    const old = list.filter(
      (d) => d.kind === "door" && d.facade === "front" && d.level === 0,
    );
    if (old.length !== change.doors) {
      list = list.filter((d) => !old.some((o) => o.id === d.id));
      const defaults = openingDefinitions({
        ...recipe,
        openings: undefined,
        doors: change.doors,
      }).filter((d) => d.kind === "door");
      list.push(...defaults.map((d, i) => ({ ...d, id: old[i]?.id ?? d.id })));
    }
  }
  return list;
}
export function floorOpeningDesign(
  recipe: BuildingTemplate,
  list: Opening[],
  floors: number,
  action?: string,
  source?: number,
) {
  const kept = list.filter((d) => d.level < floors);
  for (let level = recipe.floors; level < floors; level++) {
    const from =
      action === "duplicate"
        ? (source ?? recipe.floors - 1)
        : recipe.floors - 1;
    const copy = list.filter(
      (d) =>
        d.level === from && (action === "duplicate" || d.kind === "window"),
    );
    kept.push(
      ...copy.map((d, i) => ({
        ...d,
        id: `floor-${level}-opening-${i}`,
        level,
      })),
    );
  }
  return kept;
}

export function openingForGeometry(
  recipe: BuildingTemplate,
  part: {
    position: readonly number[];
    role: string;
    level?: number;
    opening?: string;
    facade?: Opening["facade"];
  },
  layouts?: readonly ("ground" | "upper")[],
) {
  const face = facadeAt(part, recipe);
  const offset =
    face === "left" || face === "right" ? part.position[2] : part.position[0];
  return openingDefinitions(recipe, layouts).find(
    (d) =>
      d.kind === part.role &&
      d.level === part.level &&
      d.facade === face &&
      Math.abs(d.offset - offset) < 1e-5 &&
      Math.abs(
        part.position[1] -
          (d.level * (recipe.height + 0.2) + 0.2 + d.bottom + d.height / 2),
      ) < 1e-5,
  );
}
