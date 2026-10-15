# AI-assisted structure generation — Milestone 9

HoloBuild remains usable without a backend, model installation or paid API. Open **Construction Tools → Voice & AI Commands → AI Structure Generator**. The default is **Offline**, explicitly labeled as a deterministic template, not an LLM. Generate a plan, inspect its source/warnings/components/measurements and ghost, optionally **Fit structure in view**, then **Confirm construction**. Nothing enters the scene/history before confirmation. Cancel removes the uncommitted preview; it never deletes a confirmed structure. Undo once removes a whole confirmed batch; Redo restores the same IDs.

## Modes and input routing

- **Offline:** free local TypeScript templates, with no provider request or backend requirement.
- **LLM:** optional backend-only OpenAI-compatible Chat Completions adapter. Missing configuration, service errors or invalid output stop planning without changing the scene.
- **Auto:** attempts the LLM adapter; failures (including invalid geometry) produce an explicitly labeled **Offline fallback** for supported template requests. Explicit cancellation does not fall back. Unsupported offline requests fail rather than substitute an unrelated structure.

Existing quick text commands and final speech results share one router. Valid Milestone 8 grammar remains deterministic. Explicit `Build …`, `Generate …` and `Create … <house/room/tower/warehouse/bridge/shed/office/building/structure>` requests enter planning. Other ambiguous phrases ask for clarification. There is no auto-confirmation from speech, no new speech-recognition implementation and no generic DOM clicking. Duplicate final-result indices retain the Milestone 8 guard. A pending destructive quick command must be resolved before structure planning. The full 1200-character prompt field supports longer requests than the 240-character Quick Commands input.

Closing the overall Voice & AI Commands group/sidebar aborts unconfirmed work; reopening never submits a prompt. Changing generator inputs/settings cancels the previous preview so it cannot be confirmed under a different request. If scene objects change after preview, Confirm is disabled and Regenerate is required. Selection alone does not relocate the plan; active object previews block confirmation. The main scene is appended to, never replaced by an AI plan.

## Offline structures and defaults

| Template | Result |
| --- | --- |
| House | Floor slabs, four segmented walls per level, ground-floor door and flat roof; windows when requested |
| Room | Floor, four walls, open doorway; no roof by default |
| Tower | Five levels by default, floor slabs, walls and flat roof |
| Warehouse | Single level, walls/door, satin-metal flat roof |
| Bridge | Raised deck and four grounded cylinder pillars |
| Garden shed | Single level, wooden walls/door and flat roof |
| Office | Extra template: three levels by default, glass walls and floor slabs |

Examples: `Build a small house with four walls and a roof`, `Create a modern two-story house with windows`, `Generate a room with a floor, four walls, and a doorway`, `Build a tower with five levels`, `Create a warehouse with a metal roof`, `Generate a bridge supported by pillars`, `Build a garden shed with wooden walls`.

Offline parameters expand below the generator. Blank controls use prompt/default values; explicit controls override the corresponding text and add a warning. Width defaults to 6 m (bridge/warehouse 10 m), depth 6 m (bridge 3 m), storey/pillar height 3 m, slab thickness 0.2 m and wall thickness 0.2 m. Width supports 3–20 m, depth 2–20 m, height 2.5–5 m, wall thickness 0.1–0.4 m. Houses/towers/offices support 1–6 floors; room/warehouse/shed/bridge are single-level templates. Prompt forms include `width 8`, `8 meters wide`, `depth 6`, `height 3`, `five levels`, `two-story`, `floors 2`, counts before/after door/window, and existing wall material names. Dimensions in prompts are metres; use the controls for exact values.

Door count is 0–2 on the ground storey; windows are 0–4 **per storey**, split across front/back. Generic “with windows” means two per storey; “no windows” and “without doors” suppress openings. Generic houses/rooms/sheds/warehouses have one doorway; tower/office defaults have none. Doorways are actual wall openings; room/explicit doorway requests leave them empty, while normal house doors use a simple closed wooden panel. Glass panels fit segmented window openings. Narrow or overlapping opening layouts fail clearly rather than shrink requested openings silently. The Wall / deck material control applies to a bridge's deck; its pillars remain concrete, with a warning for other requested surfaces. Bridge wall/opening/roof parameters are explicitly reported as unsupported.

