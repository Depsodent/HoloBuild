# Milestone 10.5 current local handoff — 2026-10-19

Status: the reproduced Ollama response-format failure has a targeted local correction and the exact architectural request passed live streamed preview, confirmation and exact Undo/Redo. **No push/deployment. Physical acceptance remains pending.** This replaces the historical unresolved-stream handoff at 6c8ad09; that original record remains in Git history.

## Preserved checkpoint and work

Started from clean 6c8ad09. All architectural work remains: ce43972 stairs and real destination-slab voids; b8329b7 assembly editing/refinement/shared history; c777733 editable segmented openings; d55428b balcony/access assemblies; 6c8ad09 compact contracts and safe startup/fallback diagnostics. Geometry, mouse/Inspector/gesture controllers and scene-command architecture were not rewritten. No reset, discarded work, new model, credentials, hosted rate-limit change or paid service.

## Completed in this resume

- Reproduced response-schema 422 inside HTTP200 SSE. Provider finish was stop; independent assembly exactly matched the collector. The inner JSON response kind was invalid. No truncation in that diagnostic run.
- Native JSON-object output now handles explicit local Ollama template creation and remembered placement answers. Full runtime schemas and strict canonical geometry/placement/budgets still validate every proposal. Creation cannot return a finish acknowledgement as a successful design. General edits and Gemini keep their prior transport.
- Stream completion preserves safe finish/token metadata and classifies length/incomplete finishes. Fragmented UTF-8, unsafe finish and invalid-usage regressions pass.
- A pending original creation request survives clipped conversation history. Placement replies bypass the starter cube's unrelated Part-role guard; stale conversation alone cannot trigger creation. Cancel/reset clear state; invalid proposals preserve the request for retry. Original features and newly supplied attributes are validated together.
- Saved the actual successful native plan as a sanitized regression fixture. Its rendered cutaway shows connected stairs through a real upper-slab opening and the balcony/access; preview and atomic history remain shared with existing editing.

Details and diagnosis: MILESTONE_105_STREAMING.md. Machine-readable gates and receipts: MILESTONE_105_STREAM_VALIDATION.json.

## Verified results

- 336 unit tests across 35 files; 60 backend tests; TypeScript and ESLint pass.
- Production build passes in 14.13 seconds; 70 package notices, zero unresolved. Existing annotation and chunk-size warnings remain.
- Full serial browser suite: 132 passed, one failed out of 133 in 22.8 minutes. The failure was camera context creation before application code. Both unchanged camera tests passed in isolation (2/2 in 23.5 seconds). After the final clarification safeguard, all 13 affected architecture/conversation browser cases passed in 2.6 minutes. This was not one uninterrupted 133/133 run.
- Exact live request: generate a 2 story house including a balcony and stairs. Streamed creation took 70.404 seconds; first content arrived at 0.995 seconds. Request ce40a98c-75be-4e77-b223-73d93edbf082. Accepted 44 parts: 16 steps, four upper-floor tiles around the void, eight balcony parts and aligned upper access. Inert preview, confirmation, exact Undo/Redo and zero page errors. The unrelated starter cube survives. No geometry repair or substitution.
- Source/history/final-bundle pattern audit: zero unresolved findings. The deliberately fake credential-URL rejection fixture remains documented. Environment files and local artifacts stay ignored; Gemini keys remain server-side.

## Resume and test commands

Run individually from D:\Projects\HoloBuild, with browser/model work serial:

```powershell
npm.cmd run dev:local
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test -- --maxWorkers=1
npm.cmd run test:server
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5175'
npx.cmd playwright test
npm.cmd run build
node scripts/audit-publication.mjs --write
node --env-file-if-exists=.env scripts/check-local-stream.mjs
```

The last command is a portable opt-in metadata-only local model diagnostic. It rejects hosted/Gemini profiles and independently checks assembly/finish/token/schema data; it does not verify rendered geometry. The existing ignored live browser harness is npx.cmd playwright test --config .cache/live-architecture.config.ts. It captures Fetch clones in-page; do not use Playwright/CDP response.text() to diagnose an already-consumed SSE body. The checked-in fixture test is explicitly recorded-response evidence, not a substitute for the successful live receipt.

Frontend: http://127.0.0.1:5175/ . Backend: http://127.0.0.1:5180/api/planner/status . Services run from D:. Inspect the current listener before restarting; do not start duplicate planner/browser/model runs or print environment files.

## Remaining limits and next steps

The small local model can still produce invalid output, redundant clarifications or timeouts under load. Review proposed placement/defaults; reject invalid candidates without repair. Other arbitrary live follow-up edits and hosted Gemini were not retested here. Straight/quarter-turn stairs, static door panels and visual balcony rails retain their existing animation/engineering/regulatory limitations.

Owner acceptance next: submit the exact request in Auto/LLM; inspect both floors, staircase void and balcony access; confirm, Undo and Redo; then use mouse/Inspector and one-/two-hand controls on a selected assembly and the whole structure. Physical webcam/microphone/friend-device results must be reported by actual testing. If generation fails, retain the safe request ID/category/timings and run the local diagnostic. Do not expose raw credentials/provider content, start Milestone11, push or deploy without approval.

Final-source metadata-only diagnostic also passed: normal stop, exact assembly, 1,507 prompt + 299 completion = 1,806 tokens; native creation with two floors, one staircase and one balcony; 31.862 seconds total after a cold model (first content at 9.010 seconds). Request b2b2d79a-c0f8-4d22-ab45-563c51e7575b. This is a second real backend response/schema check, not a second rendered-browser or physical-webcam test.


## Current release update — 2026-10-20

The owner approved routine test/commit/push/deploy/verify without separate publication prompts. Historical approval restrictions above no longer block this routine release. Production-compatible Gemini creation/editing and architectural UI history/persistence now pass after a bounded transport correction; see DEVELOPMENT.md and MILESTONE_105_RELEASE_VALIDATION.json. The public deployment and smoke results remain a separate gate; retain the previous working deployment until verified. No quota, credential, paid-service or gesture changes.


## Published result

Milestone10.5 source 1baa4fa is live at https://holobuild.vercel.app, deployment dpl_2BqHrrBYnkxBX75FiBU4zQwmrzCA. Real hosted architectural generation, same-structure conversational editing, Part opening editing, cancellation, save/load and exact history pass. Security, source/asset matching, logs and lease cleanup pass; see MILESTONE_105_PRODUCTION_VALIDATION.json. Prior working deployment dpl_7yvDqSdmQAt6m91SC8gXTdCitRmF is retained. Runtime source is unchanged by this documentation receipt.

Next: physical acceptance only; no Milestone11. In LLM mode submit the exact two-story house/stairs/balcony prompt; inspect both floors, stair opening and balcony doorway, confirm, change a stair material, resize a selected opening, Undo/Redo and save/load. Then test one-hand grab/move/release, two-hand scale/rotation, camera minimization/Stop, microphone and friend-laptop typed workflow. Report safe request reference, category, HTTP/SSE result and timings on failure. Keep credentials and raw private content out of reports. Standing routine-release authorization is recorded in DEPLOYMENT.md.
