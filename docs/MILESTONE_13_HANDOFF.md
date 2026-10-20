# Milestone 13 in-progress handoff

Project D:\Projects\HoloBuild. Base31ea0d3; deployed M12 source40cd7a6 is still production until verified M13 promotion. Preserve all changes.

Implemented: removed separate mode/viewpoint state and retired only holobuild.exploration.v1; four primary Walkthrough controls; secondary help fallback, global camera Stop, safe original-start reset, camera/layout restore and shared read-only guard. Existing collision solver unchanged; lazy per-walk immutable-scene cache, active-gizmo-only listeners/derived selectors, reused Euler/quiet telemetry, door shadow invalidation and stable React/Three vendor chunks. No gesture thresholds, backend/provider/schema, scene serialization, quotas or credentials changed.

Initial gates:394units/39files,66backend tests, referenced TypeScript/ESLint, build11.99s,70notices/0unresolved, dependency audit0vulnerabilities. Eight focused walkthrough cases pass, including actual native door/stairs/balcony route, upper-floor reset, pointer lock/rejection, repeated cleanup, narrow text zoom, webcam lifecycle and late mic permission. A final orientation-reset assertion is included in the full run.

Measured100-cube listeners104→3keydown and102→1blur; five visits return listeners to baseline, restored buffers/textures20/7before and after; editor collision builds0, five visits5. Main entry gzip474529→220919 plus250632stable vendor gzip bytes; total initial bytes barely lower, no general FPS claim. Raw benchmark files under docs/benchmarks; see PERFORMANCE.md.

RUNNING: full150-case serial browser suite, exec session46788, .cache/m13-full-browser.log. Runtime source is frozen until it completes. Do not start a second browser process or modify app source while it runs. Docs/smoke helpers may be finalized independently.

Next: finish full gate and genuine fixes only; safe source/history/bundle audit; local checkpoint. Start isolated production-compatible Gemini .cache/production-gemini12.mjs at5182 if free(reads ignored env without printing). Live smoke HOLO_LIVE_GEMINI=1 HOLO_MILESTONE=13 HOLO_EXPLORATION_SMOKE=1 HOLO_PRECISION_SMOKE=1 HOLO_SOURCE_SHA=<checkpoint> HOLO_RELEASE_URL=http://127.0.0.1:5182 node scripts/smoke-milestone105.mjs. Helpers now use four controls and canvas images instead of removed saved views; diagnose harness differences honestly. Run permission smoke without provider calls.

Release under standing authorization: fresh read-only Vercel preflight(.cache/preflight12.mjs adapted to m13), preserve current READY rollback and sensitive-variable metadata/Hobby. Push master, stage --prod --skip-domain with exact SHA, verify private uploads/source/env/rollback, promote, public Gemini+walk/permission/security smoke, safe function-log/lease checks. Record receipts and final docs-only commit/push, clean tree. No paid services, quota/credential changes, deletion or unrelated milestones. Physical webcam/microphone/touch/friend-laptop acceptance pending.
