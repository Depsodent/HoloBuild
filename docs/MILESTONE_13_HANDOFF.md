# Milestone 13 completed handoff

Project: D:\Projects\HoloBuild. Public application: https://holobuild.vercel.app. GitHub: https://github.com/Depsodent/HoloBuild.

## Published checkpoints

Implementation: 4db5354. Regression fixtures: 5dbb6a6. Published source: **2d90378a9e90e8b848e1b4848cc8697b4a508bac**, deployment **dpl_4kLa2xBZ2ADGTLxYq18H8ZSuMf6Z**, READY and assigned to the public alias. All seven served JavaScript files match the audited local bundle. Final receipt/test-only work leaves runtime assets and backend unchanged; its checkpoint is the commit containing this document. Previous M12 deployment **dpl_4498oLZWjGa9tHyXbTsYY1C1njzs** (source 40cd7a6) remains READY for rollback. No paid service, credential, quota or infrastructure changes.

## Delivered

Removed separate Presentation Mode, named views, saved-view UI/preferences and obsolete controls. Only holobuild.exploration.v1 is retired; projects and workspace persistence remain intact. Walkthrough has exactly **Look Around | Exit Walkthrough | Reset Position | Controls**. Secondary keyboard/touch fallback stays inside help; global Stop Camera remains reachable. Mouse-lock state reflects the real browser; denied/released lock is recoverable. Initial safe feet/orientation, editor camera/layout/context and scene/history are preserved across reset and exit. Existing body/collision math is unchanged, including native door portals, connected stair voids, slabs, balconies and conservative imported/curved bounds. Existing Inspector and AI tabs, mouse/gesture controls, mic generation guards and typed fallback remain.

Bounded optimization scopes idle object listeners to the selected active gizmo, uses derived selectors, attaches walking listeners only during walking, reuses Euler state and throttles changed position feedback. Collision worlds build lazily by immutable object-array identity and clear on exit; door visibility invalidates shadows. Stable React/Three core chunks complement existing lazy GLTF/vision/worker loading. No speculative tracking or speech rewrite, provider/schema, serialization or safety changes.

## Validation

- **395 unit tests / 39 files; 66 backend tests; referenced TypeScript, ESLint and production build pass.** Local frontend build 11.99 s; remote frontend 15.46 s, total remote build 37 s. 70 package notices, zero unresolved; production dependency audit zero vulnerabilities. Existing annotation/large-chunk warnings remain.
- Full serial browser run: **147 pass / 3 fail of 150**, 26.1 min. One context-creation timeout occurred before app code; two old speech fixtures injected errors before async recognizers existed. Fixtures now wait for actual Listening. All **16 affected tests pass** in 2.3 min. All 150 distinct cases have passing evidence, not one uninterrupted full green run. Runtime did not change after the broad run.
- Local real Gemini production-build creation/edit: 8.594 / 6.594 s, first content 7.405 / 6.381 s. 44-part house, 16 steps, real void and aligned balcony. Entire rendered navigation, four controls, exact editor canvas restoration, native edits, preview/cancel/confirm, save/load and history pass with zero page errors.
- Public real Gemini creation/edit: **9.669 / 12.310 s**, first content **8.213 / 11.724 s**. 52-part house, 16 steps, real void, eight balcony parts and aligned access. Conversation, opening/material/precision edits, inert previews, confirmation/cancellation, unrelated preservation, JSON and exact history pass.
- First combined public smoke stopped during navigation because its coarse poll overshot lateral alignment by 0.48 m. The solver correctly blocked the body at the slab. New recorded-template unit regression proves centered ascent and offset rejection. Test helper now uses frame-sized key pulses/fresh telemetry. Reloading the **same actual generated scene** through public JSON UI passes door → stairs → upper floor → balcony → return, mouse lock/Escape, four controls, reset, exact pre/post editor canvas/layout, manual/generated wall openings, 270-degree standalone stairs, inherited appearance, save/load and exact Undo/Redo with zero page errors and **zero additional provider calls**. The original failed receipt is preserved, not converted into a fictional single-run success.
- Production microphone lifecycle passes with **synthetic recognition**, no provider calls: late permission completion during/after walking is ignored, deliberate restart works and Stop preserves actual final events. This is not physical microphone acceptance.
- HTTPS/headers, exact-origin/CORS denials, private paths 404, known-secret absence, asset hashes, WASM MIME and licenses pass. First model-asset transfer hit 15 s timeout; identical retry passed without changing settings. Root cause of transfer timeout is not independently established. Source/history/bundle audit has zero unresolved findings; intentional reserved-domain rejection fixture remains documented. Read-only Redis active leases = 0. Safe Vercel log observations contain no 5xx or unexpected runtime errors; expected 403 probes are recorded, and HTTP200 stream terminal results are separately checked.

