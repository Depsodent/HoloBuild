# Milestone 11 — resumable release handoff

Status: local implementation complete; full serial browser suite and live release verification pending. Started from clean68e6475 over production1baa4fa. Preserve all work; no reset/discard/recreation. Routine commit/push/deploy is authorized after release gates, no paid services/quota/credential changes.

## Implementation
- Inspector Materials / AI Edit / Advanced; shared conversation/actions, retained drafts, strict surface operations, custom colors and numeric optical controls. Numeric fields commit on Enter/blur, reject invalid transforms, clamp optics, restore on Escape/rejection.
- Precision local dimensions and world positions in metres; centimetre/millimetre conversational conversion; yaw-only structure rotation. Explicit numeric edits stay exact, shared configurable grid drives ordinary placements/structures/gizmos.
- Exact standalone floor/box-edge alignment; connected wall/floor guards; parametric stair/balcony/opening inspectors retained. Throttled30Hz mouse visual guides plus existing gesture/group previews; optional non-selectable measurements, never saved as scene objects.
- Corrected deterministic metallic routing: Give my house a shiny metallic top stays on existing LLM path. Creation wording cannot precision-edit the starter cube. Invalid replacement requests clear old precision previews.
- Stairs/Balcony cards are in the existing shape palette. Explicit compatible host/floor, native recipes and access, inert preview, confirmation and atomic history; no separate geometry pipeline. Stair insertion is connected only, one void per destination floor. Duplication uses a free adjacent-floor connection or rejects; balcony duplication uses opposite facade and its own/reused valid door. Part/Structure scope preserved.

## Evidence and remaining checks
Current checks:365 units/37files pass;64backend pass;TypeScript/ESLint pass;build24.25s pass,70 notices/0unresolved, existing annotation/chunk warnings.26 focused precision/library cases pass. Pattern source/history/current-bundle audit has0unresolved findings. Dependency audit previously0production advisories, dependencies unchanged.
Prior affected browser31/32: only metallic route failed and is now fixed. Six resumed focused cases: five passed including the exact mocked-LLM regression; manual library case passed insertion/configuration/real rendered geometry/duplication/deletion/history, then a JSON-equivalence assertion differed only by undefined/-0 normalization. The harness now compares canonical JSON for portable IO, while Undo/Redo keeps exact internal snapshots. Full139-case serial browser run is in progress: .cache/m11-final-browser-full.log (session79137 at dispatch). Do not start another browser process until it finishes.

Final remaining: inspect full browser results, fix genuine failures, run targeted checks; run opt-in real Gemini production-build smoke with precision/library extensions; verify model/security/asset/upload evidence; commit release, push master and stage Vercel production with skip-domain; verify READY/source/credentials/quotas, promote and run public smoke/security/log review. Current rollback1baa4fa deployment dpl_2BqHrrBYnkxBX75FiBU4zQwmrzCA; metadata baseline .cache/m11-preflight.json. No Milestone11 push/deploy yet.

## Commands (D:\Projects\HoloBuild, serial browser work)
- npm.cmd run typecheck; npm.cmd run lint; npm.cmd test -- --maxWorkers=1; npm.cmd run test:server; npm.cmd run build
- $env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5175'; npx.cmd playwright test
- node scripts/audit-publication.mjs --write
- $env:HOLO_LIVE_GEMINI='1'; $env:HOLO_PRECISION_SMOKE='1'; $env:HOLO_LIBRARY_SMOKE='1'; $env:HOLO_RELEASE_URL='http://127.0.0.1:5182'; node scripts/smoke-milestone105.mjs (requires fresh isolated production-build Gemini server .cache/production-gemini105.mjs; report retains historical m105 filenames). Repeat with public URL only after validation/promotion.

Frontend5175/planner5180 run through scripts/dev-local.mjs (launcher27212); services were stopped at session resume and safely restarted. Do not print environment/auth files. Working private production Gemini profile and Vercel credentials remain ignored. Physical webcam/microphone/friend-device acceptance remains pending. No Milestone12.