Roof choices are flat/none; `no roof`/`without a roof` works. Requested gable/pitched roofs produce an explicit warning that flat/none is substituted. Separate wall/roof material phrases such as `brick walls and a metal roof` are supported. Unsupported detail words are reported, but this is bounded pattern matching, not full natural-language understanding. No stairs/interior layout, hinges, animated doors, plumbing, terrain, engineering analysis or building-code assessment is included. Review every plan; contact checks establish visual connectivity, not physical safety.

## Optional local LLM setup — Windows

No real model was installed, downloaded or contacted during this implementation. The HTTP adapter was tested with mock provider responses. Actual model quality, available context length and hardware speed require your local acceptance test.

1. Keep HoloBuild's existing Vite server running at **http://127.0.0.1:5175/**. Use a separately installed/loaded local model server if you want LLM mode; Offline needs none. For **Ollama**, use an already installed model ID shown by `ollama list` and its compatible base URL `http://127.0.0.1:11434/v1`. For **LM Studio**, load an already downloaded model and start its local server in the Developer tab; a typical base URL is `http://127.0.0.1:1234/v1`. Follow the provider's current official setup documentation; HoloBuild does not install or pull models. [Ollama compatibility](https://github.com/ollama/ollama/blob/main/docs/api/openai-compatibility.mdx), [LM Studio server](https://lmstudio.ai/docs/developer/core/server), [LM Studio compatible endpoints](https://lmstudio.ai/docs/developer/openai-compat).
2. In the HoloBuild directory, copy `.env.example` to `.env` **only if you do not already have an `.env`**. Edit its backend values:

   ```dotenv
   PLANNER_PORT=5180
   LLM_BASE_URL=http://127.0.0.1:11434/v1
   LLM_MODEL=replace-with-your-already-installed-model-id
   LLM_API_KEY=
   LLM_TIMEOUT_MS=30000
   LLM_JSON_MODE=true
   LLM_ALLOW_REMOTE=false
   APP_ORIGINS=http://127.0.0.1:5175,http://127.0.0.1:5173
   ```

   Replace the model placeholder with the exact identifier. LM Studio uses its loaded model's reported ID. `LLM_MODELS` optionally supplies a comma-separated allowlist of at most eight model IDs, overriding `LLM_MODEL`. Keep port 5180 to match the Vite proxy; if you deliberately change the backend port, also change the two proxy targets in `vite.config.ts` and restart Vite. Add your exact frontend origin to APP_ORIGINS if using another port/hostname. Keys must never use a `VITE_` prefix.
3. Start/restart the optional backend in a second terminal:

   ```powershell
   npm.cmd run planner
   ```

   Node 22.12+ / 24 is supported; it uses built-in HTTP/fetch/env-file support and existing Zod, with no additional package installation. It binds only **127.0.0.1:5180**. Missing `.env` is harmless: service starts unconfigured and Offline still works. Restart this process after editing `.env`. The service is running in the delivered session without a configured model.
4. Expand **AI Settings → Check model connection**. It reads safe backend settings and checks `/models`; it never generates/downloads a model. Select a configured allowlisted model, choose a timeout within the backend cap, then select **LLM** and Generate Plan. Confirm only after reviewing a validated preview. The default timeout is 30 seconds, configurable from 1–120 seconds. Some local models need a larger cap or a smaller request. A reachable service whose configured ID is not listed reports that distinction.
5. The adapter posts non-streaming `/chat/completions` with system schema/instructions, user prompt, temperature 0.2, maximum 10,000 output tokens and JSON-object response format. If your compatible provider does not support `response_format`, set `LLM_JSON_MODE=false` and restart; returned JSON still undergoes strict validation. A provider may support this protocol but a small model may still fail to produce an aligned structure. Errors do not bypass validation; retry a simpler prompt or choose Offline.

Optional hosted-compatible providers require an explicitly configured HTTPS base URL, `LLM_ALLOW_REMOTE=true`, backend-only `LLM_API_KEY` if required, and the exact configured model ID. No hosted provider/account was configured or tested and no paid call is required. Such a provider receives the prompt; browser speech may separately transmit audio to its recognition provider. The system does not guarantee hosted generation or speech is private/offline.

## Plan, validation and command architecture

`shared/planSchema.mjs` is the same strict Zod representation imported by Node and the browser, with a TypeScript declaration. A version-1 plan has `name`, `units:"meters"`, `objects`, `contacts` and `warnings`. Parts have a unique ASCII ID, meaningful name, role, existing primitive type/material, hex color, **physical dimensions in metres**, center position and Euler rotation in radians. These are not scene scale values. `materializePlan` divides dimensions by the actual factory base dimensions (wall 3×2×0.25; floor 4×0.2×4; others 1×1×1), then validates the normal SceneObject schema.

Limits: 120 new parts, 200 total scene objects, 1200-character prompt, 128 KiB model-plan text, 256 KiB provider HTTP response, 8 KiB inbound request, per-part dimensions 0.05–30 m subject to actual scale limits 0.1–20, local X/Z centers ±30 m, Y center 0–40 m, Euler components ±π and whole bounds 32×40×32 m. Final placement must respect the editor's ±50 m workspace and ground. Unknown fields/types/materials/assets, duplicate IDs, malformed/nonfinite values, missing contact references, disconnected/floating parts and excessive overlaps fail without mutation. Only raw JSON or a single complete JSON code fence is parsed; no code/tools/browser/file actions are executed.

The engine builds transformed primitive bounds once per validation. Parts must connect to a grounded assembly. Face contact/numeric tolerances are accepted; deeper overlaps require an explicit contact pair and are limited to at most 0.08 m penetration on the thinnest overlap axis and 25% of the smaller component's bounding volume. Deep/duplicate panels remain invalid. Tests cover invalid relationships and exact default alignment. Checks use conservative world AABBs, including for curved/rotated primitives, so some genuinely nonintersecting designs can be rejected. Offline templates deliberately use orthogonal, touching components with empty explicit-contact lists.

`preparePlan` chooses one deterministic free horizontal offset against existing objects without changing internal dimensions or independently snapping pieces. This avoids creating gaps at architectural joints when the user's grid is enabled. The exact origin is shown before confirmation. Individual editing afterward retains normal grid snapping. The ghost shares six low-resolution primitive geometries and one material, has no picking targets/shadows and never enters scene/history. Fit is explicit camera navigation only. Large/tall structures can still be affected by the established fog/scene limits.

`execute({type:"construct",objects,contacts})` revalidates the complete batch before one append/store/history update. It does not call create once per component or replace the scene. UUIDs are allocated once for the prepared preview, then retained through confirmation/Undo/Redo. The first generated component becomes selected. Existing mouse, one/two-hand gestures, material edits, duplicate/delete and imported assets use their normal controllers. Scene edits invalidate prepared placement instead of silently relocating it on Confirm.

Scene version 1 adds optional `construction:{structureId,partId,role}` metadata. Save/Load preserves every component, material and identity through the existing portable export/local metadata flow. Old version-1 projects remain readable. This is descriptive grouping, not a rigid parent/group-transform or physics hierarchy. Individual parts remain editable/deletable; duplicating a part assigns a new part ID. Generation-time `contacts`, prompts, credentials, endpoint URLs, model settings and preview data are not exported. Existing imported assets are retained; model/URL imports cannot be requested by LLM plans.

## Backend and performance boundaries

The backend is a small local Node service rather than a second Python toolchain, sharing the exact Zod schema and existing dependency/runtime. It checks loopback Host/origin, uses no CORS wildcard, accepts JSON only, limits two concurrent operations and ten requests/minute, refuses client-supplied endpoints/models outside configuration, rejects redirects and redacts errors. Remote endpoints require explicit HTTPS opt-in; credentials/query strings embedded in endpoint URLs are forbidden. It has no filesystem/tool/shell/model-download endpoints. Keep it local; this is not a deployed multi-user authentication service.

Cancel/timeout abort the HTTP request and discard late results through a generation token. A provider may finish its own computation after disconnect, but the app cannot apply that result. Model output is schema-validated on the backend and schema/geometry/placement-validated in the browser and command manager. Offline fallback is never mislabeled LLM.

Generation is bounded and commits once. No per-frame plan parsing/validation or high-frequency React subscription was added. A pending ghost reuses geometry/material resources and disposes on scene teardown; committed parts retain ordinary independent render/selection/history behavior. Instancing is not introduced at the cost of those features. Many surfaces/shadows, glass transmission, software WebGL and CPU MediaPipe can still reduce frame rate. Synthetic tracking on a generated five-level tower is regression coverage, not a physical FPS/latency claim. Review diagnostics on the laptop with your representative scene.

Validation commands: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run test:server`, `npm.cmd run build`, and serial `npm.cmd run test:e2e`. Provider tests use HTTP mocks, not paid calls or installed models. See DEVELOPMENT.md for final results and MANUAL_TESTS.md for combined Milestone 8 + 9 acceptance. No Milestone 10, push or deployment was started.
