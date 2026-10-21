import { TwoHandController } from "../../src/interaction/twoHandController";
import { useAdvancedStore } from "../../src/interaction/advancedStore";
import { useInteractionStore } from "../../src/interaction/interactionStore";
import { pair } from "../fixtures/advanced";
import {
  transformedPlacement,
  yawRotation,
} from "../../src/interaction/twoHandMath";
import { Vector3 } from "three";
import { precisionUpdate } from "../../src/scene/precision";
import { readFileSync } from "node:fs";
import { materializePlan } from "../../src/generation/engine";
import { offlinePlan } from "../../src/generation/offline";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  FURNITURE,
  FURNITURE_IDS,
  FURNITURE_CATEGORIES,
  searchFurniture,
} from "../../shared/furnitureCatalog.mjs";
import { createFurniture } from "../../src/furniture/factory";
import {
  furniturePlacement,
  attachmentCandidate,
  furnitureVolumes,
} from "../../src/furniture/placement";
import { createObject, objectSize } from "../../src/scene/objectFactory";
import { objectSchema } from "../../src/scene/objectTypes";
import { bounds, placement } from "../../src/interaction/placement";
import { useSceneStore } from "../../src/scene/sceneStore";
import {
  execute,
  executeFurnishing,
  undo,
  redo,
} from "../../src/scene/commandManager";
import {
  useViewStore,
  publishCameraFeet,
} from "../../src/exploration/viewStore";
import {
  navigationWorld,
  bodyClear,
  NavigationCache,
  safeSpawn,
} from "../../src/exploration/navigation";
import { serialize, deserialize } from "../../src/scene/sceneSerializer";
import {
  beginFurniture,
  updateFurniture,
  confirmFurniture,
  cancelFurniture,
} from "../../src/furniture/furnishStore";
import {
  useEditStore,
  confirmEdit,
  cancelEdit,
} from "../../src/generation/editStore";
import { useGenerationStore } from "../../src/generation/generationStore";
import { furnitureIntent } from "../../src/furniture/assistant";
import { interpretConversation } from "../../src/generation/semanticAssistant";
import { parseModelAssistant } from "../../shared/assistantSchema.mjs";
beforeEach(() => {
  useSceneStore.setState({
    objects: [],
    past: [],
    future: [],
    selectedId: null,
    selectedStructureId: null,
    selectionMode: "component",
    preview: null,
  });
  useViewStore.setState({ walking: false, furnishing: false });
  publishCameraFeet(null);
  useGenerationStore.setState({ prepared: null, status: "idle" });
  cancelEdit();
  cancelFurniture();
});
it("catalog covers all six categories with at least 30 distinct recipes", () => {
  expect(FURNITURE_IDS.length).toBe(45);
  expect(new Set(FURNITURE_IDS).size).toBe(45);
  expect(FURNITURE_CATEGORIES).toHaveLength(6);
  expect(
    new Set(Object.values(FURNITURE).map((d) => JSON.stringify(d.parts))).size,
  ).toBe(45);
  expect(searchFurniture("SOFA")).toHaveLength(3);
  expect(
    searchFurniture("", "Office and Study").some((d) => d.id === "bookshelf"),
  ).toBe(true);
  expect(searchFurniture("zzzzz")).toHaveLength(0);
});
it.each(FURNITURE_IDS)(
  "%s has registered metadata, canonical bounds and recognizable multi-part native geometry",
  (id) => {
    const d = FURNITURE[id],
      o = createFurniture(id);
    expect(objectSchema.safeParse(o).success).toBe(true);
    expect(d.parts.length).toBeGreaterThanOrEqual(2);
    expect(d.size.every((n) => n > 0 && n < 4)).toBe(true);
    expect(bounds(o).min.y).toBeCloseTo(0, 8);
    expect(objectSize(o)).toEqual(d.size);
    expect(furnitureVolumes(o).length).toBeGreaterThanOrEqual(1);
    expect(furnitureVolumes(o).length).toBeLessThanOrEqual(d.parts.length);
    expect(d.parts.some((p) => p.shape !== "box") || d.parts.length >= 3).toBe(
      true,
    );
  },
);
it("unknown or mismatched furniture metadata is rejected", () => {
  expect(() => createFurniture("executed-code")).toThrow();
  const o = createFurniture("sofa-two");
  expect(
    objectSchema.safeParse({ ...o, furniture: { preset: "unsupported" } })
      .success,
  ).toBe(false);
  expect(objectSchema.safeParse({ ...o, type: "cube" }).success).toBe(false);
});
it.each([
  "sofa-two",
  "coffee-table",
  "wardrobe",
  "bed-double",
  "kitchen-counter",
])(
  "%s rests on floors and blocks solid body space using bounded proxies",
  (id) => {
    const o = createFurniture(id),
      w = navigationWorld([o]);
    expect(furniturePlacement(o, []).valid).toBe(true);
    expect(bodyClear(w, [0, 0, 0])).toBe(false);
    expect(bodyClear(w, [5, 0, 5])).toBe(true);
  },
);
it("full support is required on upper floors; floating/overlapping items and oversized transforms reject", () => {
  const floor = createObject("floor", [0, 3.1, 0]),
    o = createFurniture("bed-double", [0, 3.2, 0]);
  expect(placement(o, o.position, [floor], false).valid).toBe(true);
  expect(
    furniturePlacement({ ...o, position: [3, o.position[1], 0] }, [floor])
      .valid,
  ).toBe(false);
  expect(furniturePlacement(o, []).valid).toBe(false);
  expect(
    furniturePlacement(createFurniture("armchair"), [
      createFurniture("sofa-two"),
    ]).valid,
  ).toBe(false);
  expect(furniturePlacement({ ...o, scale: [5, 1, 1] }, [floor]).valid).toBe(
    false,
  );
});
it("wall and ceiling attachments validate full backing and appropriate face", () => {
  const wall = createObject("wall", [0, 1, 0]),
    clock = createFurniture("wall-clock"),
    onWall = attachmentCandidate(clock, [0, 1, 0.125], [0, 0, 1])!;
  expect(furniturePlacement(onWall, [wall]).valid).toBe(true);
  expect(furniturePlacement(clock, []).valid).toBe(false);
  expect(attachmentCandidate(clock, [0, 0, 0], [0, 1, 0])).toBeNull();
  const ceiling = createObject("floor", [0, 3, 0]),
    light = attachmentCandidate(
      createFurniture("ceiling-light"),
      [0, 2.9, 0],
      [0, -1, 0],
    )!;
  expect(furniturePlacement(light, [ceiling]).valid).toBe(true);
  expect(furniturePlacement(light, []).valid).toBe(false);
});
it("surface decor requires a table or counter, not bare floor or an unsupported plane", () => {
  const table = createFurniture("dining-table"),
    lamp = createFurniture("table-lamp", [0, bounds(table).max.y, 0]);
  expect(furniturePlacement(lamp, [table]).valid).toBe(true);
  expect(furniturePlacement(createFurniture("table-lamp"), []).valid).toBe(
    false,
  );
});
it("preview cancellation is inert; repeated confirmation creates exactly one history action", () => {
  const base = useSceneStore.getState().objects;
  beginFurniture("sofa-two");
  updateFurniture(createFurniture("sofa-two", [3, 0, 0]));
  expect(useSceneStore.getState().objects).toBe(base);
  cancelFurniture();
  expect(useSceneStore.getState().past).toHaveLength(0);
  beginFurniture("sofa-two");
  updateFurniture(createFurniture("sofa-two", [3, 0, 0]));
  expect(confirmFurniture()).toBe(true);
  expect(confirmFurniture()).toBe(false);
  expect(useSceneStore.getState().past).toHaveLength(1);
});
it("all editor operations use ordinary history and furniture survives portable IO", () => {
  const o = createFurniture("sofa-two");
  expect(execute({ type: "furniture", object: o })).toBe(true);
  expect(
    execute({
      type: "update",
      id: o.id,
      patch: {
        rotation: [0, Math.PI / 2, 0],
        color: "#0000ff",
        material: "wood",
      },
    }),
  ).toBe(true);
  const edited = structuredClone(useSceneStore.getState().objects);
  undo();
  redo();
  expect(useSceneStore.getState().objects).toEqual(edited);
  expect(deserialize(serialize(edited))).toEqual(edited);
  expect(execute({ type: "duplicate", id: o.id })).toBe(true);
  expect(useSceneStore.getState().objects).toHaveLength(2);
  expect(execute({ type: "delete", id: o.id })).toBe(true);
  undo();
  expect(useSceneStore.getState().objects).toHaveLength(2);
});
it("walking stays read-only except narrow furnishing commands; stale operations and camera trapping reject", () => {
  publishCameraFeet([0, 0, 0]);
  useViewStore.setState({ walking: true, furnishing: true });
  const base = useSceneStore.getState().objects;
  expect(execute({ type: "create" })).toBe(false);
  expect(
    executeFurnishing(
      { type: "furniture", object: createFurniture("sofa-two") },
      base,
    ),
  ).toBe(false);
  expect(
    executeFurnishing(
      { type: "furniture", object: createFurniture("sofa-two", [4, 0, 0]) },
      base,
    ),
  ).toBe(true);
  expect(
    executeFurnishing(
      { type: "furniture", object: createFurniture("armchair", [6, 0, 0]) },
      base,
    ),
  ).toBe(false);
  const committed = useSceneStore.getState().objects;
  undo();
  expect(useSceneStore.getState().objects).toBe(committed);
  useViewStore.setState({ walking: false, furnishing: false });
  undo();
  expect(useSceneStore.getState().objects).toEqual(base);
});
it("collision cache refreshes after insertion/deletion rather than per furniture or render", () => {
  const c = new NavigationCache(),
    a = [] as ReturnType<typeof createFurniture>[];
  c.read(a);
  for (let i = 0; i < 100; i++) c.read(a);
  expect(c.builds).toBe(1);
  const next = [createFurniture("wardrobe")];
  expect(bodyClear(c.read(next), [0, 0, 0])).toBe(false);
  expect(c.builds).toBe(2);
  expect(bodyClear(c.read([]), [0, 0, 0])).toBe(true);
});
it("AI exact object creation clarifies room ambiguity, keeps preview inert and confirms one command", () => {
  expect(furnitureIntent("Add a sofa to the living room.")).toMatch(
    /Which floor/,
  );
  expect(useEditStore.getState().prepared).toBeNull();
  expect(furnitureIntent("Add a sofa at 3,0,2")).toMatch(/preview/);
  expect(useSceneStore.getState().objects).toHaveLength(0);
  expect(confirmEdit()).toBe(true);
  expect(useSceneStore.getState().objects[0].furniture?.preset).toBe(
    "sofa-two",
  );
  expect(useSceneStore.getState().past).toHaveLength(1);
});
it("selected sofa color and table rotation previews preserve unrelated objects with exact history", () => {
  execute({ type: "furniture", object: createFurniture("sofa-two") });
  const original = useSceneStore.getState().objects;
  expect(furnitureIntent("Change this sofa to blue")).toMatch(/preview/);
  expect(useSceneStore.getState().objects).toBe(original);
  expect(confirmEdit()).toBe(true);
  expect(useSceneStore.getState().objects[0].color).toBe("#508ee8");
  const colored = useSceneStore.getState().objects;
  undo();
  expect(useSceneStore.getState().objects).toEqual(original);
  redo();
  expect(useSceneStore.getState().objects).toEqual(colored);
});
it("furniture routes do not intercept architectural creation or selected wall edits", () => {
  expect(
    furnitureIntent("generate a two story house including stairs"),
  ).toBeNull();
  expect(furnitureIntent("Change all walls to blue")).toBeNull();
  expect(furnitureIntent("Add a front door")).toBeNull();
});
it("provider response uses the same allowlisted furniture and strict placement fields", () => {
  expect(
    parseModelAssistant(
      JSON.stringify({
        kind: "furnish",
        preset: "bed-double",
        position: [3, 0, 2],
        message: "Review bed.",
      }),
    ).kind,
  ).toBe("furnish");
  expect(() =>
    parseModelAssistant(
      JSON.stringify({
        kind: "furnish",
        preset: "unlicensed-model",
        message: "x",
      }),
    ),
  ).toThrow();
  expect(() =>
    parseModelAssistant(
      JSON.stringify({
        kind: "furnish",
        preset: "bed-double",
        position: [100, 0, 0],
        message: "x",
        code: "no",
      }),
    ),
  ).toThrow();
});

