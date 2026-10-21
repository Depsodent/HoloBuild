# Milestone 13.1 completed release handoff

Project: D:\Projects\HoloBuild. Public application: https://holobuild.vercel.app. Repository: https://github.com/Depsodent/HoloBuild.

## Published source

Implementation checkpoint **a1d9edc426f440e8862f0e9a606c6d143dff8695** is pushed to master and deployed as **dpl_f9ro39ExXkYoZeiHDmiFzjgq2yKF**, READY at the public alias. Candidate: https://holobuild-2ocbipwpv-aaryand616-6524.vercel.app. All seven served JavaScript files match the audited local bundle. Final documentation receipts do not change runtime files and need no duplicate build/deployment.

Previous deployment **dpl_4kLa2xBZ2ADGTLxYq18H8ZSuMf6Z**, source2d90378a9e90e8b848e1b4848cc8697b4a508bac, remains READY for rollback. Existing protected production variables and Hobby plan are unchanged. No paid service, quota, credential or infrastructure change. Initial Git HTTP408 and two Vercel upload fetch failures recovered through normal unchanged retries; production stayed on the old source until the candidate passed checks.

## Delivered

Grounded Space jump, held Shift sprint, gravity/landing and swept wall/ceiling collision use the existing body solver. Blur, editable focus, lock loss, pause, reset and exit clear transient input. Walkthrough retains exactly Look Around / Exit Walkthrough / Reset Position / Controls. Separate contextual Furnish is accessible in Walkthrough and the normal editor.

**45 distinct native multipart presets** across six categories support search, support-aware ray ghosts, Q/E rotation, explicit confirmation, inert cancellation, reposition/remove and independent Part selection. Floor/tabletop/wall/ceiling attachments validate full support coverage, intersections, native door/stair access and the player's body. Normal Inspector, materials, precision, mouse and gesture transforms, duplicate/delete, portable JSON and exact atomic Undo/Redo use the same command system. No separate furniture scene/history architecture.

AI furnishing uses the same deterministic and Gemini/Ollama strict assistant contract and component preview. Explicit base coordinates or a known selected support are required; ambiguous room/near-window requests clarify. A final punctuation correction accepts a question mark after explicit coordinates without relaxing geometry checks.

## Validation

- **477 unit tests /41 files;70 backend tests; referenced TypeScript, full ESLint plus final helper lint, and production build pass.** Local build23.20s; remote frontend11.83s.70 package notices, zero unresolved; production dependency audit zero vulnerabilities. Existing third-party annotation and large app/Three chunk warnings remain.
- Full serial browser suite **158/158 passed in25.1min** before the punctuation-only correction. Focused82 movement/furniture unit tests and the affected AI browser case pass after it. The completed broad suite was reused, not needlessly repeated.
- Local real Gemini house/edit26.529/8.597s, sofa creation/edit17.358/6.692s. Initial house request timed out at the unchanged30s budget before returning a plan. Retry passed actual geometry, strict previews and history. The combined local helper stopped at duplication because Undo/Redo intentionally cleared selection. Reselect is fixed; zero-provider replay of the same real generated house passes all remaining furnishing UI/history checks. Original failures remain recorded rather than relabeled as one uninterrupted success.
- **Complete public smoke passes with zero page errors.** Actual Gemini44-part house,16stairs, real upper-floor void and8balcony parts; connected entry/stairs/balcony navigation, native openings, precision, inert preview, confirmation/cancellation and exact history. Real native sofa creation/selected edit, interior bed placement, Jump/Sprint/reset, four controls, narrow catalog/keyboard search, rotation/cancel, Inspector color, duplication, portable save/load and exact history all pass through production UI without a development bridge.
- Public Gemini totals: house2.237s, structure edit1.351s, sofa1.323s, sofa edit1.380s; first content .648/.632/.822/.846s respectively. These are individual observed requests, not latency guarantees.
- HTTPS/headers, exact-origin/CORS denials, private404, exact known-secret absence, seven asset hashes, WASM MIME and notices pass. The first model-asset probe exceeded15s; identical retry passed.53 observed request records contain no5xx; six runtime warnings are expected403 origin probes, no unexpected errors. Active generation leases0; counters were not mutated. Synthetic microphone lifecycle passes with no provider calls; this is not physical microphone acceptance.

Structured evidence: MILESTONE_131_RELEASE_VALIDATION.json and MILESTONE_131_PRODUCTION_VALIDATION.json. Private raw logs/projects/screenshots remain ignored under.cache. Source/history/bundle audit has zero unresolved findings; the fake reserved-domain rejection fixture remains documented.

## Measurements and limitations

30/50/100 furniture retain keydown/blur listeners3/1. Collision builds0 in editor and5 for five Walkthrough entries; original scene restoration passes. Software RAF medians76.5/111.1/166.8ms show increasing scene cost, not physical GPU/FPS acceptance. Preset geometry and one wood texture remain in bounded caches after instance disposal. See PERFORMANCE.md and the raw benchmark JSON.

Furniture is an independent Part, without automatic building ownership/following or semantic room labels. Support-invalidating edits reject; wall/ceiling support is restricted to appropriate flat faces. Conservative navigation/placement boxes can reject otherwise usable empty gaps. Free-tier availability, provider variability and browser API support remain limitations. No fresh live Ollama generation is claimed; its shared contract/backend regressions pass. No building-code/structural certification.

## Services and physical acceptance

Frontend http://127.0.0.1:5175; existing planner http://127.0.0.1:5180; isolated production-build Gemini validation http://127.0.0.1:5182. Verify health after restarting with npm.cmd run dev:local. Never print ignored environment/auth files.

Physical webcam, microphone, touch and friend-laptop acceptance remain **pending**. Test Space/Shift and stair/balcony routes, Furnish sofa/table plus upstairs bed/wardrobe, invalid support/door blocking, cancel/reposition/remove, Inspector/material edits, save/load and exact Undo/Redo. After exit test point/pinch/move/release/Undo and two-hand scale/yaw on furniture. Minimize the camera UI and verify tracking/Stop; deliberately test microphone finalization and typed fallback. Record browser/device and actual diagnostics using MANUAL_TESTS.md. No unrelated milestone is authorized.

## Reproduction

Run separate commands from the existing checkout; only rerun changed/failed gates. Full browser evidence is.cache/m131-full-browser.log; final unit/build/lint/TypeScript/focused results are.cache/m131-resume-*.log. Real public results are.cache/m131-public-workflow.json. For provider-free replay set HOLO_RELEASE_URL, HOLO_REPLAY_SCENE to the recorded actual generated project, HOLO_SOURCE_SHA, then run node scripts/replay-furniture131.mjs. Real release smoke requires HOLO_LIVE_GEMINI=1, HOLO_MILESTONE=13.1, HOLO_PRECISION_SMOKE=1, HOLO_EXPLORATION_SMOKE=1 and HOLO_FURNITURE_SMOKE=1 with scripts/smoke-milestone105.mjs. Calls consume normal admitted quota; do not repeat successful calls to repair a helper. Never run concurrent browser suites.