## Measurements and limits

Matched 100-cube software-renderer observation: window keydown listeners **104 → 3**, blur **102 → 1**; five exits return to baseline. Restored buffers/textures **20/7** before and after. Editor-only collision builds 0, five visits 5. Main entry gzip **474,529 → 220,919 bytes**, plus **250,632 bytes** stable core vendors; total initial entry+vendors **471,551 bytes** is only slightly lower. Actual vendor ETag revalidation returns 304 with existing max-age=0,must-revalidate. No zero-network, cold-start or general laptop FPS claim. See PERFORMANCE.md and raw docs/benchmarks receipts.

Physical webcam, microphone, touch and friend-laptop acceptance remain **pending**. M4 historical webcam acceptance is not fresh device evidence. Native browser API support/permissions vary. Conservative navigation bounds, static door portals, standalone support/connection limits, stochastic model output and free-tier quotas remain documented. No structural/building-code certification or fabricated user study.

## Services and acceptance

Development frontend: http://127.0.0.1:5175. Existing local planner: http://127.0.0.1:5180. Isolated production-build Gemini validation server: http://127.0.0.1:5182. The local Ollama path is preserved; no fresh live Ollama generation is claimed for M13. Helpers reuse healthy services; verify actual output after restart with npm.cmd run dev:local or npm.cmd run dev:gemini. Do not print ignored .env files or auth.

Use MANUAL_TESTS.md: check four controls, native floor route/reset/exit, editor/history; point → pinch → move → release → Undo; two-hand scale/yaw; minimize preview/walk and emergency Stop; real microphone Start → speak → Stop → review/edit → Send. On the friend device record browser/version/OS/timezone and sanitized status/category/request ID/retry fields. Do not supply keys, audio or unrelated traffic. No further milestone is authorized by this handoff.

## Reproduction commands (only rerun affected gates)

```powershell
npx.cmd tsc -b --pretty false
npm.cmd run lint
npm.cmd test
npm.cmd run test:server
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL='msedge'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5175'
npm.cmd run test:e2e
node scripts/audit-publication.mjs
```

For provider-free public navigation replay, export a non-sensitive compatible two-floor project with stairs/balcony, set HOLO_RELEASE_URL, HOLO_REPLAY_SCENE and HOLO_SOURCE_SHA, then run node scripts/replay-exploration.mjs. Run scripts/smoke-exploration-permissions.mjs separately; never run concurrent browser suites. Live Gemini smoke uses explicit HOLO_LIVE_GEMINI=1, HOLO_MILESTONE=13, HOLO_PRECISION_SMOKE=1, HOLO_EXPLORATION_SMOKE=1 and HOLO_RELEASE_URL with scripts/smoke-milestone105.mjs; it consumes admitted quota. Do not repeat unchanged expensive live requests needlessly.

Structured evidence: MILESTONE_13_RELEASE_VALIDATION.json and MILESTONE_13_PRODUCTION_VALIDATION.json. Private raw logs, screenshots and generated projects stay ignored under .cache; only a sanitized template fixture and inspected public screenshot are published.