afterEach(() => vi.unstubAllGlobals());
it("flexible Gemini/Ollama assistant furniture response reaches the same native preview and command", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        source: "llm",
        provider: "Gemini",
        model: "test",
        plan: {
          kind: "furnish",
          preset: "bed-double",
          position: [3, 0, 2],
          message: "Review the double bed.",
        },
      }),
    ),
  );
  const r = await interpretConversation("Provide a double bed at 3,0,2", {
    mode: "llm",
  });
  expect(r.ok).toBe(true);
  expect(useSceneStore.getState().objects).toHaveLength(0);
  expect(confirmEdit()).toBe(true);
  expect(useSceneStore.getState().objects[0].furniture?.preset).toBe(
    "bed-double",
  );
});
it("furniture planner does not invent unknown room coordinates", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json({
      source: "llm",
      model: "test",
      plan: {
        kind: "furnish",
        preset: "bed-double",
        position: [3, 0, 2],
        message: "Proposed room.",
      },
    }),
  );
  const r = await interpretConversation(
    "Comfortable sleeping furniture in my bedroom",
    { mode: "llm" },
  );
  expect(r.ok).toBe(false);
  expect(useEditStore.getState().prepared).toBeNull();
  expect(useSceneStore.getState().past).toHaveLength(0);
});

