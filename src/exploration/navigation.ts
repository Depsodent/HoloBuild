import { furnitureVolumes } from "../furniture/placement";
import { openingDefinitions } from "../generation/openings";
import { Box3, Quaternion, Euler, Vector3 } from "three";
import type { SceneObject, Vec3 } from "../scene/objectTypes";
import { objectSize } from "../scene/objectFactory";
import { bounds } from "../interaction/placement";
export const BODY_RADIUS = 0.22,
  STEP_HEIGHT = 0.28;
export interface Collider {
  id: string;
  box: Box3;
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  yaw: number;
  stair: boolean;
  approximate: boolean;
  furniture?: boolean;
}
export interface NavigationWorld {
  colliders: Collider[];
  bounds: Box3;
  approximate: number;
  passableDoors: number;
}
export interface Body {
  position: Vec3;
  velocity: number;
  grounded: boolean;
}
export function navigationWorld(objects: SceneObject[]): NavigationWorld {
  const colliders: Collider[] = [],
    whole = new Box3();
  let passableDoors = 0;
  for (const o of objects) {
    const b = bounds(o);
    whole.union(b);
    if (o.furniture) {
      furnitureVolumes(o).forEach((box, i) =>
        colliders.push({
          id: o.id + ":" + i,
          box,
          cx: (box.min.x + box.max.x) / 2,
          cz: (box.min.z + box.max.z) / 2,
          hx: (box.max.x - box.min.x) / 2,
          hz: (box.max.z - box.min.z) / 2,
          yaw: 0,
          stair: false,
          approximate: true,
          furniture: true,
        }),
      );
      continue;
    }
    const c = o.construction,
      r = c?.structure?.template ?? c?.structure?.architectureTemplate;
    if (isPassableDoor(o)) {
      passableDoors++;
      continue;
    }
    const q = new Quaternion().setFromEuler(new Euler(...o.rotation)),
      up = new Vector3(0, 1, 0).applyQuaternion(q),
      axis = new Vector3(1, 0, 0).applyQuaternion(q),
      upright = Math.abs(Math.abs(up.y) - 1) < 1e-5;
    const approximate =
      o.type === "model" ||
      !["cube", "wall", "floor"].includes(o.type) ||
      !upright;
    const size = objectSize(o).map((n, i) => n * o.scale[i]);
    colliders.push({
      id: o.id,
      box: b,
      cx: approximate ? (b.min.x + b.max.x) / 2 : o.position[0],
      cz: approximate ? (b.min.z + b.max.z) / 2 : o.position[2],
      hx: approximate ? (b.max.x - b.min.x) / 2 : size[0] / 2,
      hz: approximate ? (b.max.z - b.min.z) / 2 : size[2] / 2,
      yaw: approximate ? 0 : Math.atan2(-axis.z, axis.x),
      stair:
        c?.role === "stair" &&
        !!(
          c.structure?.standaloneStairs ||
          r?.stairs?.some((s) => s.id === c.assembly)
        ),
      approximate,
    });
  }
  return {
    colliders,
    bounds: whole,
    approximate: colliders.filter((c) => c.approximate).length,
    passableDoors,
  };
}
function horizontal(c: Collider, x: number, z: number, radius = BODY_RADIUS) {
  const dx = x - c.cx,
    dz = z - c.cz,
    a = Math.cos(c.yaw),
    b = Math.sin(c.yaw),
    lx = a * dx - b * dz,
    lz = b * dx + a * dz;
  return (
    Math.hypot(
      Math.max(Math.abs(lx) - c.hx, 0),
      Math.max(Math.abs(lz) - c.hz, 0),
    ) <
    radius - 1e-6
  );
}
export function bodyClear(world: NavigationWorld, p: Vec3, height = 1.75) {
  if (
    Math.abs(p[0]) > 49.5 ||
    Math.abs(p[2]) > 49.5 ||
    p[1] < -0.01 ||
    p[1] + height > 100
  )
    return false;
  return !world.colliders.some(
    (c) =>
      horizontal(c, p[0], p[2]) &&
      c.box.max.y > p[1] + 0.015 &&
      c.box.min.y < p[1] + height - 0.015 &&
      !(c.stair && c.box.max.y <= p[1] + STEP_HEIGHT + BODY_RADIUS),
  );
}
function support(world: NavigationWorld, x: number, z: number, max: number) {
  let top = 0;
  for (const c of world.colliders)
    if (
      c.box.max.y <= max + 1e-6 &&
      c.box.max.y >= top &&
      horizontal(c, x, z, BODY_RADIUS - 0.005)
    )
      top = c.box.max.y;
  return top;
}
export const GRAVITY = 9.8,
  JUMP_VELOCITY = 4.2;
