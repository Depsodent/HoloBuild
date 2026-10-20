# Milestone 11 — release handoff

Status: implemented, validated, pushed and deployed. Physical acceptance is pending. Do not begin Milestone 12 without instructions.

## Checkpoints and services
- Recovery implementation: f8486997ffb1146c71147d4db96b22168f7ce82e.
- Deployed source: d49952e697463c908c5925f1e353dba5093a3969, master, Depsodent/HoloBuild.
- Production: https://holobuild.vercel.app, deployment dpl_ENkGDZHgqYubXaakkSfWWFZCJTWp.
- Rollback remains READY: dpl_2BqHrrBYnkxBX75FiBU4zQwmrzCA, source 1baa4fa0c0035d3113c32f9abb0cd89c8ea4c2b7. Never delete it as routine cleanup.
- Local project: D:\Projects\HoloBuild. Frontend http://127.0.0.1:5175, planner http://127.0.0.1:5180, isolated production-build Gemini test server http://127.0.0.1:5182. Verify listeners before restarting; preserve ignored environments/auth files.
- Final post-deployment receipt commits change documentation only; they do not require another runtime deployment.

## Delivered
Materials / AI Edit / Advanced share existing commands, selection and conversation. Optical values, custom colors, exact numeric transforms/dimensions, cm/mm previews, configurable grid, floor/box alignment, optional measurements and throttled transient guides preserve history and portable IO. Escape/blur cancels mouse transforms. Connected geometry cannot be broken through loose transforms.

Stairs and Balcony cards live in the existing shape palette. Explicit host/floor and parameters use native recipes, strict geometry validation and shared preview/confirmation. Stairs produce real steps and floor holes; balconies retain real access. Selection, appearance, safe duplication, assembly deletion, save/load and atomic Undo/Redo are tested. No separate manual/AI/gesture scene system.

The precision parser leaves descriptive metallic wording to the existing semantic edit path. Explicit precision commands retain validation, context and inert previews.

## Evidence
- 365 unit tests / 37 files; 64 backend tests; TypeScript and ESLint pass.
- Full 139-case serial browser run: 133 passed, six obsolete Inspector navigation/selector assertions failed. Corrected all six and reran: six passed. All 139 distinct cases have passing evidence; no unresolved failure. Model tests now assert committed numeric transforms. No runtime changes followed the full run.
- Local production build: 24.25 s. Vercel build: 8.67 s. 70 notices, zero unresolved. Existing annotation/large-bundle warnings remain.
- Live local and public Gemini exact stairs/balcony creation, same-house editing, openings, Inspector controls, manual library insertion/duplication/deletion, save/load and exact Undo/Redo pass with zero page errors.
- Public generation: 52 parts, 16 steps, real floor opening, eight balcony parts and aligned access. 1.999 s total, 0.629 s first content; follow-up edit 1.446 s.
- Exact metallic-top public request initially failed strict model-schema validation (logical 422 in HTTP200 SSE); nothing was applied. Retry passed roof-only metallic changes and exact history. Local supplementary harness initially expected the wrong /edit envelope; corrected without changing application validation.
- Public HTTPS, headers, CORS denials, private paths, known-secret absence, five exact JS hashes, WASM MIME and notices pass. Logs: nine HTTP200, three expected origin403, one model-schema warning, zero HTTP5xx or unexpected runtime errors. Redis active leases zero.
- Protected production-only variable metadata unchanged; Vercel Hobby; same 5/IP/min, 100 admitted generations/UTCday and two concurrent safeguards. No paid services, credential or quota changes.

Tracked receipts: MILESTONE_11_RELEASE_VALIDATION.json, MILESTONE_11_PRODUCTION_VALIDATION.json and PUBLICATION_AUDIT.json. Ignored detailed logs/screenshots are .cache/m11-*; raw logs/env/auth must never be published.

## Limits and acceptance
Stairs require a compatible multi-floor host and one void per destination floor. Rise follows storey elevations. Duplication requires a free adjacent-floor connection; balcony duplication uses the opposite facade and rejects invalid access/intersections. Freestanding stairs, arbitrary disconnected vertical transforms and non-quarter staircase yaw are unsupported. Box-edge alignment is axis-aligned; rotated structure dimension edits use scale. Doors are static. Visual dimensions provide no engineering/regulatory certification.

Model outputs/latency remain variable; strict rejection and diagnostic retry remain intentional. Physical webcam, microphone and friend-laptop testing has not been performed by this agent. Ask the user to test Inspector tabs and numeric edits; insert/configure stairs and balcony on a compatible multi-floor host; confirm/cancel/Undo/Redo and save/load; then point/pinch/move/release and two-hand transforms with the camera, keeping Stop accessible.

## Relevant commands
Run from D:\Projects\HoloBuild. Use separate permitted commands when required. Never run concurrent browser suites.
- npm.cmd run typecheck
- npm.cmd run lint
- npm.cmd test -- --maxWorkers=1
- npm.cmd run test:server
- npm.cmd run build
- $env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5175'; npx.cmd playwright test
- node scripts/audit-publication.mjs --write
- Opt-in live smoke: HOLO_LIVE_GEMINI=1, HOLO_PRECISION_SMOKE=1, HOLO_LIBRARY_SMOKE=1, HOLO_SOURCE_SHA=<tested source>, HOLO_RELEASE_URL=<local5182 or public>; node scripts/smoke-milestone105.mjs. This consumes real free-tier requests; do not repeat without a relevant change.

Routine validated commit/push/deploy remains authorized; paid services, quota increases, production deletion and major infrastructure changes still require permission. Preserve all completed work.