it("recorded house supports validated independent bedroom furniture on both floors", () => {
  const t = JSON.parse(
      readFileSync("tests/fixtures/gemini-m13-navigation.json", "utf8"),
    ),
    house = materializePlan(offlinePlan(t.kind, t)).objects,
    bed = createFurniture("bed-single", [1.4, 3.4, -1.1]),
    wardrobe = createFurniture("wardrobe", [1.4, 0.2, -1.2]),
    all = [...house, bed, wardrobe];
  for (const o of [bed, wardrobe])
    expect(furniturePlacement(o, all).reason).toMatch(/^Valid/);
  expect(
    execute({ type: "replace", objects: all }),
    useSceneStore.getState().status,
  ).toBe(true);
});

it("four supported corners do not permit bridging a hole in the floor interior", () => {
  const floor = (x: number, z: number, w: number, d: number) => ({
    ...createObject("floor", [x, 3.1, z]),
    scale: [w / 4, 1, d / 4] as [number, number, number],
  });
  const ring = [
      floor(-0.7, 0, 0.6, 2),
      floor(0.7, 0, 0.6, 2),
      floor(0, -0.7, 0.8, 0.6),
      floor(0, 0.7, 0.8, 0.6),
    ],
    rug = createFurniture("rug", [0, 3.2, 0]);
  expect(furniturePlacement(rug, ring).valid).toBe(false);
  expect(furniturePlacement(rug, [floor(0, 0, 3, 3)]).valid).toBe(true);
});

