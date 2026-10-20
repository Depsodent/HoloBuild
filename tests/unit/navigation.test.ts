import { NavigationCache } from "../../src/exploration/navigation";
import { it, expect } from "vitest";
import {
  navigationWorld,
  bodyClear,
  moveBody,
  safeSpawn,
  type Body,
} from "../../src/exploration/navigation";
import { createObject } from "../../src/scene/objectFactory";
import { materializePlan } from "../../src/generation/engine";
import { offlinePlan } from "../../src/generation/offline";
import { standaloneFlight } from "../../src/scene/nativeAssemblies";
const body = (p: [number, number, number]): Body => ({
  position: p,
  velocity: 0,
  grounded: true,
});
it("empty scenes have a grounded body and finite bounded input", () => {
  const w = navigationWorld([]);
  expect(safeSpawn(w)?.position).toEqual([0, 0, 0]);
  expect(moveBody(w, body([0, 0, 0]), 1, 0, 0.1).position).toEqual([1, 0, 0]);
  expect(() => moveBody(w, body([0, 0, 0]), NaN, 0, 0.1)).toThrow();
});
it("a swept body cannot tunnel through a thin wall and slides along it", () => {
  const wall = createObject("wall", [0, 1, 0]),
    w = navigationWorld([wall]);
  const a = moveBody(w, body([0, 0, -2]), 0, 4, 0.1);
  expect(a.position[2]).toBeLessThan(-0.3);
  const b = moveBody(w, a, 1, 1, 0.1);
  expect(b.position[0]).toBeGreaterThan(0.8);
  expect(b.position[2]).toBeLessThan(-0.3);
});
it("yawed native boxes collide in their real frame while imported and curved shapes use conservative bounds", () => {
  const wall = {
      ...createObject("wall"),
      rotation: [0, Math.PI / 4, 0] as [number, number, number],
    },
    sphere = createObject("sphere", [5, 0.5, 0]);
  const w = navigationWorld([wall, sphere]);
  expect(w.approximate).toBe(1);
  expect(bodyClear(w, [0, 0, 0])).toBe(false);
  expect(bodyClear(w, [5, 0, 0])).toBe(false);
});
it("valid existing static door panels are portals but glass windows remain solid", () => {
  const objects = materializePlan(
      offlinePlan("house", { doors: 1, windows: 2 }),
    ).objects,
    w = navigationWorld(objects);
  expect(w.passableDoors).toBeGreaterThan(0);
  const door = objects.find((o) => o.construction?.role === "door")!;
  expect(w.colliders.some((c) => c.id === door.id)).toBe(false);
  expect(
    w.colliders.some(
      (c) =>
        c.id === objects.find((o) => o.construction?.role === "window")!.id,
    ),
  ).toBe(true);
  let b = body([0, 0.2, 4]);
  for (let i = 0; i < 80; i++) b = moveBody(w, b, 0, -0.05, 0.05);
  expect(b.position[2]).toBeLessThan(2);
});
it("ground and raised platforms support the body without falling through slabs", () => {
  const floor = createObject("floor", [0, 1, 0]),
    w = navigationWorld([floor]);
  let b = body([0, 3, 0]);
  for (let i = 0; i < 100; i++) b = moveBody(w, b, 0, 0, 0.05);
  expect(b.position[1]).toBeCloseTo(1.1);
  expect(b.grounded).toBe(true);
});
it("ceiling clearance prevents raising an eye-height body through a slab", () => {
  const slab = createObject("floor", [0, 1.6, 0]),
    w = navigationWorld([slab]);
  expect(bodyClear(w, [0, 0, 0], 1.75)).toBe(false);
  expect(safeSpawn(w)?.position).not.toEqual([0, 0, 0]);
});
it("native standalone treads are climbed and descend to ground", () => {
  const w = navigationWorld(
    standaloneFlight(
      {
        width: 1,
        steps: 8,
        height: 1.6,
        run: 0.25,
        material: "wood",
        color: "#aaaaaa",
      },
      [0, 0, 0],
    ),
  );
  let b = body([0, 0, -1.5]);
  for (let i = 0; i < 50; i++) b = moveBody(w, b, 0, 0.05, 0.05);
  expect(b.position[1]).toBeGreaterThan(1.4);
  for (let i = 0; i < 100; i++) b = moveBody(w, b, 0, -0.03, 0.05);
  for (let i = 0; i < 50; i++) b = moveBody(w, b, 0, 0, 0.05);
  expect(b.position[1]).toBeCloseTo(0);
});
it("a two-story native flight reaches the real upper floor through the real void", () => {
  const stairs = [
    {
      id: "s",
      from: 0,
      to: 1,
      steps: 16,
      rise: 0.2,
      run: 0.2,
      width: 1,
      x: -1.5,
      z: 0,
      yaw: 0 as const,
      material: "wood" as const,
      color: "#aaaaaa",
    },
  ];
  const objects = materializePlan(
      offlinePlan("house", {
        width: 6,
        depth: 6,
        height: 3,
        floors: 2,
        doors: 0,
        windows: 0,
        stairs,
      }),
    ).objects,
    w = navigationWorld(objects);
  let b = body([-1.5, 0.2, -2.3]);
  for (let i = 0; i < 100; i++) b = moveBody(w, b, 0, 0.045, 0.05);
  expect(b.position[1]).toBeCloseTo(3.4);
  expect(b.position[2]).toBeGreaterThan(1.8);
  expect(bodyClear(w, b.position)).toBe(true);
});
it("aligned upper-floor balcony access is traversable and railings block walking off", () => {
  const openings = [
      {
        id: "access",
        kind: "door" as const,
        level: 1,
        facade: "front" as const,
        offset: 0,
        bottom: 0,
        width: 1,
        height: 2.1,
        panel: true,
      },
    ],
    balconies = [
      {
        id: "b",
        level: 1,
        facade: "front" as const,
        offset: 0,
        width: 2.4,
        depth: 1.5,
        railHeight: 1.1,
        access: "access",
        ownsAccess: true,
        material: "concrete" as const,
        color: "#aaaaaa",
      },
    ];
  const objects = materializePlan(
      offlinePlan("house", {
        floors: 2,
        doors: 0,
        windows: 0,
        openings,
        balconies,
      }),
    ).objects,
    w = navigationWorld(objects);
  let b = body([0, 3.4, 2]);
  for (let i = 0; i < 32; i++) b = moveBody(w, b, 0, 0.05, 0.05);
  expect(b.position[2]).toBeGreaterThan(3.4);
  expect(b.position[1]).toBeCloseTo(3.4);
  for (let i = 0; i < 60; i++) b = moveBody(w, b, 0, 0.05, 0.05);
  expect(b.position[2]).toBeLessThan(4.4);
  for (let i = 0; i < 50; i++) b = moveBody(w, b, 0, -0.05, 0.05);
  expect(b.position[2]).toBeLessThan(2.5);
});
it("navigation does not mutate geometry or body inputs across repeated frames", () => {
  const objects = [createObject("cube")],
    copy = structuredClone(objects),
    w = navigationWorld(objects),
    b = body([3, 0, 3]);
  for (let i = 0; i < 200; i++) moveBody(w, b, 0.01, 0, 0.016);
  expect(objects).toEqual(copy);
  expect(b.position).toEqual([3, 0, 3]);
});

