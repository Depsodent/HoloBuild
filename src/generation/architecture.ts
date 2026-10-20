import { balconyPlan } from "./balconies";
import { openingPlan } from "./openings";
import type {
  ConstructionPlan,
  Staircase,
  PlanPart,
} from "../../shared/planSchema.mjs";

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };
const epsilon = 1e-6;
export function stairFootprint(stair: Staircase): Rect {
  const sideways = stair.yaw === 90 || stair.yaw === 270;
  const x = sideways ? stair.steps * stair.run : stair.width;
  const z = sideways ? stair.width : stair.steps * stair.run;
  return {
    minX: stair.x - x / 2,
    maxX: stair.x + x / 2,
    minZ: stair.z - z / 2,
    maxZ: stair.z + z / 2,
  };
}
const overlaps = (a: Rect, b: Rect) =>
  Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > epsilon &&
  Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > epsilon;
/** Build boxes and an actual rectangular void; never waive collision validation. */
export function architecturalPlan(input: ConstructionPlan): ConstructionPlan {
  input = balconyPlan(openingPlan(input));
  const recipe = input.template;
  if (!recipe?.stairs?.length) return input;
  if (!["house", "tower", "office"].includes(recipe.kind))
    throw Error(
      "Interior stairs require a multi-floor house, tower or office template.",
    );
  const objects = [...input.objects];
  const footprints = recipe.stairs.map(stairFootprint);
  const ids = new Set<string>();
  for (const [index, stair] of recipe.stairs.entries()) {
    if (ids.has(stair.id)) throw Error("Duplicate staircase identity.");
    ids.add(stair.id);
    if (stair.to !== stair.from + 1 || stair.to >= recipe.floors)
      throw Error("Choose adjacent existing floors for the staircase.");
    const span = recipe.height + 0.2;
    if (Math.abs(stair.steps * stair.rise - span) > epsilon)
      throw Error("Step count × rise must equal the floor-to-floor elevation.");
    const rect = footprints[index],
      inset = recipe.thickness + 0.05;
    if (
      rect.minX < -recipe.width / 2 + inset ||
      rect.maxX > recipe.width / 2 - inset ||
      rect.minZ < -recipe.depth / 2 + inset ||
      rect.maxZ > recipe.depth / 2 - inset
    )
      throw Error(
        "Staircase intersects an exterior wall or exceeds the floor.",
      );
    // Clear approach and exit landings, each at least 0.6m of visual-model space.
    const angle = ((stair.yaw === 270 ? -90 : stair.yaw) * Math.PI) / 180;
    const dx = Math.sin(angle),
      dz = Math.cos(angle),
      half = (stair.steps * stair.run) / 2;
    for (const sign of [-1, 1]) {
      const x = stair.x + sign * dx * (half + 0.6),
        z = stair.z + sign * dz * (half + 0.6);
      if (
        Math.abs(x) > recipe.width / 2 - inset ||
        Math.abs(z) > recipe.depth / 2 - inset
      )
        throw Error(
          "Staircase needs clear approach and exit landings inside the building.",
        );
    }
    for (let other = 0; other < index; other++) {
      const previous = recipe.stairs[other];
      if (
        overlaps(rect, footprints[other]) &&
        Math.abs(stair.from - previous.from) <= 1
      )
        throw Error("Staircases overlap or obstruct another floor connection.");
    }
    // Only a certified unsplit target slab can be cut; no visual-only stair insertion.
    const slabIndex = objects.findIndex(
      (o) =>
        o.role === "floor" &&
        o.level === stair.to &&
        Math.abs(o.dimensions[0] - recipe.width) < epsilon &&
        Math.abs(o.dimensions[2] - recipe.depth) < epsilon,
    );
    if (slabIndex < 0)
      throw Error(
        "That target floor already has an opening; choose a different floor or edit the existing staircase.",
      );
    const slab = objects.splice(slabIndex, 1)[0];
    const tiles: [number, number, number, number][] = [
      [-recipe.width / 2, rect.minX, -recipe.depth / 2, recipe.depth / 2],
      [rect.maxX, recipe.width / 2, -recipe.depth / 2, recipe.depth / 2],
      [rect.minX, rect.maxX, -recipe.depth / 2, rect.minZ],
      [rect.minX, rect.maxX, rect.maxZ, recipe.depth / 2],
    ];
    for (const [tile, [x0, x1, z0, z1]] of tiles.entries()) {
      if (x1 - x0 < 0.1 || z1 - z0 < 0.1)
        throw Error("Floor opening leaves a slab segment too small.");
      objects.push({
        ...slab,
        type: "cube",
        id: slab.id + "-cut-" + tile,
        name: `Level ${stair.to + 1} opening slab ${tile + 1}`,
        position: [(x0 + x1) / 2, slab.position[1], (z0 + z1) / 2],
        dimensions: [
          Number((x1 - x0).toFixed(10)),
          slab.dimensions[1],
          Number((z1 - z0).toFixed(10)),
        ],
      });
    }
    const bottom = stair.from * span + 0.2;
    objects.push(...stairParts(stair, bottom));
  }
  return {
    ...input,
    objects,
    warnings: [
      ...input.warnings.filter((w) => !w.includes("no interior stairs")),
      "Parametric stairs and floor voids are visual geometry only; not certified for building regulations or structural safety.",
    ],
  };
}

/** Shared native solid-riser geometry for connected and freestanding flights. */
export function stairParts(stair: Staircase, bottom: number): PlanPart[] {
  const objects: PlanPart[] = [];
  const angle = ((stair.yaw === 270 ? -90 : stair.yaw) * Math.PI) / 180,
    dx = Math.sin(angle),
    dz = Math.cos(angle),
    half = (stair.steps * stair.run) / 2;
  for (let step = 0; step < stair.steps; step++) {
    const distance = (step + 0.5) * stair.run - half;
    const height = (step + 1) * stair.rise;
    objects.push({
      id: `${stair.id}-step-${step + 1}`,
      name: `Stair ${stair.id} step ${step + 1}`,
      role: "stair",
      level: stair.from,
      assembly: stair.id,
      type: "cube",
      position: [
        stair.x + dx * distance,
        bottom + height / 2,
        stair.z + dz * distance,
      ],
      dimensions: [stair.width, height, stair.run],
      rotation: [0, angle, 0],
      material: stair.material,
      color: stair.color,
    });
  }
  return objects;
}