it("safe entry and reset do not spawn inside enclosed furniture or on its top", () => {
  for (const id of ["wardrobe", "sofa-two", "bed-double", "kitchen-counter"]) {
    const o = createFurniture(id),
      w = navigationWorld([o]),
      spawn = safeSpawn(w);
    expect(spawn).not.toBeNull();
    expect(spawn!.position[1]).toBe(0);
    expect(bodyClear(w, spawn!.position)).toBe(true);
    expect(
      bounds(o).containsPoint(
        new Vector3(spawn!.position[0], 0.1, spawn!.position[2]),
      ),
    ).toBe(false);
  }
});

it("Inspector resizing keeps an upper-floor furniture base stable and remains one undoable command", () => {
  const floor = createObject("floor", [0, 3.1, 0]),
    bed = createFurniture("bed-single", [0, 3.2, 0]);
  execute({ type: "replace", objects: [floor, bed] });
  const before = useSceneStore.getState().objects,
    result = precisionUpdate(before, bed, { scale: [1, 1.2, 1] });
  expect(bounds(result.parts[0]).min.y).toBeCloseTo(3.2);
  expect(execute(result.command), useSceneStore.getState().status).toBe(true);
  undo();
  expect(useSceneStore.getState().objects).toEqual(before);
});

it("gesture transforms preserve upper-floor furniture support and accept equivalent upright half-turn Euler angles", () => {
  const floor = createObject("floor", [0, 3.1, 0]),
    o = createFurniture("bedside-table", [0, 3.2, 0]),
    scaled = transformedPlacement(
      o,
      [1.2, 1.2, 1.2],
      o.rotation,
      [floor, o],
      false,
    );
  expect(scaled.valid).toBe(true);
  expect(bounds(scaled).min.y).toBeCloseTo(3.2);
  const turned = transformedPlacement(
    o,
    o.scale,
    yawRotation(o.rotation, Math.PI),
    [floor, o],
    false,
  );
  expect(turned.valid).toBe(true);
});

