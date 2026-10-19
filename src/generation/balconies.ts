import type { ConstructionPlan, Balcony } from "../../shared/planSchema.mjs";
/** Facade-mounted visual slab/rail assembly with a real access doorway. */
export function balconyPlan(input: ConstructionPlan): ConstructionPlan {
  const recipe = input.template;
  if (!recipe?.balconies?.length) return input;
  if (recipe.kind === "bridge")
    throw Error("Balconies require a building facade.");
  const objects = [...input.objects],
    ids = new Set<string>();
  for (const balcony of recipe.balconies) {
    if (ids.has(balcony.id)) throw Error("Duplicate balcony identity.");
    ids.add(balcony.id);
    if (balcony.level < 1 || balcony.level >= recipe.floors)
      throw Error("Choose an existing upper floor for a balcony.");
    const side = balcony.facade === "left" || balcony.facade === "right";
    const span = side ? recipe.depth - 2 * recipe.thickness : recipe.width;
    if (Math.abs(balcony.offset) + balcony.width / 2 > span / 2 - 0.1)
      throw Error("Balcony exceeds its facade or corner clearance.");
    const door = recipe.openings?.find((o) => o.id === balcony.access);
    if (
      !door ||
      door.kind !== "door" ||
      door.level !== balcony.level ||
      door.facade !== balcony.facade ||
      door.bottom !== 0 ||
      Math.abs(door.offset - balcony.offset) > 1e-6 ||
      door.width > balcony.width - 0.4
    )
      throw Error(
        "Balcony requires an aligned real doorway on its floor; edit its assembly instead of disconnecting access.",
      );
    for (const other of recipe.balconies) {
      if (other === balcony) break;
      if (
        other.level === balcony.level &&
        other.facade === balcony.facade &&
        Math.abs(other.offset - balcony.offset) <
          (other.width + balcony.width) / 2 + 0.1
      )
        throw Error("Balconies overlap or leave no separation.");
    }
    const floorTop = balcony.level * (recipe.height + 0.2) + 0.2;
    const plane = side ? recipe.width / 2 : recipe.depth / 2;
    const sign =
      balcony.facade === "back" || balcony.facade === "left" ? -1 : 1;
    const add = (
      suffix: string,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
    ) =>
      objects.push({
        id: `${balcony.id}-${suffix}`,
        name: `Balcony ${balcony.id} ${suffix}`,
        role: "balcony",
        assembly: balcony.id,
        level: balcony.level,
        facade: balcony.facade,
        type: "cube",
        position: side
          ? [sign * (plane + z), floorTop + y, balcony.offset + x]
          : [balcony.offset + x, floorTop + y, sign * (plane + z)],
        dimensions: side ? [d, h, w] : [w, h, d],
        rotation: [0, 0, 0],
        material: balcony.material,
        color: balcony.color,
      });
    add("slab", 0, -0.1, balcony.depth / 2, balcony.width, 0.2, balcony.depth);
    const postHeight = balcony.railHeight - 0.1;
    for (const x of [-1, 1])
      for (const z of [0.05, balcony.depth - 0.05])
        add(
          `post-${x}-${z === 0.05 ? "inner" : "outer"}`,
          x * (balcony.width / 2 - 0.05),
          postHeight / 2,
          z,
          0.1,
          postHeight,
          0.1,
        );
    add(
      "outer-rail",
      0,
      balcony.railHeight - 0.05,
      balcony.depth - 0.05,
      balcony.width,
      0.1,
      0.1,
    );
    for (const x of [-1, 1])
      add(
        `side-rail-${x}`,
        x * (balcony.width / 2 - 0.05),
        balcony.railHeight - 0.05,
        (balcony.depth - 0.1) / 2,
        0.1,
        0.1,
        balcony.depth - 0.1,
      );
  }
  return {
    ...input,
    objects,
    warnings: [
      ...input.warnings,
      "Balcony slabs, rails and access are visual geometry only; no load, guard, structural or regulatory certification.",
    ],
  };
}
export function balconyOpeningChange(
  recipe: NonNullable<ConstructionPlan["template"]>,
  balconies: Balcony[],
) {
  const remove = new Set(
    (recipe.balconies ?? [])
      .filter((b) => !balconies.some((n) => n.id === b.id) && b.ownsAccess)
      .map((b) => b.access),
  );
  return (recipe.openings ?? [])
    .filter((o) => !remove.has(o.id))
    .map((o) => {
      const balcony = balconies.find((b) => b.access === o.id);
      return balcony
        ? {
            ...o,
            facade: balcony.facade,
            level: balcony.level,
            offset: balcony.offset,
          }
        : o;
    });
}