/** A rising body cannot be re-armed until actual floor contact. */
export function jumpBody(
  world: NavigationWorld,
  body: Body,
  height = 1.75,
): Body {
  const floor = support(
    world,
    body.position[0],
    body.position[2],
    body.position[1] + 0.01,
  );
  return body.grounded &&
    Math.abs(body.position[1] - floor) < 0.02 &&
    bodyClear(world, body.position, height)
    ? { position: [...body.position], velocity: JUMP_VELOCITY, grounded: false }
    : body;
}
/** Swept horizontal AND vertical substeps preserve thin walls, ceilings and landings. */
export function moveBody(
  world: NavigationWorld,
  body: Body,
  dx: number,
  dz: number,
  dt: number,
  height = 1.75,
): Body {
  if (
    ![...body.position, body.velocity, dx, dz, dt, height].every(
      Number.isFinite,
    ) ||
    height < 1.2 ||
    height > 2.2
  )
    throw Error("Invalid walkthrough body state.");
  const p = [...body.position] as Vec3,
    t = Math.max(0, Math.min(dt, 0.1));
  const n = Math.max(
    1,
    Math.ceil(
      Math.max(
        Math.hypot(dx, dz) / 0.04,
        ((Math.abs(body.velocity) + GRAVITY * t) * t) / 0.04,
        t / 0.012,
      ),
    ),
  );
  // Inputs come from bounded camera movement. Reject pathological external displacements rather than tunnel.
  if (n > 1024)
    throw Error("Walkthrough displacement exceeds the safe sweep budget.");
  let v = body.velocity,
    grounded = body.grounded;
  for (let i = 0; i < n; i++) {
    const step = t / n;
    for (const axis of [0, 2] as const) {
      const next = [...p] as Vec3;
      next[axis] += (axis === 0 ? dx : dz) / n;
      const top = support(world, next[0], next[2], p[1] + STEP_HEIGHT);
      if (grounded && v <= 0) next[1] = Math.max(p[1], top);
      if (bodyClear(world, next, height)) {
        p[0] = next[0];
        p[1] = next[1];
        p[2] = next[2];
      }
    }
    const floor = support(world, p[0], p[2], p[1] + 0.001);
    if (v <= 0 && p[1] <= floor + 0.015) {
      p[1] = floor;
      v = 0;
      grounded = true;
      continue;
    }
    grounded = false;
    const nextV = Math.max(-15, v - GRAVITY * step),
      target = p[1] + (v + nextV) * 0.5 * step;
    v = nextV;
    if (target > p[1]) {
      let ceiling = 100;
      for (const c of world.colliders)
        if (horizontal(c, p[0], p[2]) && c.box.min.y >= p[1] + height - 0.015)
          ceiling = Math.min(ceiling, c.box.min.y);
      p[1] = Math.min(target, ceiling - height);
      if (p[1] < target) v = 0;
    } else {
      p[1] = Math.max(floor, target);
      if (p[1] <= floor + 0.000001) {
        v = 0;
        grounded = true;
      }
    }
  }
  return { position: p, velocity: v, grounded };
}
export function safeSpawn(
  world: NavigationWorld,
  anchor: Vec3 = [0, 0, 0],
  height = 1.75,
): Body | null {
  const candidates: Vec3[] = [];
  for (let ring = 0; ring <= 14; ring++)
    for (let x = -ring; x <= ring; x++)
      for (let z = -ring; z <= ring; z++)
        if (Math.max(Math.abs(x), Math.abs(z)) === ring)
          candidates.push([anchor[0] + x * 0.5, 0, anchor[2] + z * 0.5]);
  for (const p of candidates) {
    const tops = [
      0,
      ...world.colliders
        .filter((c) => !c.furniture && horizontal(c, p[0], p[2], 0.035))
        .map((c) => c.box.max.y),
    ]
      .filter((n) => n >= 0 && n <= Math.max(anchor[1] + 0.5, 1))
      .sort((a, b) => a - b);
    for (const y of tops) {
      const feet: [number, number, number] = [p[0], y, p[2]];
      if (bodyClear(world, feet, height))
        return { position: feet, velocity: 0, grounded: true };
    }
  }
  return null;
}

/** Render/navigation share the same native-portal rule. No geometry is edited. */
export function isPassableDoor(o: SceneObject): boolean {
  const c = o.construction,
    r = c?.structure?.template ?? c?.structure?.architectureTemplate;
  return !!(
    c?.role === "door" &&
    c.opening &&
    ((r &&
      openingDefinitions(r, c.structure?.floorLayouts).some(
        (d) => d.id === c.opening && d.kind === "door",
      )) ||
      c.structure?.nativeWall?.openings.some(
        (d) => d.id === c.opening && d.kind === "door",
      ))
  );
}

/** One immutable scene snapshot, built on demand only while walking. */
export class NavigationCache {
  private source: SceneObject[] | null = null;
  private world: NavigationWorld | null = null;
  private count = 0;
  get builds() {
    return this.count;
  }
  read(objects: SceneObject[]) {
    if (this.source !== objects || !this.world) {
      this.world = navigationWorld(objects);
      this.source = objects;
      this.count++;
    }
    return this.world;
  }
  clear() {
    this.source = null;
    this.world = null;
  }
}
