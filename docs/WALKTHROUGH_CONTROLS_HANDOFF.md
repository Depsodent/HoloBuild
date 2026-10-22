# Walkthrough controls patch handoff — 22 October 2026

Project: D:\Projects\HoloBuild. Public application: https://holobuild.vercel.app. Repository: https://github.com/Depsodent/HoloBuild.

## Completed controls

Entry requests actual Look Around from the entry click. W/A/S/D, Space jump and held Shift sprint retain existing navigation. Ctrl + right-drag selects supported targets and previews movement on a camera-relative horizontal plane at original elevation; mouse lock uses the center ray and relative deltas, while unlocked input uses normal canvas picking. Mouse-look and locomotion freeze while dragging. Right-button release commits one strictly validated movement/yaw command; invalid, stale, blurred, hidden or escaped operations cancel. Context menus are suppressed for this interaction.

E opens/closes the existing45-preset catalog and deliberately manages pointer lock. Arrow Left/Right rotate the draft or selected target in15-degree increments; repeats and editable-field shortcuts are ignored. Escape exits the entire Walkthrough, including native pointer-lock Escape, catalog/help, placement and direct manipulation. Editor camera/layout is restored, movement and unconfirmed previews cleared, with no automatic re-entry. The four primary buttons and normal editor Q/E behavior remain.

Independent primitives, models and furniture plus whole-Structure transforms use the existing placement/group command system and atomic history. Connected architectural Parts remain protected and retain their Inspector/architectural editing path. Existing support, collision, door/stair access, player-clearance, metadata and scene-snapshot guards are not weakened. Undo/Redo resumes after exit. Mouse, Inspector, gestures, scene IO, Gemini/Ollama contracts, capture lifecycle and hosted safeguards are preserved.

## Browser limitations

Pointer lock is a browser permission/user-gesture feature. Refusal, unsupported browsers and a release still finishing show a one-click Look Around or keyboard/touch fallback; there are no request loops. A locked pointer belongs to the canvas: use E to reach the catalog, or Tab/Enter for toolbar actions and global Stop Camera. Native unexpected lock loss exits; intentional catalog/fallback/blur unlocks do not. Wall-mounted yaw and connected Part drags remain restricted; vertical relocation uses Inspector. Ground-plane dragging does not claim arbitrary free-space/vertical physics.

## Local validation

488 unit tests /42files,70 backend tests, full ESLint, referenced TypeScript through the production build, and build12.56s pass.70 package notices/0unresolved; zero production dependency vulnerabilities. Existing annotation and app/Three chunk warnings remain. No dependencies were added.

The final seven new controls cases pass; the repeated-mode cleanup case also passes independently (9.6s). An earlier8/8 pointer run passed before the final stationary-grab correction. A subsequent retry had only an initial cube UUID mismatch coincident with Vite HMR; the unchanged isolated case passes with source settled. No assertion was removed. The other15 affected architecture/furniture/capture cases passed in the preceding16-case run; that run's only failure reproduced the stale release marker, fixed by clearing it when the actual pointer is already unlocked. All23 distinct affected cases have passing evidence; this is not one uninterrupted23-case green run. Earlier partial runs are retained, including fixture updates for obsolete Escape/E expectations, a hard-coded collision aim and genuine duplicate-unlock/repeated-session bugs. The repeated-lock and off-grid stationary-grab unit reproducers both failed before their minimal corrections and pass afterward. A stationary Ctrl/right click now preserves original coordinates/Euler values and creates no history. No full165-case browser rerun was needed for this focused patch.

Production-build controls replay passes through normal UI with no development bridge, zero provider calls and zero page errors. It checks automatic real pointer lock, locked picking, relative dragging, collision cancellation, Ctrl-held arrow rotation, atomic exact history, native single-Escape exits, catalog typing/lock restoration, layout and original-scene restoration. Browser listener counts return to baseline across repeated visits; existing connected stair/balcony,45-preset, gesture movement and synthetic webcam Stop regressions pass.

## Release status

The checkpoint containing this handoff is the validated implementation. Publication and final production receipt are pending completion. Previous production dpl_f9ro39ExXkYoZeiHDmiFzjgq2yKF (source a1d9edc426f440e8862f0e9a606c6d143dff8695) is READY and snapshotted for rollback. Protected variables remain sensitive production-only and the project remains Hobby. No quota, credential, paid-service or infrastructure changes.

Local frontend http://127.0.0.1:5175, planner http://127.0.0.1:5180 and isolated production-build server http://127.0.0.1:5182. Physical keyboard/mouse, webcam, microphone, touch and friend-laptop acceptance remain pending; see MANUAL_TESTS.md. No unrelated milestone is authorized.

## Reproduction

Use separate commands and one browser process at a time. Final local logs are.cache/controls-final-units.log,.cache/controls-backend.log,.cache/controls-final-lint.log,.cache/controls-final-build.log,.cache/controls-existing-regressions.log and.cache/controls-final-pointer-regressions.log. The recorded failing unit before correction is.cache/controls-repeat-lock-before-fix.log.

For provider-free production UI controls replay set HOLO_RELEASE_URL, HOLO_SOURCE_SHA and optional HOLO_CONTROLS_REPORT, then run node scripts/replay-walkthrough-controls.mjs. For the single real public Gemini/architecture/furniture/controls run set HOLO_LIVE_GEMINI=1, HOLO_MILESTONE=controls, HOLO_PRECISION_SMOKE=1, HOLO_EXPLORATION_SMOKE=1, HOLO_FURNITURE_SMOKE=1, HOLO_WALK_CONTROLS_SMOKE=1, HOLO_RELEASE_URL and HOLO_SOURCE_SHA, then node scripts/smoke-milestone105.mjs. Reuse successful real responses if only a smoke helper needs repair. Never print ignored environment/auth files or modify quotas to force a pass.