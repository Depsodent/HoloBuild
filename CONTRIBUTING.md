# Contributing to HoloBuild

Read README.md, docs/ARCHITECTURE.md and the latest milestone handoff first. Preserve the existing scene command/validation/history architecture and the holographic UI. Public visibility does not change the original code's UNLICENSED status; coordinate contribution and reuse permission with the owner.

Use Node22.12+ or Node24 and npm ci, then npm run setup:vision. npm run dev:local starts/reuses Vite5175 and planner5180; optional npm run dev:gemini reads ignored .env.gemini.local. Exact installed Ollama model IDs or account-verified Gemini IDs are server configuration, never browser credentials. Offline works without a key.

Keep commits focused. A proposal must not mutate the confirmed scene; confirmation is one atomic command with exact Undo/Redo. Preserve Part/Structure target scope, stable metadata, native openings, connected stair voids and balcony access. Test manual, Inspector, AI and gesture paths through shared commands rather than adding parallel implementations. Old version1 scene files should remain compatible.

Run npx tsc -b --pretty false, npm run lint, npm test, npm run test:server and npm run build. Browser tests use one worker; set PLAYWRIGHT_BASE_URL to the actual frontend URL and run npx playwright test (or targeted affected files). Run one browser suite at a time; do not modify runtime code during a broad suite. Relevant successful results may be reused when unchanged paths are documented. Dependency audit: npm audit --omit=dev. Source/history/bundle checks: node scripts/audit-publication.mjs. Never print ignored environment/auth values.

Report reproducible steps, expected/actual behavior, browser/OS, selected scope and sanitized request ID/error category. Do not submit API keys, private project assets, raw microphone audio or unrelated personal network logs. Synthetic landmarks/speech/software WebGL establish automated correctness, not physical device acceptance or GPU performance.

Routine owner-authorized releases use staged existing Vercel production candidates, exact source/hash/environment checks, promotion, public smoke tests and retained rollback. Do not change credentials, hosted quotas, spending, production data or infrastructure outside explicitly authorized scope. See docs/DEPLOYMENT.md.
