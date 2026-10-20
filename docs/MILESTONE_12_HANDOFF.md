# Milestone 12 release handoff

Updated 2026-10-20T07:54:57.776Z. Project D:\Projects\HoloBuild. Preserve all completed work; no reset/discard. Current runtime includes standalone/connected native stairs, real selected-wall openings, speech lifecycle/permission fixes, compact Inspector, read-only walkthrough/presentation and saved views. See WALKTHROUGH.md and DEVELOPMENT.md for coverage and limitations.

## Completed local gates
-392/392 units,39files: .cache/m12-final-all-units.log.
-66/66 backend tests: .cache/m12-all-backend.log; backend unchanged since that gate.
-Referenced TypeScript and ESLint: .cache/m12-final-types.log / m12-final-lint.log.
-Production build29.13s: .cache/m12-release-build.log;70 notices/0unresolved, existing annotation/chunk warnings.
-Full148-case serial browser gate:147pass/1test fixture startup race,28.0min (.cache/m12-final-browser-full.log).
-All13 affected command/native/Inspector browser cases now pass,1.7min (.cache/m12-final-targeted-browser.log). Mock audio waits for actual Listening;270degree standalone yaw is equivalent-normalized to-90 inside existing strict schema. All148 distinct cases have passing evidence. No full-suite rerun needed for this bounded change.

## Remaining release steps
1. Run publication audit against final source/build, save local implementation checkpoint.
2. Isolated production-compatible Gemini server is already running at http://127.0.0.1:5182, PID24840 (.cache/production-gemini12.mjs). Reads ignored credentials only; never print them. Fresh dist is served per request. Frontend5175/planner5180 remain unchanged.
3. Run real Gemini UI: HOLO_LIVE_GEMINI=1 HOLO_EXPLORATION_SMOKE=1 HOLO_PRECISION_SMOKE=1 HOLO_SOURCE_SHA=<checkpoint> HOLO_RELEASE_URL=http://127.0.0.1:5182 node scripts/smoke-milestone105.mjs. Prepared script has NOT yet executed. It tests actual generated two-floor host, door/stairs/balcony navigation, mouse look, restored views/layout, wall openings,270degree stairs, new-tread appearance and history/save-load without DEV bridge or extra provider calls. Diagnose failures honestly. View actual screenshot.
4. Record release receipts/docs; audit; commit/push master; official Vercel deploy --prod --skip-domain --yes (existing .cache/vercel-auth) with exact SHA metadata. Preflight already captured in .cache/m12-preflight.json: M11 d49952e / dpl_ENkGDZHgqYubXaakkSfWWFZCJTWp is rollback. Do not overwrite baseline after promotion.
5. Verify candidate .cache/verify-release12.mjs (HOLO_DEPLOYMENT_ID, HOLO_SOURCE_SHA), READY/source/private uploads/Hobby/env metadata. Promote only after checks. Run same real public UI smoke, scripts/verify-hosted-security.mjs, metadata verification, safe Vercel log review (.cache/sanitize12-logs.mjs) and read-only lease cleanup (.cache/check-production-leases12.mjs). Preserve prior deployment READY.
6. Commit/push receipt-only final docs, clean tree, report deployed/runtime/doc commits and actual URLs/test counts.

Standing release authorization applies. No paid services, credential changes, quota changes, production deletion or Milestone13. Model output can fail strict schema; record failures rather than infer success fromHTTP200SSE. Physical webcam/microphone/touch/friend-device acceptance is pending.
