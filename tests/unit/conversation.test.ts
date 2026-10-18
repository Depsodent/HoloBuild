import { beforeEach, it, expect } from "vitest";
import {
  conversationIntent,
  refinementOperation,
} from "../../src/generation/conversationIntent";
import {
  dispatchAssistant,
  cancelAssistantPreview,
} from "../../src/generation/assistant";
import {
  newConversation,
  conversationMessage,
  useConversationStore,
} from "../../src/generation/conversationStore";
import {
  useGenerationStore,
  cancelGeneration,
} from "../../src/generation/generationStore";
import { useSceneStore } from "../../src/scene/sceneStore";
import {
  useEditStore,
  cancelEdit,
  editContext,
} from "../../src/generation/editStore";
import { CommandInterpreter } from "../../src/commands/interpreter";
import { structureInfo } from "../../src/scene/structures";
import { editContextSchema, editPlanSchema } from "../../shared/editSchema.mjs";
const scene = () => useSceneStore.getState();
const chat = (text: string) =>
  dispatchAssistant(
    text,
    { mode: "auto" },
    new CommandInterpreter(async () => {}),
  );
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
it.each([
  "Build a house.",
  "Generate a home.",
  "Make me a small house.",
  "Create a modern residential building.",
  "Can you make a two-floor house?",
  "I want a glass office building.",
  "Build a warehouse.",
  "Create a bridge support.",
  "Make a small cottage.",
  "Buld a HOUSE!",
])("recognizes creation paraphrase %s", (text) =>
  expect(conversationIntent(text, true).kind).toBe("create"),
);
it("recognizes confirmation, finish, undo and exact story wording", () => {
  expect(conversationIntent("Yes.", true).kind).toBe("confirm");
  expect(conversationIntent("That’s perfect, I am done.", true).kind).toBe(
    "finish",
  );
  expect(conversationIntent("Actually, undo that.", true).kind).toBe("undo");
  expect(refinementOperation("Make it two stories").operation).toEqual({
    type: "design",
    floors: 2,
  });
});
it("confirms and refines the same structure atomically while preserving attributes", async () => {
  await chat("Build a small modern house");
  expect(useGenerationStore.getState().source).toBe("procedural");
  expect(scene().objects).toHaveLength(0);
  await chat("Yes.");
  const id = scene().selectedStructureId;
  const base = scene().objects;
  expect(id).toBeTruthy();
  expect(scene().past).toHaveLength(1);
  await chat("Give it a blue roof and larger windows");
  expect(useEditStore.getState().status, useEditStore.getState().message).toBe(
    "preview",
  );
  expect(scene().objects).toBe(base);
  await chat("Looks good.");
  const changed = scene().objects;
  expect(scene().past).toHaveLength(2);
  expect(changed.find((p) => p.construction?.role === "roof")?.color).toBe(
    "#508ee8",
  );
  expect(
    changed.find((p) => p.construction?.role === "window")?.scale[0],
  ).toBeGreaterThan(
    base.find((p) => p.construction?.role === "window")!.scale[0],
  );
  await chat("Add a second floor");
  expect(useEditStore.getState().status, useEditStore.getState().message).toBe(
    "preview",
  );
  await chat("Perfect");
  expect(scene().selectedStructureId).toBe(id);
  expect(structureInfo(scene().objects).template?.floors).toBe(2);
  expect(
    scene().objects.find((p) => p.construction?.role === "roof")?.color,
  ).toBe("#508ee8");
  await chat("Actually, undo that.");
  expect(scene().objects).toEqual(changed);
  await chat("Redo");
  expect(structureInfo(scene().objects).template?.floors).toBe(2);
});
it("keeps six window openings and door appearance through floor-specific redesign", async () => {
  await chat(
    "Build a two-story modern house with yellow walls, a purple wooden door, six windows, three on each floor, and a pink roof.",
  );
  await chat("Yes");
  const id = scene().selectedStructureId;
  await chat("Put two windows on the second floor");
  expect(useEditStore.getState().status, useEditStore.getState().message).toBe(
    "preview",
  );
  await chat("Yes");
  expect(scene().selectedStructureId).toBe(id);
  expect(
    scene().objects.filter(
      (p) => p.construction?.role === "window" && p.construction.level === 0,
    ),
  ).toHaveLength(3);
  expect(
    scene().objects.filter(
      (p) => p.construction?.role === "window" && p.construction.level === 1,
    ),
  ).toHaveLength(2);
  expect(
    scene().objects.find((p) => p.construction?.role === "door"),
  ).toMatchObject({ color: "#aa79df", material: "wood" });
});
it("cancels component previews and confirms only one shared history action", async () => {
  await chat("Create a sphere");
  expect(scene().objects).toHaveLength(0);
  const expected = useEditStore.getState().prepared!.result.parts[0];
  await chat("Yes");
  expect(scene().objects[0]).toEqual(expected);
  await chat("Make the selected object red");
  expect(scene().past).toHaveLength(1);
  cancelAssistantPreview();
  expect(scene().objects[0]).toEqual(expected);
  await chat("Make the selected object red");
  await chat("Yes");
  expect(scene().past).toHaveLength(2);
  await chat("Undo");
  expect(scene().objects[0]).toEqual(expected);
});
it("unsupported refinements explain limitations without mutation or new structure", async () => {
  await chat("Build a house");
  await chat("Yes");
  const base = scene().objects;
  const result = await chat("Add a balcony");
  expect(result.ok).toBe(false);
  expect(scene().objects).toBe(base);
  expect(useConversationStore.getState().messages.at(-1)?.text).toMatch(
    /not supported/,
  );
  expect(useEditStore.getState().prepared).toBeNull();
});
it("bounds conversation and scene context; new conversation preserves scene", async () => {
  await chat("Build a house");
  await chat("Yes");
  const base = scene().objects;
  for (let i = 0; i < 60; i++) conversationMessage("user", "x".repeat(2000));
  expect(useConversationStore.getState().messages).toHaveLength(40);
  const context = editContext();
  expect(context.conversation).toHaveLength(6);
  expect(context.conversation!.every((m) => m.text.length <= 160)).toBe(true);
  expect(editContextSchema.safeParse(context).success).toBe(true);
  expect(JSON.stringify(context).length).toBeLessThan(8192);
  newConversation();
  expect(scene().objects).toBe(base);
  expect(useConversationStore.getState().target).toBeNull();
});
it("strict structured schema rejects unbounded and nested batches", () => {
  expect(
    editPlanSchema.safeParse({
      version: 1,
      operation: {
        type: "batch",
        operations: Array.from({ length: 5 }, () => ({
          type: "design",
          floors: 2,
        })),
      },
    }).success,
  ).toBe(false);
  expect(
    editPlanSchema.safeParse({
      version: 1,
      operation: { type: "design", floors: 7 },
    }).success,
  ).toBe(false);
});
it("component duplicate confirms exact preview IDs and does not overwrite prior history", async () => {
  await chat("Create a cube");
  await chat("Yes");
  const base = scene().objects;
  await chat("Duplicate it");
  const preview = useEditStore.getState().prepared!.result.objects;
  expect(scene().objects).toBe(base);
  await chat("Yes");
  expect(scene().objects).toEqual(preview);
  expect(scene().past).toHaveLength(2);
  await chat("Undo");
  expect(scene().objects).toEqual(base);
});
it("unsupported stair/window requests do not consume or replace a pending preview", async () => {
  await chat("Build a house");
  const prepared = useGenerationStore.getState().prepared;
  await chat("Add a balcony");
  expect(useGenerationStore.getState().prepared).toBe(prepared);
  expect(scene().objects).toHaveLength(0);
});
it("a rejected batch cannot partially recolor the existing scene", async () => {
  await chat("Build a house");
  await chat("Yes");
  const base = scene().objects;
  await chat("Give it a blue roof and twenty windows");
  expect(useEditStore.getState().status).toBe("error");
  expect(scene().objects).toBe(base);
  expect(scene().past).toHaveLength(1);
});
it("entrance and width refinements preserve door material and structure identity", async () => {
  await chat(
    "Build a two-story house with yellow walls and a purple wooden door and two windows",
  );
  await chat("Yes");
  const group = scene().selectedStructureId;
  await chat("Move the entrance to the left");
  expect(useEditStore.getState().status, useEditStore.getState().message).toBe(
    "preview",
  );
  await chat("Yes");
  expect(structureInfo(scene().objects).template?.doorOffset).toBe(-0.25);
  await chat("Make the house wider");
  expect(useEditStore.getState().status, useEditStore.getState().message).toBe(
    "preview",
  );
  await chat("Yes");
  expect(scene().selectedStructureId).toBe(group);
  expect(
    scene().objects.find((o) => o.construction?.role === "door"),
  ).toMatchObject({ material: "wood", color: "#aa79df" });
});
it("Part wall color changes exactly one component; inspector updates invalidate the preview safely", async () => {
  await chat("Build a house");
  await chat("Yes");
  const wall = scene().objects.find((o) => o.construction?.role === "wall")!;
  scene().setSelectionMode("component");
  scene().select(wall.id);
  const base = scene().objects;
  await chat("Make this wall blue");
  expect(useEditStore.getState().status).toBe("preview");
  expect(scene().objects).toBe(base);
  expect(useEditStore.getState().prepared!.target).toBe("");
  await chat("Yes");
  expect(scene().selectedId).toBe(wall.id);
  expect(scene().selectionMode).toBe("component");
  expect(scene().selectedStructureId).toBeNull();
  expect(
    scene().objects.filter(
      (o, i) => JSON.stringify(o) !== JSON.stringify(base[i]),
    ),
  ).toHaveLength(1);
  expect(scene().objects.find((o) => o.id === wall.id)?.color).toBe("#0000ff");
  expect(scene().objects.find((o) => o.id === wall.id)?.construction).toEqual(
    wall.construction,
  );
  await chat("Make this wall yellow");
  const current = scene().objects;
  useSceneStore.setState({
    objects: current.map((o) =>
      o.id === wall.id ? { ...o, material: "brick" } : o,
    ),
  });
  await chat("Yes");
  expect(useEditStore.getState().message).toMatch(/changed/);
  expect(scene().objects.find((o) => o.id === wall.id)?.material).toBe("brick");
});
it("an explicit all-walls request promotes Part selection to the intended structure only", async () => {
  await chat("Build a house");
  await chat("Yes");
  const wall = scene().objects.find((o) => o.construction?.role === "wall")!;
  scene().setSelectionMode("component");
  scene().select(wall.id);
  const base = scene().objects;
  await chat("Change all the walls to yellow");
  expect(useEditStore.getState().status).toBe("preview");
  expect(scene().objects).toBe(base);
  await chat("Yes");
  expect(
    scene()
      .objects.filter((o) => o.construction?.role === "wall")
      .every((o) => o.color === "#f5d76e"),
  ).toBe(true);
  expect(scene().selectedStructureId).toBe(wall.construction!.structureId);
});
it("ambiguous resize and component reference with Structure selected ask before any proposal", async () => {
  await chat("Build a house");
  await chat("Yes");
  const base = scene().objects;
  await chat("Resize this entire house");
  expect(useEditStore.getState().prepared).toBeNull();
  expect(useConversationStore.getState().messages.at(-1)?.text).toMatch(
    /scale factor|dimensions/,
  );
  await chat("Make this wall blue");
  expect(useEditStore.getState().prepared).toBeNull();
  expect(useConversationStore.getState().messages.at(-1)?.text).toMatch(
    /Choose Part/,
  );
  expect(scene().objects).toBe(base);
});
it("selected window width and door movement never silently move the entire structure", async () => {
  await chat("Build a house with two windows");
  await chat("Yes");
  const window = scene().objects.find(
    (o) => o.construction?.role === "window",
  )!;
  scene().setSelectionMode("component");
  scene().select(window.id);
  const base = scene().objects;
  await chat("Make the selected window wider");
  expect(scene().objects).toBe(base);
  expect(scene().selectionMode).toBe("component");
  if (useEditStore.getState().prepared)
    expect(useEditStore.getState().prepared!.target).toBe("");
  else
    expect(useConversationStore.getState().messages.at(-1)?.text).toMatch(
      /collide|opening/,
    );
  const door = scene().objects.find((o) => o.construction?.role === "door")!;
  scene().select(door.id);
  await chat("Move this door to the right");
  expect(scene().objects).toBe(base);
  expect(scene().selectionMode).toBe("component");
  if (useEditStore.getState().prepared)
    expect(useEditStore.getState().prepared!.target).toBe("");
  else
    expect(useConversationStore.getState().messages.at(-1)?.text).toMatch(
      /collide|opening/,
    );
});
it("assistant primitive creation remains available while a structure or different part is selected", async () => {
  await chat("Build a house");
  await chat("Yes");
  await chat("Create a wall");
  expect(useEditStore.getState().status, useEditStore.getState().message).toBe(
    "preview",
  );
  expect(useEditStore.getState().prepared!.result.parts[0].type).toBe("wall");
});
it("Part and all-wall edits preserve every object in a second structure", async () => {
  await chat("Build a house");
  await chat("Yes");
  const original = scene().selectedStructureId!;
  await chat("Duplicate this building");
  await chat("Yes");
  const other = scene().objects.filter(
    (o) => o.construction?.structureId !== original,
  );
  const wall = scene().objects.find(
    (o) =>
      o.construction?.structureId === original &&
      o.construction.role === "wall",
  )!;
  scene().setSelectionMode("component");
  scene().select(wall.id);
  await chat("Make this wall blue");
  await chat("Yes");
  expect(
    scene().objects.filter((o) => o.construction?.structureId !== original),
  ).toEqual(other);
  await chat("Change all the walls to yellow");
  await chat("Yes");
  expect(
    scene().objects.filter((o) => o.construction?.structureId !== original),
  ).toEqual(other);
});
it("deselection with multiple structures requires clarification before interpreting a vague move", async () => {
  await chat("Build a house");
  await chat("Yes");
  await chat("Duplicate this building");
  await chat("Yes");
  scene().select(null);
  const base = scene().objects;
  await chat("Move the whole house right");
  expect(useEditStore.getState().status).toBe("error");
  expect(useEditStore.getState().message).toMatch(/Which structure|ambiguous/);
  expect(scene().objects).toBe(base);
});
