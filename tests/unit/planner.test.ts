import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { generatePlan, routeInput } from "../../src/generation/planner";
import { offlinePlan } from "../../src/generation/offline";
import {
  planStructure,
  cancelGeneration,
  cancelUnconfirmedGeneration,
  confirmStructure,
  useGenerationStore,
} from "../../src/generation/generationStore";
import { useSceneStore } from "../../src/scene/sceneStore";
import { execute, undo, redo } from "../../src/scene/commandManager";
beforeEach(() => {
  cancelGeneration();
  useSceneStore.setState({
    objects: [],
    past: [],
    future: [],
    selectedId: null,
    preview: null,
  });
  useGenerationStore.setState({
    mode: "offline",
    options: {},
    model: "",
    timeoutMs: 30000,
  });
});
afterEach(() => vi.unstubAllGlobals());
it("closing tools after a confirmed build preserves its completion feedback", async () => {
  await planStructure("house");
  confirmStructure();
  const message = useGenerationStore.getState().message;
  cancelUnconfirmedGeneration();
  expect(useGenerationStore.getState().status).toBe("complete");
  expect(useGenerationStore.getState().message).toBe(message);
});
it.each([
  "create a cube",
  "make it red",
  "move it right 2",
  "undo",
  "save the scene",
])("quick routing remains deterministic: %s", (text) =>
  expect(routeInput(text)).toBe("quick"),
);
it.each([
  "build a house",
  "generate a bridge",
  "create a modern two-story house with windows",
])("explicit structure routing: %s", (text) =>
  expect(routeInput(text)).toBe("structure"),
);
it.each(["make it bigger", "perhaps a house", "do something"])(
  "ambiguous routing requests clarification: %s",
  (text) => expect(routeInput(text)).toBe("clarify"),
);
it("offline needs no fetch and Auto labels fallback without impersonating LLM", async () => {
  const fetch = vi.fn().mockRejectedValue(Error("Backend unavailable"));
  vi.stubGlobal("fetch", fetch);
  expect((await generatePlan("house", "offline")).source).toBe("offline");
  expect(fetch).not.toHaveBeenCalled();
  const fallback = await generatePlan("build a house", "auto");
  expect(fallback.notice).toContain("Offline fallback");
  expect(fallback.source).toBe("offline");
  await expect(generatePlan("house", "llm")).rejects.toThrow(
    "Backend unavailable",
  );
});
it("LLM output requires strict schema and geometry; no fallback on explicit cancellation", async () => {
  const valid = offlinePlan("house");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ source: "llm", model: "test", plan: valid }),
        ),
      ),
  );
  expect((await generatePlan("house", "llm")).source).toBe("llm");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ source: "llm", plan: { ...valid, script: "evil" } }),
        ),
      ),
  );
  await expect(generatePlan("house", "llm")).rejects.toThrow();
  const abort = new AbortController();
  abort.abort();
  await expect(
    generatePlan("house", "auto", {}, {}, abort.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
});
it("planning/cancellation leaves scene/history untouched; late LLM results cannot reappear", async () => {
  let finish: (r: Response) => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    ),
  );
  useGenerationStore.setState({ mode: "llm" });
  const pending = planStructure("house");
  cancelGeneration();
  finish(
    new Response(JSON.stringify({ source: "llm", plan: offlinePlan("house") })),
  );
  await pending;
  expect(useGenerationStore.getState().prepared).toBeNull();
  expect(useSceneStore.getState().objects).toEqual([]);
  expect(useSceneStore.getState().past).toHaveLength(0);
});
it("confirm validates scene version, then a fresh preview commits one stable batch", async () => {
  await planStructure("house");
  expect(useGenerationStore.getState().prepared).not.toBeNull();
  execute({ type: "create" });
  confirmStructure();
  expect(useSceneStore.getState().objects).toHaveLength(1);
  expect(useGenerationStore.getState().message).toContain("Scene changed");
  await planStructure("house");
  const ids = useGenerationStore.getState().prepared!.objects.map((o) => o.id);
  confirmStructure();
  expect(useSceneStore.getState().past).toHaveLength(2);
  undo();
  expect(useSceneStore.getState().objects).toHaveLength(1);
  redo();
  expect(
    useSceneStore
      .getState()
      .objects.slice(1)
      .map((o) => o.id),
  ).toEqual(ids);
});