it.each([Math.PI / 2, Math.PI, Math.PI * 1.5])(
  "quarter-turned standalone staircase remains climbable at yaw %s",
  (yaw) => {
    const world = navigationWorld(
      standaloneFlight(
        {
          width: 1,
          steps: 8,
          height: 1.6,
          run: 0.25,
          material: "wood",
          color: "#aaaaaa",
        },
        [0, 0, 0],
        yaw,
      ),
    );
    const x = Math.sin(yaw),
      z = Math.cos(yaw);
    let b = body([-x * 1.5, 0, -z * 1.5]);
    for (let i = 0; i < 48; i++)
      b = moveBody(world, b, x * 0.05, z * 0.05, 0.05);
    expect(b.position[1]).toBeCloseTo(1.6);
    expect(bodyClear(world, b.position)).toBe(true);
  },
);

it("collision cache builds only on demand and reuses immutable scene identity", () => {
  const cache = new NavigationCache(),
    objects = [createObject("cube")];
  expect(cache.builds).toBe(0);
  const w = cache.read(objects);
  for (let i = 0; i < 100; i++) expect(cache.read(objects)).toBe(w);
  expect(cache.builds).toBe(1);
  expect(cache.read([...objects])).not.toBe(w);
  expect(cache.builds).toBe(2);
  cache.clear();
  expect(cache.read(objects)).not.toBe(w);
  expect(cache.builds).toBe(3);
});
