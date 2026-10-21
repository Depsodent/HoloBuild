# Milestone 13.1 release handoff

Project: D:\Projects\HoloBuild. GitHub: https://github.com/Depsodent/HoloBuild. Public application: https://holobuild.vercel.app.

## Preserved implementation

Resumed from73d622a; no reset, recreation, discard or unrelated milestone. Grounded Space jump, Shift sprint and swept ceiling/wall collision retain four primary Walkthrough controls. Contextual Furnish uses45 distinct native multipart presets in six categories, searchable catalog, validated ray ghost, Q/E rotation, explicit confirmation/cancellation and selected reposition/remove. Existing editor Inspector/precision, appearance, duplication/deletion, one-/two-hand transforms, portable JSON and exact atomic history share the existing command system. The bounded furnishing permission is active only inside its explicit context; ordinary editing stays blocked while walking.

Placement checks full support coverage, attachments, overlaps, doorway/stair access and the current player. Floor/tabletop/wall/ceiling items have distinct attachment requirements. Geometry and navigation proxies share preset dimensions. Furniture is an independent Part, not an automatically following building member. Invalidating its support is rejected. See FURNISHING.md.

AI deterministic/Gemini/Ollama contracts share the registered catalog and component edit previews. Explicit base coordinates or a known selected support are required. Ambiguous room labels/near-window requests clarify; no invented room coordinates or structural certification. A final small correction accepts question-mark punctuation on explicit coordinates without changing geometry validation.

## Validation recovered and reused

- Full serial browser suite:158/158 passed in25.1minutes before the punctuation-only correction; all eight new milestone cases included. No unnecessary rerun.
- Preserved476/476 unit tests and70/70 backend tests passed. The additional punctuation regression plus movement/furniture focused run passes82tests; affected AI browser case passes. Final aggregate:477/477 unit tests across41files passed. Standalone referenced TypeScript also passes.
- Refreshed referenced TypeScript via production build, ESLint and build pass;70 package notices/0unresolved. Existing annotation and large-chunk warnings remain. Zero production dependency vulnerabilities; source/history/bundle audit has no unresolved findings.
-30/50/100-item benchmarks keep keydown/blur listeners3/1; editor collision builds0, five visits5; original scene restored exactly. Software RAF medians76.5/111.1/166.8ms are observations, not physical GPU/FPS acceptance. Shared preset geometry and one wood texture remain bounded/resident after instance disposal. See PERFORMANCE.md and raw benchmark JSON.
- Real local Gemini first request timed out at the unchanged30s budget before a plan. Evidence retained. A single retry generated a valid house in26.529s and edited it in8.597s; rendered navigation, architecture and precision checks passed. Real Gemini native sofa creation (17.358s) and selected edit (6.692s) passed strict previews, confirmation and exact history. The combined smoke stopped only when the helper tried duplication after history had intentionally cleared selection. The helper now reselects; a provider-free replay of the same actual generated house passes the complete furniture UI, narrow layout, jump/sprint, Inspector, duplication, save/load and history checks with zero page errors. Original failed receipts are preserved; this is not a fictional uninterrupted combined success. No quota/timeout/security settings changed.

## Release status

Pending final local smoke completion, verified checkpoint, push, staged Vercel verification, promotion and public smoke. Previous production dpl_4kLa2xBZ2ADGTLxYq18H8ZSuMf6Z (source2d90378a9e90e8b848e1b4848cc8697b4a508bac) is preserved for rollback. Existing protected server variables and Hobby plan must remain unchanged. Never print ignored environment/auth files.

## Resume and acceptance

Local frontend http://127.0.0.1:5175; existing planner http://127.0.0.1:5180; isolated production-build Gemini validation http://127.0.0.1:5182. Check health after restart. Physical webcam, microphone, touch and friend-laptop tests remain pending. Use MANUAL_TESTS.md for actual device acceptance; historical webcam acceptance is not a fresh test.

Only rerun changed/failed gates. Broad browser receipt is.cache/m131-full-browser.log; focused receipt.cache/m131-resume-browser.log; local live workflow.cache/m131-local-workflow.json, initial timeout.cache/m131-local-workflow-timeout-first.json; build/lint/focused results.cache/m131-resume-*.log. Private raw logs/projects/screenshots stay ignored. Public receipts contain sanitized booleans, timings and identifiers only.
### Reproduction commands

Use separate commands in D:\Projects\HoloBuild. Do not run concurrent browser suites.

```powershell
node node_modules/typescript/bin/tsc -b --pretty false
npm.cmd run lint
npm.cmd test
npm.cmd run test:server
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL='msedge'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5175'
node node_modules/@playwright/test/cli.js test tests/e2e/furniture131.spec.ts --grep 'AI furniture'
node scripts/audit-publication.mjs
```

The full158-case suite already passed; rerun it only after relevant runtime changes. For provider-free production UI replay, set HOLO_RELEASE_URL, HOLO_REPLAY_SCENE to the recorded actual generated house and HOLO_SOURCE_SHA, then run node scripts/replay-furniture131.mjs. For a real provider release run set HOLO_LIVE_GEMINI=1, HOLO_MILESTONE=13.1, HOLO_PRECISION_SMOKE=1, HOLO_EXPLORATION_SMOKE=1 and HOLO_FURNITURE_SMOKE=1 with scripts/smoke-milestone105.mjs. Live calls consume the existing admitted quota; do not repeat successful calls just to repair a test helper. All generation must reach a strict valid preview, confirmation and exact history; HTTP200 alone is insufficient.