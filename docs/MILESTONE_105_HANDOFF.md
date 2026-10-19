# Milestone10.5 local handoff — 2026-10-19

Status: architectural work preserved; compact Ollama context fix and focused validation complete. **Live streamed generation is not reliable yet. Not a public release approval. No push/deployment.**

## Checkpoint provenance

Before this resume, HEAD was d55428b and compact-contract/integration fixes were uncommitted. Preserved all changes. Earlier local architectural checkpoints: ce43972 (stairs geometry), b8329b7 (stairs editing/draft refinement), c777733 (editable openings), d55428b (balcony assemblies/access). The final handoff commit containing this file preserves the subsequent fixes. Production/GitHub application remains8f833f6; no publication occurred.

## Completed work

- Straight parametric stairs use ordinary shapes and shared structure commands, with exact adjacent-floor rise and real destination-slab openings; movement/resizing/materials/removal preserve hierarchy and atomic history.
- Door/window recipes rebuild segmented facades; individual opening editing, per-floor counts, appearance, mouse/gesture previews and IO remain supported. Window-count edits now retain existing holes and choose free facade positions without overwriting balcony access.
- Balcony slabs/rails/posts attach at upper-floor elevations with aligned real access doorways. Owned access removal and pre-existing access preservation are separate. Invalid geometry remains rejected.
- Selected architectural Part operations cannot hide unrelated recipe changes in a model design payload. Appearance batches retain Part selection. Fake architectural geometry without a matching recipe is rejected.
- The immediate local empty HTTP500 was reproduced as Vite proxy failure with no planner listening on5180. Added a JSON503 with safe diagnostic ID and actionable startup guidance. `npm run dev:local` starts/reuses both loopback services. `npm run dev:gemini` explicitly selects the existing Gemini profile when starting a new backend; it does not switch a running backend.
- Configured local provider remains Ollama qwen3:4b-instruct. Its runner rejected the old prompt:9787tokens exceeded4096context. Compact contracts remove duplicated full JSON schemas/examples from model instructions; runtime Zod schemas, geometry checks, decoder projection, quotas and security remain strict. The final native diagnostic prompt was5544characters before two small equivalent safety-wording restorations.
- Only missing proposal prose gets a neutral review-message default. Geometry/design fields are never filled in or repaired. Clarification/explanation text remains required.
- Offline no longer silently drops requested stairs/balconies. Guidance distinguishes basic templates/explicit refinements from complex natural-language requests. Local logs report safe category/phase/request IDs, without prompts/provider bodies/secrets.

## Validation and honest limits

-66focused unit tests/6files pass: architecture, balconies, openings, planner, planner transport, semantic assistant.
-53backend tests pass, including context-error classification, compact-prompt bounds, strict proposal data, existing hosted protections and rate limits.
-TypeScript and ESLint pass. Production build passes31.47s,70notices/0unresolved; existing chunk/annotation warnings remain.
-Actual exact request: `generate a 2 story house including a balcony and stairs` produced HTTP200 via the real local compatible backend, request54f0574c-f081-4862-881f-7bbe970dcec3, total29.698s. The unchanged compiler accepted its actual recipe:44parts,2floors,16steps,4upper-floor tiles around the real void,8balcony parts and aligned upper-entry access. No model geometry was repaired.
-Recorded-response browser check using that real response passed1/1 in9.7s. Confirmed inert preview, rendered canvas, confirmation, exact Undo/Redo and no page errors; screenshot inspected. This is a **recorded-response** check, not a claim that live SSE passed.
-The original live test used Playwright response.text() after streaming and failed Network.getResponseBody. Its page snapshot also exposed an actual rejected overlapping-opening design. Corrected the ignored harness to consume a cloned Fetch response in-page.
-The corrected **live SSE** run still failed: HTTP transport200 carried event:error,status422,kind:response-schema, request9c2eb8ee-8f71-48e4-8c18-6b944c5491a1. No geometry was applied. Earlier native attempts also returned invalid encoded JSON or planning fields. Do not describe generation as reliably fixed.
-Full132-case browser suite was interrupted for genuine integration fixes; it was not rerun to completion. Earlier broad architectural/structure/generation gates and5architectural cases have passing evidence. One interrupted run had a browser-context setup timeout in the synthetic-camera test; this is not a confirmed application regression.
-No physical webcam/microphone/friend-device acceptance, fresh hosted Gemini test, paid service, credential or quota change. Straight/quarter-turn stairs and visual balcony guards are not engineering or building-regulation certification; hinges/curved stairs remain unsupported.

## Resume commands (PowerShell, from D:\Projects\HoloBuild)

```powershell
npm.cmd run dev:local
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test -- tests/unit/balconies.test.ts tests/unit/openings.test.ts tests/unit/architecture.test.ts tests/unit/planner.test.ts tests/unit/plannerTransport.test.ts tests/unit/semanticAssistant.test.ts --maxWorkers=1
npm.cmd run test:server
npm.cmd run build
```

Existing ignored local diagnostics are preserved (not portable Git fixtures):

```powershell
node .cache/diagnose-local-model.mjs
npx.cmd playwright test --config .cache/live-architecture.config.ts
npx.cmd playwright test --config .cache/recorded-native.config.ts
```

The first command makes one real local-model call with an isolated loopback backend and logs only field paths/sizes/safe messages. The second is the corrected live-stream harness and is **currently expected to expose the unresolved model response failure**. The third replays the successful actual native response, making no model call. Keep them serial; do not run multiple browser or model tests concurrently.

Primary receipts: `.cache/milestone105-native-compact-final.log`, `.cache/milestone105-real-geometry.json`, `.cache/architecture-local-native-diagnostic.json`, `.cache/milestone105-live-browser-final.log`, `.cache/milestone105-native-render.log`, `.cache/milestone105-resume-unit.log`, `.cache/milestone105-backend-verified.log`, `.cache/milestone105-resume-build.log`. Ignored caches may be removed independently; archive sanitized fixtures before cleanup if needed.

## Exact next work

1. Diagnose streamed Ollama output independently of Playwright/CDP: record sanitized finish_reason/token counts/schema issue paths; determine truncation vs invalid inner encoded JSON vs model variability. collectCompletion currently does not expose compatible finish_reason metadata. Do not print raw user/provider content or secrets.
2. Retain the successful strict native recipe as a sanitized fixture if extending regressions. Do not repair invalid geometry, invent acknowledgements, disable safeguards or raise hosted quotas to pass.
3. Verify clarification-first behavior for ambiguous placement, then a valid live streamed preview, confirmation, cancellation, exact Undo/Redo and follow-up Part/Structure editing.
4. Run focused regressions for fixes; complete the broader browser suite when appropriate. Physical acceptance and release approval follow separately. No Milestone11 or publication without approval.

Frontend: http://127.0.0.1:5175/ . Backend status: http://127.0.0.1:5180/api/planner/status . At handoff the services run independently; restart with the combined launcher after stopping old instances if necessary. Keys remain in ignored backend environment files; never copy them into frontend variables or logs.
