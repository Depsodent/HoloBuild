import architecturalResponse from "../fixtures/ollama-architecture.json";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { interpretConversation } from "../../src/generation/semanticAssistant";
import {
  dispatchAssistant,
  cancelAssistantPreview,
} from "../../src/generation/assistant";
import {
  useGenerationStore,
  cancelGeneration,
} from "../../src/generation/generationStore";
import {
  useEditStore,
  cancelEdit,
  editContext,
} from "../../src/generation/editStore";
import { useSceneStore } from "../../src/scene/sceneStore";
import { offlinePlan } from "../../src/generation/offline";
import { CommandInterpreter } from "../../src/commands/interpreter";
import {
  useConversationStore,
  newConversation,
  conversationMessage,
} from "../../src/generation/conversationStore";
const scene = () => useSceneStore.getState();
const settings = { mode: "auto" as const };
const chat = (s: string) =>
  dispatchAssistant(s, settings, new CommandInterpreter(async () => {}));
beforeEach(() => {
  cancelGeneration();
  cancelEdit();
  newConversation();
  useGenerationStore.setState({ mode: "auto", options: {} });
  useSceneStore.setState({
    objects: [],
    past: [],
    future: [],
    selectedId: null,
    selectedStructureId: null,
    selectionMode: "component",
    preview: null,
    snap: false,
  });
});
afterEach(() => {
  cancelGeneration();
  vi.unstubAllGlobals();
});
const design = () => offlinePlan("house floors 2 with two windows").template!;
it("unmatched flexible language reaches the model once and prepares actual validated geometry", async () => {
  const fetch = vi.fn(async (url: RequestInfo | URL) => {
    expect(String(url)).toBe("/api/planner/assistant");
    return Response.json({
      source: "llm",
      provider: "Gemini",
      model: "test",
      requestId: "semantic-1",
      plan: {
        kind: "create",
        design: design(),
        message: "A two-story house approximates the villa.",
      },
    });
  });
  vi.stubGlobal("fetch", fetch);
  await chat("I want a modern two-storey villa.");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0]?.[0])).toBe("/api/planner/assistant");
  expect(useGenerationStore.getState().status).toBe("preview");
  expect(
    useGenerationStore.getState().prepared!.objects.length,
  ).toBeGreaterThan(6);
  expect(scene().objects).toHaveLength(0);
  expect(useConversationStore.getState().messages.at(-1)?.text).toMatch(
    /validated design preview/,
  );
  await chat("Yes");
  expect(scene().past).toHaveLength(1);
  expect(scene().objects).toHaveLength(
    useGenerationStore.getState().prepared?.objects.length ??
      scene().objects.length,
  );
});
it("clarifications and provider errors settle without claiming scene success", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json({
      source: "llm",
      plan: { kind: "clarify", message: "Which structure would you like?" },
    }),
  );
  const r = await interpretConversation("Something for my garden", settings);
  expect(r.ok).toBe(false);
  expect(useGenerationStore.getState().status).toBe("idle");
  expect(scene().past).toHaveLength(0);
  vi.stubGlobal("fetch", async () =>
    Response.json(
      {
        kind: "rate-limit",
        error: "Too many requests; retry in 9 seconds.",
        requestId: "safe-1041",
      },
      { status: 429 },
    ),
  );
  await chat("I would like a villa");
  expect(useGenerationStore.getState().status).toBe("error");
  expect(useConversationStore.getState().messages.at(-1)?.text).toContain(
    "safe-1041",
  );
  expect(scene().objects).toHaveLength(0);
});
it("cancellation ignores late model output and preserves the existing scene", async () => {
  let release!: (r: Response) => void;
  vi.stubGlobal(
    "fetch",
    () =>
      new Promise<Response>((r) => {
        release = r;
      }),
  );
  const request = interpretConversation("Something residential", settings);
  cancelAssistantPreview();
  release(
    Response.json({
      source: "llm",
      plan: { kind: "create", design: design(), message: "Ready" },
    }),
  );
  await request;
  expect(useGenerationStore.getState().prepared).toBeNull();
  expect(useGenerationStore.getState().status).toBe("idle");
  expect(scene().past).toHaveLength(0);
});
it("additive second-floor windows preserve the same house, materials, history and original lower floor", async () => {
  await chat(
    "Build a two-story house with two windows and yellow walls and a pink roof",
  );
  await chat("Yes");
  const base = scene().objects;
  const group = scene().selectedStructureId;
  await chat("Add three windows to the second floor");
  expect(useEditStore.getState().status, useEditStore.getState().message).toBe(
    "preview",
  );
  expect(scene().objects).toBe(base);
  await chat("Yes");
  expect(scene().selectedStructureId).toBe(group);
  expect(
    scene().objects.filter(
      (o) => o.construction?.role === "window" && o.construction.level === 1,
    ),
  ).toHaveLength(5);
  expect(
    scene().objects.filter(
      (o) => o.construction?.role === "window" && o.construction.level === 0,
    ),
  ).toHaveLength(2);
  expect(
    scene()
      .objects.filter((o) => o.construction?.role === "wall")
      .every((o) => o.color === "#f5d76e"),
  ).toBe(true);
  expect(scene().past).toHaveLength(2);
  await chat("Undo");
  expect(scene().objects).toEqual(base);
});
it("model output cannot alter a different target or execute code", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json({
      source: "llm",
      requestId: "invalid-op",
      plan: {
        kind: "edit",
        scope: "component",
        target: crypto.randomUUID(),
        operation: { type: "execute", code: "delete" },
        message: "Done",
      },
    }),
  );
  const r = await interpretConversation("Improve this", settings);
  expect(r.ok).toBe(false);
  expect(scene().past).toHaveLength(0);
  expect(useGenerationStore.getState().message).toContain("invalid-op");
});
import { createCube } from "../../src/scene/objectFactory";
it("model-backed component edit preserves selection, other objects and exact shared history", async () => {
  const cube = createCube([0, 0.5, 0]),
    other = createCube([5, 0.5, 0]);
  useSceneStore.setState({ objects: [cube, other], selectedId: cube.id });
  vi.stubGlobal("fetch", async () =>
    Response.json({
      source: "llm",
      plan: {
        kind: "edit",
        scope: "component",
        target: cube.id,
        operation: { type: "scale", factors: [1, 0.5, 1] },
        message: "A half-height version of the selected cube.",
      },
    }),
  );
  const base = scene().objects;
  const r = await interpretConversation(
    "I prefer this component half as tall",
    settings,
  );
  expect(r.ok).toBe(true);
  expect(scene().objects).toBe(base);
  await chat("Yes");
  expect(scene().selectedId).toBe(cube.id);
  expect(scene().objects[1]).toEqual(other);
  expect(scene().objects[0].scale).toEqual([1, 0.5, 1]);
  expect(scene().past).toHaveLength(1);
  await chat("Undo");
  expect(scene().objects).toEqual(base);
});
it("a model cannot redirect an all-parts request into a single component", async () => {
  const cube = createCube();
  useSceneStore.setState({ objects: [cube], selectedId: cube.id });
  vi.stubGlobal("fetch", async () =>
    Response.json({
      source: "llm",
      plan: {
        kind: "edit",
        scope: "component",
        target: cube.id,
        operation: { type: "color", color: "#0000ff" },
        message: "Blue",
      },
    }),
  );
  const r = await interpretConversation(
    "Every component needs a new finish",
    settings,
  );
  expect(r.ok).toBe(false);
  expect(useEditStore.getState().prepared).toBeNull();
  expect(scene().past).toHaveLength(0);
});
it("supported architectural features cannot be silently omitted from a model design", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json({
      source: "llm",
      plan: { kind: "create", design: design(), message: "Here is your house" },
    }),
  );
  const r = await interpretConversation(
    "A villa with balconies and a staircase",
    settings,
  );
  expect(r.ok).toBe(false);
  expect(useGenerationStore.getState().prepared).toBeNull();
  expect(scene().objects).toHaveLength(0);
});
it("a selected imported model material proposal disables original surfaces only in its preview", async () => {
  const model = {
    ...createCube(),
    type: "model" as const,
    model: {
      assetId: "a".repeat(64),
      size: [1, 1, 1] as [number, number, number],
      originalMaterials: true,
    },
  };
  useSceneStore.setState({ objects: [model], selectedId: model.id });
  vi.stubGlobal("fetch", async () =>
    Response.json({
      source: "llm",
      plan: {
        kind: "edit",
        scope: "component",
        target: model.id,
        operation: { type: "material", material: "wood" },
        message: "Use a wood finish",
      },
    }),
  );
  await interpretConversation("A timber finish would suit this part", settings);
  expect(scene().objects[0].model?.originalMaterials).toBe(true);
  expect(useEditStore.getState().prepared!.result.parts[0]).toMatchObject({
    material: "wood",
    model: { originalMaterials: false, assetId: model.model.assetId },
  });
  expect(scene().past).toHaveLength(0);
});
it("a fresh interpretation clears geometry-retry metadata from a previous unrelated request", async () => {
  useGenerationStore.setState({ retryReason: "overlap", retryCount: 1 });
  vi.stubGlobal("fetch", async () =>
    Response.json({
      source: "llm",
      plan: { kind: "clarify", message: "What dimensions would you like?" },
    }),
  );
  await interpretConversation("A sheltered garden place", settings);
  expect(useGenerationStore.getState().retryReason).toBeNull();
  expect(useGenerationStore.getState().retryCount).toBe(0);
});
it("flexible interpretation retains custom primitive-plan generation beyond templates", async () => {
  const plan = {
    version: 1 as const,
    name: "A platform",
    units: "meters" as const,
    objects: [
      {
        id: "slab",
        name: "Platform",
        role: "floor" as const,
        type: "floor" as const,
        position: [0, 0.1, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        dimensions: [4, 0.2, 4] as [number, number, number],
        material: "concrete" as const,
        color: "#ffffff",
      },
    ],
    contacts: [],
    warnings: [],
  };
  vi.stubGlobal("fetch", async () =>
    Response.json({
      source: "llm",
      provider: "Gemini",
      plan: { kind: "compose", plan, message: "One concrete platform slab" },
    }),
  );
  const r = await interpretConversation(
    "A flat place to display my models",
    settings,
  );
  expect(r.ok).toBe(true);
  expect(useGenerationStore.getState().prepared!.objects).toHaveLength(1);
  expect(useGenerationStore.getState().notice).toContain(
    "validated generated geometry",
  );
  expect(scene().objects).toHaveLength(0);
  await chat("Yes");
  expect(scene().objects).toHaveLength(1);
  expect(scene().past).toHaveLength(1);
});

it("native selected-opening recipe edits preserve unrelated parts and preview exact aperture geometry", async () => {
  const { openingDefinitions } = await import("../../src/generation/openings");
  const { confirmEdit } = await import("../../src/generation/editStore");
  await chat("Build a house with two windows");
  await chat("Yes");
  const before = scene().objects;
  const selected = before.find((o) => o.construction?.role === "window")!;
  scene().setSelectionMode("component");
  scene().select(selected.id);
  const definitions = openingDefinitions(
    selected.construction!.structure!.template!,
  );
  const target = definitions.find(
    (o) =>
      o.kind === "window" && Math.abs(o.offset - selected.position[0]) < 1e-6,
  )!;
  const operation = {
    type: "design",
    openings: definitions.map((o) =>
      o.id === target.id ? { ...o, width: o.width * 1.2 } : o,
    ),
  };
  vi.stubGlobal("fetch", async () =>
    Response.json({
      source: "llm",
      plan: {
        kind: "edit",
        scope: "structure",
        target: selected.construction!.structureId,
        operation,
        message: "Widen only your selected window.",
      },
    }),
  );
  const result = await interpretConversation(
    "Give the selected window a wider aperture",
    settings,
  );
  expect(result.ok, result.message).toBe(true);
  expect(scene().objects).toBe(before);
  expect(confirmEdit()).toBe(true);
  expect(
    scene().objects.find((o) => o.id === selected.id)!.scale[0],
  ).toBeCloseTo(selected.scale[0] * 1.2);
  expect(scene().selectedStructureId).toBeNull();
});
it("model Part-scope design payloads cannot edit other openings, floors or staircase recipes", async () => {
  const { openingDefinitions } = await import("../../src/generation/openings");
  await chat("Build a house with two windows");
  await chat("Yes");
  const before = scene().objects;
  const selected = before.find((o) => o.construction?.role === "window")!;
  scene().setSelectionMode("component");
  scene().select(selected.id);
  const openings = openingDefinitions(
    selected.construction!.structure!.template!,
  );
  for (const operation of [
    { type: "design", floors: 2 },
    {
      type: "design",
      openings: openings.map((o) => ({ ...o, width: o.width * 1.1 })),
    },
  ]) {
    vi.stubGlobal("fetch", async () =>
      Response.json({
        source: "llm",
        plan: {
          kind: "edit",
          scope: "component",
          target: selected.id,
          operation,
          message: "An unrelated edit disguised as a Part.",
        },
      }),
    );
    const result = await interpretConversation(
      "Adjust the selected aperture",
      settings,
    );
    expect(result.ok).toBe(false);
    expect(scene().objects).toBe(before);
    expect(useEditStore.getState().prepared).toBeNull();
  }
});

it("placement clarification stays on new-building planning while a starter cube is selected", async () => {
  const cube = createCube();
  useSceneStore.setState({ objects: [cube], selectedId: cube.id });
  const design = offlinePlan("house", {
    width: 6,
    depth: 6,
    height: 3,
    floors: 2,
    doors: 0,
    windows: 0,
    stairs: [
      {
        id: "flight",
        from: 0,
        to: 1,
        steps: 16,
        rise: 0.2,
        run: 0.2,
        width: 1,
        x: -1.5,
        z: 0,
        yaw: 0,
        material: "concrete",
        color: "#336699",
      },
    ],
    openings: [
      {
        id: "entry",
        kind: "door",
        level: 1,
        facade: "front",
        offset: 0,
        bottom: 0,
        width: 1,
        height: 2.1,
        panel: true,
      },
    ],
    balconies: [
      {
        id: "balcony",
        level: 1,
        facade: "front",
        offset: 0,
        width: 2.4,
        depth: 1.5,
        railHeight: 1.1,
        material: "concrete",
        color: "#336699",
        access: "entry",
        ownsAccess: true,
      },
    ],
  }).template!;
  let calls = 0;
  vi.stubGlobal("fetch", async () =>
    Response.json({
      source: "llm",
      plan:
        ++calls === 1
          ? { kind: "clarify", message: "Which facade and floor?" }
          : { kind: "create", design, message: "Review your placement." },
    }),
  );
  await chat("generate a 2 story house including a balcony and stairs");
  expect(useConversationStore.getState().pendingCreation).toBe(true);
  for (let i = 0; i < 8; i++)
    conversationMessage("assistant", "Placement detail " + i);
  expect(
    editContext().conversation?.some((m) =>
      m.text.includes("generate a 2 story"),
    ),
  ).toBe(false);
  expect(editContext().creationRequest).toBe(
    "generate a 2 story house including a balcony and stairs",
  );
  const base = scene().objects;
  await chat(
    "Put the stairs on the left and the balcony on the front of the second floor",
  );
  expect(calls).toBe(2);
  expect(
    useGenerationStore.getState().status,
    useGenerationStore.getState().message,
  ).toBe("preview");
  expect(scene().objects).toBe(base);
  expect(useConversationStore.getState().pendingCreation).toBe(false);
  expect(useConversationStore.getState().pendingCreationRequest).toBe("");
});
it("cancel/reset clears unfinished creation clarification without touching existing objects", async () => {
  const cube = createCube();
  useSceneStore.setState({ objects: [cube], selectedId: cube.id });
  useConversationStore.setState({
    pendingCreation: true,
    pendingCreationRequest: "Build a house",
  });
  cancelAssistantPreview();
  expect(useConversationStore.getState().pendingCreation).toBe(false);
  expect(scene().objects).toEqual([cube]);
  expect(useConversationStore.getState().pendingCreationRequest).toBe("");
  useConversationStore.setState({
    pendingCreation: true,
    pendingCreationRequest: "Build a house",
  });
  newConversation();
  expect(useConversationStore.getState().pendingCreation).toBe(false);
  expect(useConversationStore.getState().pendingCreationRequest).toBe("");
});

it("clarification preserves original architectural requirements and newly supplied appearance until validation succeeds", async () => {
  for (const [original, reply, reason] of [
    [
      "generate a 2 story house including a balcony and stairs",
      "Use left stairs and a front balcony",
      /No staircase/,
    ],
    ["Build a two-story house", "Use yellow walls", /requested wall color/],
  ] as const) {
    newConversation();
    const base = scene().objects;
    useConversationStore.setState({
      pendingCreation: true,
      pendingCreationRequest: original,
    });
    const proposal = offlinePlan("house", {
      floors: 2,
      appearance: { wall: { color: "#808080" } },
    }).template!;
    vi.stubGlobal("fetch", async () =>
      Response.json({
        source: "llm",
        plan: { kind: "create", design: proposal, message: "Review" },
      }),
    );
    const result = await interpretConversation(reply, settings);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(reason);
    expect(scene().objects).toBe(base);
    expect(useGenerationStore.getState().prepared).toBeNull();
    expect(useConversationStore.getState().pendingCreationRequest).toBe(
      original,
    );
  }
});

it.each(["auto", "llm"] as const)(
  "%s creation uses the compact conversational recipe path",
  async (mode) => {
    const fetch = vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toBe("/api/planner/assistant");
      return Response.json({
        source: "llm",
        plan: {
          ...architecturalResponse,
          message: "Review the new house.",
        },
      });
    });
    vi.stubGlobal("fetch", fetch);
    const base = scene().objects;
    await dispatchAssistant(
      "generate a 2 story house including a balcony and stairs",
      { mode },
      new CommandInterpreter(async () => {}),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(useGenerationStore.getState().status).toBe("preview");
    expect(scene().objects).toBe(base);
  },
);

it("a creation-worded follow-up referring to the same selected house remains an edit", async () => {
  await chat("Build a two-story house");
  await chat("Yes");
  const target = scene().selectedStructureId;
  await chat("Undo");
  await chat("Redo");
  const base = scene().objects;
  expect(scene().selectedStructureId).toBeNull();
  expect(target).toBeTruthy();
  const fetch = vi.fn(async (url: RequestInfo | URL) => {
    expect(String(url)).toBe("/api/planner/assistant");
    return Response.json({
      source: "llm",
      plan: {
        kind: "edit",
        scope: "structure",
        target,
        operation: { type: "color", role: "roof", color: "#008080" },
        message: "Review the roof.",
      },
    });
  });
  vi.stubGlobal("fetch", fetch);
  await dispatchAssistant(
    "Could you make the roof a shade of teal while keeping the rest of this same house as it is?",
    { mode: "llm" },
    new CommandInterpreter(async () => {}),
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(useEditStore.getState().status).toBe("preview");
  expect(scene().objects).toBe(base);
  expect(useGenerationStore.getState().prepared).toBeNull();
});