it("actual two-hand controller scales upper-floor furniture, releases once and retains exact Undo/Redo", () => {
  const floor = createObject("floor", [0, 3.1, 0]),
    o = createFurniture("bedside-table", [0, 3.2, 0]),
    base = [floor, o];
  useSceneStore.setState({
    objects: base,
    selectedId: o.id,
    selectedStructureId: null,
    snap: false,
  });
  useInteractionStore.setState({ menuOpen: false, phase: "idle" });
  useAdvancedStore.setState({ mode: "scale", active: false });
  const c = new TwoHandController();
  c.update(pair(0, 0.2, false));
  c.update(pair(100, 0.2, true));
  for (let t = 140; t < 1000; t += 40) c.update(pair(t, 0.3, true));
  expect(useSceneStore.getState().preview?.valid).toBe(true);
  expect(useSceneStore.getState().objects).toBe(base);
  c.update(pair(1050, 0.3, false));
  expect(useSceneStore.getState().past).toHaveLength(1);
  const after = useSceneStore.getState().objects;
  expect(after[1].scale[0]).toBeGreaterThan(1.3);
  expect(bounds(after[1]).min.y).toBeCloseTo(3.2);
  undo();
  expect(useSceneStore.getState().objects).toEqual(base);
  redo();
  expect(useSceneStore.getState().objects).toEqual(after);
});

it("selected furniture cannot intercept plural architectural edits or invent near-window moves", () => {
  execute({ type: "furniture", object: createFurniture("sofa-two") });
  const original = useSceneStore.getState().objects;
  for (const text of [
    "Change all walls to blue",
    "Make the stairs wooden",
    "Remove all windows",
    "Change the balconies to yellow",
  ])
    expect(furnitureIntent(text)).toBeNull();
  expect(furnitureIntent("Move this sofa near the window")).toBeNull();
  expect(furnitureIntent("Move this sofa to the living room")).toMatch(
    /exact position/,
  );
  expect(useSceneStore.getState().objects).toBe(original);
  expect(useEditStore.getState().prepared).toBeNull();
});

it("a provider-invented near-window furniture displacement is rejected despite collision-free geometry", async () => {
  const sofa = createFurniture("sofa-two");
  execute({ type: "furniture", object: sofa });
  vi.stubGlobal("fetch", async () =>
    Response.json({
      source: "llm",
      model: "test",
      plan: {
        kind: "edit",
        scope: "component",
        target: sofa.id,
        operation: { type: "move", delta: [1, 0, 0] },
        message: "Review a move.",
      },
    }),
  );
  const original = useSceneStore.getState().objects,
    r = await interpretConversation("Move this sofa near the window", {
      mode: "llm",
    });
  expect(r.ok).toBe(false);
  expect(r.message).toMatch(/not inferred/);
  expect(useEditStore.getState().prepared).toBeNull();
  expect(useSceneStore.getState().objects).toBe(original);
});

it("question-mark punctuation preserves explicit furniture coordinates in deterministic and semantic requests", async () => {
  expect(furnitureIntent("Add a sofa at 18,0,18?")).toMatch(/preview is ready/);
  expect(
    useEditStore.getState().prepared?.result.objects.at(-1)?.furniture?.preset,
  ).toBe("sofa-two");
  cancelEdit();
  const original = useSceneStore.getState().objects;
  vi.stubGlobal("fetch", async () =>
    Response.json({
      source: "llm",
      model: "test",
      plan: {
        kind: "furnish",
        preset: "sofa-two",
        position: [18, 0, 18],
        message: "Review a sofa.",
      },
    }),
  );
  const r = await interpretConversation(
    "Could you arrange a sofa at 18,0,18?",
    { mode: "llm" },
  );
  expect(r.ok).toBe(true);
  expect(useSceneStore.getState().objects).toBe(original);
  expect(useEditStore.getState().prepared).not.toBeNull();
});
