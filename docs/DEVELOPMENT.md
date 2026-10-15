# Development checkpoints

## Environment — 2026-10-12

- Verified Windows Known Folder and registry Desktop: `C:\Users\AARYAN DESHPANDE\OneDrive\Desktop`.
- Created independent Desktop `HoloBuild` folder and opened it in VS Code.
- Node 24.20.0, npm 11.19.0, Git 2.55.0, GitHub CLI 2.102.0, VS Code 1.141.0, Python 3.12.10 detected.
- Installed missing ESLint, Prettier, GitLens and Error Lens extensions. Python/Pylance already present. No global editor settings or machine PATH changed.
- Source prepared in Codex's writable staging folder and copied to Desktop at validated checkpoints. `sources/` remains untouched.

## Milestone 1 — verified

Implemented the React/Vite/TypeScript foundation, 3D grid/camera/light/cube scene, mouse transform handles, inspector, shared command manager, undo/redo, import/export, keyboard controls and responsive UI. Primary files: `src/App.tsx`, `src/components/viewport/*`, `src/components/ui/*`, `src/scene/*`.

Algorithms: Three.js applies scale, rotation and translation to a unit cube. Transform handles preview locally and commit one validated snapshot on release. Zustand makes the validated scene available to both the UI and renderer. R3F provides declarative mesh lifetime management; Drei avoids rebuilding standard camera and transform controls.

Test: run the README checks, create a cube, orbit, change X, undo, save and reload. Exercise: change the default cube color in `src/scene/objectFactory.ts` and observe new cubes.

Limitations: only cubes; no surface collision/stacking engine yet. Future interaction milestones are not represented as completed.

Milestone 1 verification: typecheck, lint, 3 unit tests, production build, and 3 Edge/Playwright browser tests passed. Screenshot inspected. npm audit: 0 vulnerabilities after upgrading Vitest to 5.0.4. Browser verification required an elevated Vite server on port 5175 because the sandbox-bound port was not reachable. Build reports a large 3D bundle; optimization is deferred until measured.

## Milestone 2 — 2026-10-13

Added `vision/handTracker.ts`, `landmarkStream.ts`, `trackingStore.ts`, `components/camera/*`, and `scripts/prepare-vision.mjs`. Optional camera capture feeds locally served MediaPipe 1.1 in VIDEO mode, one hand, CPU delegate. Raw 21-point results are emitted outside React; a canvas paints skeleton edges and joints. Preview and overlay share the same mirrored coordinates. Inference skips unchanged video frames, targets 24 Hz, and adapts down when detection is expensive. UI metrics update twice a second.

Lifecycle generation tokens prevent pending permission/model promises from resurrecting stopped sessions. Stop, unmount, hidden tab, track disconnection and startup/inference errors release resources. Camera device selection is available after permission. The model has a pinned version URL and SHA-256; runtime files are copied from the installed package.

Verification: type checking, 7 unit tests and production build passed; 5 Edge browser tests passed, including real MediaPipe inference on generated video, stream release, denied permission and all editor regressions. Lint configuration was adjusted to exclude generated third-party WASM loaders. Physical 21-landmark accuracy is pending a real hand/camera test; synthetic blank video verifies model execution but cannot establish that accuracy.

Try: Start camera, allow access, hold up one hand, toggle landmarks, then Stop and check the camera hardware indicator. Exercise: change the inference cap from 24 to 18 in `handTracker.ts` and compare measured inference rate and FPS. Limitations: synchronous CPU inference, one hand, no physical benchmark yet.

## Milestone 3 — 2026-10-13

Added `vision/gestureTypes.ts`, `calibration.ts`, `smoothing.ts`, `gestureDetector.ts`, `gesturePipeline.ts`, `components/ui/GestureStatus.tsx`, dev-only synthetic landmark injection, and gesture fixtures/tests. The detector classifies pointing, normalized pinch with hysteresis, held open palm, fist and ambiguous/lost states. Exponential smoothing is time-aware; gesture dwell is temporal rather than frame-count based. Raw points remain outside React. UI reports stable versus candidate state and normalized pinch ratio, without inventing probability/confidence scores.

Typecheck, lint, 14 unit tests, production build and the deterministic gesture browser test passed. Existing camera/editor tests passed during the same milestone. The initial parallel headless gesture run exposed software-renderer starvation; serial execution passes and is now configured. This is not evidence of physical-camera performance or reliable real-world gesture classification.

Test: Start camera, point, pinch, reopen, hold open palm. Watch the status settle; remove your hand and confirm it clears. Exercise: adjust `palmDwellMs` in calibration and compare responsiveness versus accidental activation. Limitations: heuristic orientation sensitivity, one hand, physical threshold tuning still pending.

## Milestone 4 — implemented 2026-10-13, verified 2026-10-14

### Resume audit and preservation

Desktop project: `C:\Users\AARYAN DESHPANDE\OneDrive\Desktop\HoloBuild`, clean at `475c684` when inspected. The unfinished implementation was in the existing Codex staging workspace, with 17 added/changed source/test files relative to that checkpoint (including one formatting-only change). The app's earlier edit count was not treated as a count of uncommitted Git files. Source snapshots were saved outside the application as `HoloBuild-preserved-source-20261013.zip` and `HoloBuild-preserved-tree-20261013.zip`; the latter retains directory structure. No reset, checkout, discard, or deletion was used.

Existing code already contained the gesture cursor, scene raycaster, finite-state controller, placement validator, ghost preview, gesture tool menu and six interaction unit tests. Continued from those files rather than rebuilding. Fixed cancellation on external scene changes (especially Undo clearing preview), and moved selection/tool setup before opening a grab transaction to avoid false self-cancellation.

### Implemented behavior and files

- `interaction/coordinateMapping.ts`, `raycasting.ts`: mirrored index pointer → NDC → current-camera ray → nearest construction mesh or a horizontal drag plane.
- `interaction/gestureController.ts`, `interactionStore.ts`: stable pointing arms a pinch; pinch captures selection and grab offset; movement updates a transient preview; release commits once; invalid/lost/fist/off-screen/stalled input cancels.
- `interaction/placement.ts`, `intentMapper.ts`: 0.5 m X/Z snapping, ground/bounds/conservative AABB validation, then shared scene commands. No per-frame history entries. A stationary grab is a no-op.
- `components/viewport/GestureInteraction.tsx`, `BuildingObject.tsx`, `CameraController.tsx`, `Scene.tsx`: actual Three.js picking, preview rendering, target feedback, orbit lock while grabbing, and interruption handling.
- `components/ui/GestureCursor.tsx`, `GestureMenu.tsx`, `InteractionStatus.tsx`, `App.tsx`, styles: responsive cursor/status/menu feedback; shallow shell subscription avoids rerenders for every preview update.
- `tests/helpers/gestureInput.ts`, `tests/e2e/construction.spec.ts`, `tests/unit/interaction.test.ts`, dev bridge: continuous, visibly labeled synthetic input drives the real detector/controller/raycaster. Test bridge is absent from production.

### Verification

Final verification on the actual Desktop checkout (2026-10-14): TypeScript checking, ESLint, **22 unit tests**, **11 serial Edge/Playwright browser tests**, and the production build all passed. The full browser run took 54.0 seconds. Coverage includes real local MediaPipe inference on synthetic video, permission denial, actual Three.js raycasting, visible cursor targeting, gesture menu creation, snapped ghost movement, release committing exactly one history entry, Undo/Redo plus subsequent mouse edits, missing/stalled input cancellation, overlap rejection, Undo during a grab, scene import/export and orbit/tool regressions. The gesture-drag browser screenshot was visually inspected.

Diagnosis of intermittent browser failures confirmed that host scheduling gaps exceeded the 250 ms threshold and restarted gesture recognition. Fixture tests now advance a controlled Playwright clock while retaining real rendering, raycasting and scene commands; the stalled-input test explicitly advances 350 ms without frames. Real camera/model tests use real time. No production threshold was loosened. Cancellation messages now distinguish tracking restart, missing/outside-viewport input, stalled frames and viewport recreation.

The Desktop Vite server runs in the background at **http://127.0.0.1:5175/**; an HTTP request returned 200. Only the verified staging server was stopped to free that port; unrelated processes were untouched. The Git checkpoint is created after all checks with title `feat: milestone 4 verified gesture-controlled construction`. Milestones 1–4 are implemented with automated verification; physical webcam acceptance is still pending. **Milestone 5 has not started.**

Vite reports a large 3D bundle and Zod annotation warnings, but no build failure. Physical webcam hand tracking and 30 FPS performance remain unverified; real MediaPipe model execution is covered with synthetic video. See `MANUAL_TESTS.md` for the laptop webcam test sequence and observations to record.

### Teaching notes and next step

Raycasting turns a 2D pointer into a camera-relative 3D ray; it does not infer real hand depth. Intersecting a fixed-height plane makes one-hand movement predictable. Capturing the grab offset prevents initial snapping to the fingertip. Persistent scene state stays unchanged until placement succeeds, which naturally produces a single reversible command. Zustand separates transient interaction feedback from persisted scene objects; Three.js supplies the geometric math.

Manual test: Start camera → point at a cube → pinch → move → reopen to place → Undo. Repeat while hiding your hand, moving over another cube, or pressing Undo mid-grab; the unfinished move must cancel. Hold an open palm, then point/pinch Create cube to test construction without a mouse. Rotate and scale remain mouse-driven.

Limitations: one-hand planar translation only; no vertical gesture movement, automatic stacking, two-hand transforms, exact rotated-shape collision or physical calibration yet. Conservative AABBs can reject separated rotated cubes. Mouse transforms preserve their earlier rules and can create overlaps. Heavy CPU stalls can trigger safe cancellation.

Exercise: change `snapCoordinate`'s step from 0.5 to 0.25 m, update the displayed grid-step label, and extend its unit test. Next is Milestone 5: additional primitives and improved placement/stacking tools; do not start two-hand/AI work before the basic editor is physically tested.

## Milestone 4 webcam interaction repair — 2026-10-14

### Report and starting state

Continued the existing Desktop project at clean checkpoint `a1a5d86`, preserving Milestones 1–4. The user physically confirmed that camera startup, tracking and cursor motion worked, but reported unreliable grabs and repeated “Point. Pinch. Build.” popups. No physical acceptance is claimed for this repaired build. No reset, deletion, project recreation or Milestone 5 work was performed.

### Diagnosis and targeted fixes

Code inspection identified three concrete failure paths: strict stable-pointing arming was cleared by unknown/fist poses during closure; the grab used only the current fingertip ray after debounce, allowing closure drift to lose the target; and release dwell restarted whenever the non-pinch pose classification changed. The popup was opened directly by a stable open-palm transition, with no explicit user action. The virtual cursor did not dispatch arbitrary UI clicks.

- Pinch now has an independent hysteresis latch and 90 ms activation/release debounce. Open thumb/index arms aiming without requiring all other fingers to be curled. Relaxed release can place; fist release still cancels. Activation/release thresholds remain **0.32 / 0.48**.
- A recent actual selectable ray hit survives closure for at most **500 ms** and **0.08 normalized cursor displacement**. Stale/distant hits cannot be used. Grab offset remains captured at closure; release freezes the last preview while debounce settles, then creates one validated history command. Stationary/invalid moves create none.
- MediaPipe y is converted from image-height units to image-width units for distance/angle measurements, using the actual video dimensions. Cursor mapping remains `(1 − x, y)` and agrees with the mirrored preview and Three.js NDC ray. Handedness does not gate selection.
- Help → **Open gesture tools** is the only menu-opening path. Open-palm recognition and pinch release cannot open it.
- Collapsible **Gesture diagnostics** displays pose/candidate, normalized distance, thresholds, threshold latch, debounced pinch state, target ID, actual selectable ray hit, grab phase, rejection/cancellation reason, tracking status and rate. Confidence is explicitly unavailable, not confused with handedness probability.
- Webcam/diagnostics overlays and Help block object grabbing through UI. Mouse pointer-down cancels and suspends gestures until pointer-up; a held pinch cannot restart the cancelled operation. Existing undo-during-grab and tracking-loss safeguards remain intact.
- Live camera and synthetic fixtures both publish landmarks plus aspect ratio into the same smoother, detector, controller and raycaster. New fixtures model relaxed fingers, nonzero depth, gradual closure, fingertip drift and changing release poses. They are synthetic approximations, not recorded webcam data.

### Verification and checkpoint

On the actual Desktop checkout: **TypeScript passed; ESLint passed; 28 unit tests passed; all 14 serial Edge/Playwright browser tests passed (1.1 minutes); production build passed.** Browser coverage includes the real local MediaPipe runtime on synthetic video, denied camera permission, cursor/raycast alignment, pinch selection, snapped move and one-command release, no release/palm popup, rapid transitions, hand loss/stall, collision rejection, Undo during grab, explicit Help/menu use, mouse takeover and original editor import/export/orbit tests. The expanded diagnostics screenshot was visually inspected in the rendered application.

The build retains the existing large-bundle and third-party Zod annotation warnings. Vite is running at **http://127.0.0.1:5175/** and an HTTP request returned 200. Save this verified repair as `fix: stabilize webcam pinch interaction and require explicit gesture help`.

### Physical acceptance and next step

The code-level failure paths are repaired and automated regressions pass; **reliable physical-webcam interaction is still awaiting the user's retest**. Ask the user to: point at cube → pinch to grab → move → release to place → confirm no popup → undo. If unsuccessful, use diagnostics to identify whether distance/latch, debounce, targeting, grab rejection or frame loss failed. Capture actual closed/open distances before adding calibration; do not weaken thresholds speculatively.

Limitations remain one-hand fixed-height translation, heuristic sensitivity to occlusion/orientation, conservative AABB collision and safe cancellation after >250 ms stalls. Camera conditions and performance need physical measurement. Milestone 5 (additional primitives and placement/stacking) remains deferred until this interaction is accepted; it has not started.

## Milestone 4 — physical acceptance confirmed 2026-10-14

The user reports all six checks passed with their actual laptop webcam on checkpoint `6b99b1d`: pointing highlights the cube, pinch grabs, hand movement moves it, release places it, no unwanted popup appears, and Undo restores its position. No failures were reported. This is user-reported physical acceptance, separate from the prior 28 unit and 14 browser tests. Preserve the unchanged gesture thresholds, debounce, target retention and explicit Help behavior as the Milestone 5 baseline.

## Milestone 5 — Advanced Construction Tools, 2026-10-14

### Recovery and preservation

Milestone 4 physical acceptance is preserved in Git checkpoint `c8a5e15` (user-reported six webcam checks passed on `6b99b1d`). On resuming Milestone 5, the Desktop checkout was clean at that checkpoint; the partially edited shapes implementation remained in the existing Codex staging directory. Preserved and completed those edits without resetting or discarding files. Source comparison confirms `src/vision/*`, `gestureController.ts` and the explicit-only gesture menu are unchanged from the physically accepted baseline.

### Implementation

- Added sphere, cylinder, cone, wall and floor alongside cube. `scene/objectTypes.ts` expands the supported type enum; `objectFactory.ts` centralizes names and base dimensions. Walls are 3 × 2 × 0.25 m; floors are 4 × 0.2 × 4 m. Curved primitives have diameter 1 m and height 1 m where applicable.
- `components/viewport/ObjectGeometry.tsx` supplies the same geometry for rendered objects and gesture previews. Each mesh retains its object ID, so the existing real raycaster and gesture grab controller select and move every type without a separate scene system.
- `Toolbar.tsx` exposes all six shapes with distinctive icons and dimensions in a compact two-column palette, preserving the holographic theme. Inspector labels identify the actual geometry; position, rotation, scale, name, material/color, duplicate, delete and reset controls work for every type. Keyboard shortcuts remain V/G/R/S, Delete, Ctrl+Z and Ctrl+Shift+Z.
- `placement.ts` accounts for base dimensions, Euler rotation and nonuniform scale. Box bounds use transformed corners; curved primitives use analytical support extents (ellipsoid, cylinder, cone base/apex). Ground and whole-object ±50 m bounds are checked. Collision remains conservative world-AABB overlap with 0.02 m tolerance; touching is allowed.
- Shared `execute` commands now validate inspector and mouse-gizmo transforms with the same placement rules used by gestures. X/Z snapping is 0.5 m when enabled. Grounded in-place scale/rotation preserves the bottom at ground level. A rejected edit changes neither objects nor history; gizmos restore the actual mesh from the accepted transform.
- Creation/duplication search deterministically for nearby free grid space rather than introducing overlaps. All new operations use the existing undo/redo manager. JSON version 1 accepts every supported type and remains compatible with old cube scenes; malformed and unknown types are rejected. Import preserves structurally valid layouts rather than silently rearranging them.

### Verification

The recovered first feature group passed TypeScript, ESLint, 36 unit tests and build; existing browser regressions passed. New browser coverage exposed an ambiguous Material control label, which was fixed with an explicit accessible label; all seven initial shape browser tests then passed. Shared placement integration subsequently passed 39 unit tests. Final complete suite results are recorded below after completion.

Regression coverage includes every primitive's commands and save/load, mouse mesh selection and inspector transforms/appearance, gesture raycast/grab/move/release with exactly one move entry, undo, duplication/deletion, rotated/nonuniform bounds, floor contact, overlap rejection without history changes, free-space spawning, snapping enabled/disabled and keyboard tool/history actions. Existing pinch-debounce, popup prevention, loss/stall/Undo cancellation, collision and camera/editor tests are retained. Browser gesture fixtures are simulated landmarks through the production controller; they are not physical webcam verification.

### Remaining limitations and acceptance gate

One-hand gesture motion remains at the object's existing height. Rotation/scale use mouse controls. There is no automatic stacking, gravity, exact mesh-to-mesh collision, two-hand input, voice or LLM integration. AABBs may reject close curved or rotated shapes whose meshes do not touch. Imported legacy scenes may contain overlaps; placement edits subsequently enforce the new validator. Creation can fail when its bounded free-space search finds no valid spot. Numeric inspector changes remain immediate commands, so typing multiple intermediate values can produce multiple undo entries; a completed gesture/gizmo drag still commits once.

The user must physically retest new shapes: create → point/highlight → pinch/grab → move → release → no popup → Undo, then test mouse rotate/scale, material/color, duplicate/delete and mixed-scene save/load. Milestone 4's physical acceptance remains recorded; Milestone 5 physical acceptance is pending. **Do not begin Milestone 6 until the user has tested and accepted Milestone 5.**

Final Desktop checkout validation: **TypeScript passed; ESLint passed; all 39 unit tests passed; all 22 serial Edge/Playwright browser tests passed (2.1 minutes); production build passed.** The final rendered mixed-shape/palette screenshot was visually inspected. The usual large-bundle and third-party Zod annotation build warnings remain non-blocking. Save the stable implementation checkpoint as `feat: milestone 5 advanced construction tools`. Vite remains available at **http://127.0.0.1:5175/** for the user's new-shape webcam acceptance test.

## Milestone 5.1 — floating Gesture Input and material distinction, 2026-10-15

### Preservation and diagnosis

The Desktop project retained the previously verified Milestone 5 edits as uncommitted files. Preserved that 39-unit/22-browser-test implementation and its documentation in checkpoint `91e2b44` before beginning these refinements. No project recreation, reset or removal was used. The physically accepted Milestone 4 recognition/pinch code remains the baseline.

Inspection showed that Material selection already updated `object.material` through the shared undoable update command and persisted the preset identifier in version-1 JSON. The render path used the same roughness 0.28 and metalness 0.25 for both presets, changing only transparency/opacity, with no environment reflections. This made their surfaces look similar in the dark scene.

### Floating camera window

`WebcamPreview.tsx`, `useFloatingPanel.ts` and `panelLayout.ts` add bounded header dragging with pointer capture, corner resizing, minimize/expand, maximize/restore and reset. Position, full size and minimized state are stored in `holobuild.gesture-window.v1`. Malformed or inaccessible storage falls back safely. A ResizeObserver clamps the window inside the viewport when the workspace shrinks; toolbar and inspector lie outside its parent bounds.

The minimized 54 px bar shows camera status and recognized gesture. Video, MediaPipe tracker and landmark stream stay mounted; hiding the body or preview never calls Stop. Start/Stop remain explicit controls after expansion. Existing hidden-browser-tab cleanup still releases the camera. Drag/resize handles support Arrow keys (10 px) and Shift+Arrow (40 px), with focus indicators; window buttons remain in keyboard order. Pointer/wheel events are contained by the panel. Starting a window drag/resize uses the existing mouse-takeover cancellation path, clearing any active gesture preview without committing or stopping tracking; a held pinch cannot restart it. Camera/model permission is never persisted or automatically restarted on reload.

### Existing material presets

`materialPresets.ts` keeps saved IDs `solid` and `glass` and leaves object color separate. `BuildingObject.tsx` now applies MeshPhysicalMaterial:

- Satin metal: roughness 0.38, metalness 0.65, opaque, transmission 0, modest clearcoat.
- Holographic glass: roughness 0.07, metalness 0, transmission 0.65, opacity 0.55, thickness 0.3, IOR 1.45 and stronger clearcoat/reflections. Transparent depth writes are disabled to reduce opaque-looking layering.

`StudioEnvironment.tsx` generates a procedural RoomEnvironment/PMREM reflection map locally and disposes its resources on teardown. It does not download an HDR asset or replace the dark background/grid. The workspace ground uses a lit, nonreflective Lambert material to retain its dark appearance; Three.js applies the scene environment globally to standard materials, so a per-material intensity override was insufficient. Reduced idle emissive light allows optical differences to show; target hover feedback remains. Both presets apply to every shared primitive mesh. Existing preset selection, undo/redo and save/load commands are unchanged.

### Acceptance gate

Physical webcam testing of this refinement is pending user confirmation. Test moving/resizing/minimizing/restoring the window while tracking; confirm camera indicator and gesture construction continue. Compare both presets on curved and flat primitives, then Undo/Redo and save/load. Milestone 6 remains unstarted until these refinements are tested and approved.

Limitations: glass is a stylized single-mesh physical preset rather than a full optical simulation; transparent intersections can exhibit sorting artifacts. Layout recovery clamps to the available workspace and may reduce a previously larger window. Small windows scroll their controls; hiding/minimizing saves visual space but does not reduce inference cost. Existing conservative collision and fixed-height gesture-motion limits remain.

### Modified files

Camera UI/layout: `src/components/camera/WebcamPreview.tsx`, `panelLayout.ts`, `useFloatingPanel.ts`, and `src/styles/index.css`. Rendering/presets: `src/scene/materialPresets.ts`, `src/components/viewport/BuildingObject.tsx`, `StudioEnvironment.tsx`, and `Scene.tsx`. UI gesture conflict coordination: `src/components/viewport/GestureInteraction.tsx`. Tests: `tests/unit/refinements.test.ts`, `tests/e2e/refinements.spec.ts`, `camera.spec.ts`, and `editor.spec.ts`. Documentation: this file, README, ARCHITECTURE and MANUAL_TESTS.

### Final verification

On the actual Desktop checkout (2026-10-15): **TypeScript passed; ESLint passed; all 42 unit tests passed; all 31 serial Edge/Playwright browser tests passed (3.5 minutes); production build passed.** Final material and floating-window screenshots were visually inspected, including the restored dark ground and clearly different cube/sphere/floor materials. The suite covers all six shapes, preset appearance changes, exact material-history increment, color preservation, Undo/Redo and JSON persistence; mouse/keyboard drag/resize, minimize/expand, maximize/restore, reset, storage reload and responsive clamping; minimized gesture construction and safe active-grab cancellation when dragging the panel; real MediaPipe execution on synthetic video with live tracks/playback while minimized/hidden, followed by explicit Stop; and all earlier gesture/editor regressions.

The initial browser run revealed two test assumptions (partial accessible-name matching and expecting a history entry from a no-op cube import); these were corrected without altering production commands. Final complete tests passed after the material-ground correction. Existing large-bundle and third-party Zod annotation warnings remain non-blocking. HTTP returned 200 at **http://127.0.0.1:5175/**. Save the stable checkpoint as `feat: milestone 5.1 floating gesture window and distinct materials`. No physical webcam retest is claimed; user acceptance remains the next step. Milestone 6 has not started.

## Milestone 5.1 physical acceptance — 2026-10-15

The user personally confirms successful real-webcam testing on `9d44964`: floating drag/resize, minimize/restore with active tracking, visibly distinct material presets, material Undo/Redo and save/load, all six shapes, one-hand point/pinch/grab/move/release, no unwanted popup, and mouse/scene controls. This is user-reported physical acceptance, not inferred from automation. Revalidation passed TypeScript, ESLint, 42 unit tests and build. A Playwright clock initialization race was corrected in the test helper only (the pause target had become past during slow startup); production thresholds/debounce were not modified. The full baseline browser rerun is verified before saving this acceptance checkpoint. The user explicitly authorizes Milestone 6 advanced hand interactions.

## Milestone 6 progressive implementation — 2026-10-15

Accepted baseline `0186b63` records the user's physical confirmation of Milestone 5.1 and revalidated 42 unit/31 browser tests. Production gesture thresholds, hysteresis and dwell were retained. A test-only clock initialization race was fixed before the baseline checkpoint.

Phase 1: MediaPipe requests up to two hands. Spatial assignment retains IDs across result-array order changes, resets identity on loss/large discontinuity, and reports close/overlapping wrists as ambiguous. Each hand owns its existing detector and time-based smoother. The primary one-hand stream remains compatible with earlier fixtures and controllers; loss/replacement emits cancellation rather than silently handing off a grabbed object. Skeleton feedback uses stable-ID colors. Verified 45 unit tests, source checks/build and 12 focused browser cases (including real MediaPipe execution with synthetic video and one-hand construction).

Phase 2: explicit Two-hand scale mode requires a selected object and both pinches first open, then held closed. Initial distance and original scale are captured once. Uniform factors are smoothed and bounded so every component stays within 0.1–20. Preview uses shape-aware ground/bounds/collision validation and the existing shared command system; release confirms once, and missing/changed/ambiguous/stalled hands, mouse takeover or scene edits cancel. Verified 50 unit tests, source checks/build and 11 focused browser cases.

Phase 3: explicit Two-hand yaw rotation mode uses the mirrored inter-hand line angle, width-normalized image coordinates and incremental angle unwrapping. It rotates only world Y, with time-based smoothing and optional sensitivity. Scale is unchanged in rotation mode; mode changes cancel rather than repurpose active operations. Verified 53 unit tests, source checks/build and four focused advanced browser cases. These checks are simulated landmarks through the real scene controller, not physical webcam acceptance.

Phase 4: gesture menu activation is opt-in and disabled by default. It requires one stable open palm for an additional 1.2 s, a 4 s menu cooldown, and a neutral 500 ms rearm after manipulation (with a 2 s manipulation guard). Pinch release into an indefinitely held palm cannot open it. A pinch confirms a card; mouse Help/cards remain available. Tools include Move, Scale and Rotate, and menu layering keeps cards accessible above the floating camera. Verified 55 unit tests, source checks/build and 14 focused browser cases, including repeated-palm and opted-in release prevention.

Phase 5: dedicated One-hand camera pan mode requires open pinch then a deliberate pinch. Smoothed hand motion pans the existing camera/OrbitControls target in the screen plane with adjustable sensitivity and bounded movement. Release retains the view without object-history entries, matching mouse orbit behavior. Lost/ambiguous/changed/stalled input, mode changes, mouse takeover or scene edits restore the starting camera view. Verified 57 unit tests, source checks/build and seven advanced browser cases, including actual camera projection changes, restoration and mouse orbit fallback.

Phase 6: a lightweight viewport HUD reports tracked hand count, mode, active status, relative scale factor and unwrapped yaw angle even when the camera window is minimized. A colored guide connects the two pinch reference points; ambiguity/invalid placement turns the line red. Diagnostics report each stable hand ID, gesture and pinch ratio, with model handedness scores labelled as handedness rather than invented detection confidence. Help and mode-specific instructions explain enabling advanced controls. Rotation uses quaternion pre-multiplication around world Y, including already tilted objects. Added coverage for rotated wall collisions, off-screen hands and scaling/grounding/save-load on every primitive. Mouse/UI dragging suppresses automatic palm activation until neutral rearm, and scale/rotation previews use the same snapping as their shared commit.

### Milestone 6 architecture and limitations

New `vision/handRecognizer.ts` and `handsStream.ts` extend the existing local MediaPipe → smoothed landmarks → gesture streams. The legacy primary-hand stream remains the one-hand controller's input. `interaction/twoHandMath.ts`, `twoHandController.ts`, `navigationController.ts`, `gestureMenuController.ts` and `advancedStore.ts` isolate deliberate modes and interaction state. Object transformations remain transient `sceneStore.preview` fields until one shared `execute(update)` command succeeds. There is no second scene system. Camera navigation changes view state, not persisted objects. Existing mouse controls, six primitive schemas, material presets, floating layout, serializer and undo manager remain in use. No voice or LLM work was started.

Stable IDs are spatial continuity heuristics, not biometric identities. They reset on loss; close/crossing wrists, >250 ms gaps, large jumps and outside-view cursors cancel operations safely. Rapid crossing/occlusion can prevent a gesture; reacquire separated hands and open pinches before retrying. One-hand mode preserves the first tracked primary hand while it remains visible; a primary replacement cancels rather than transferring an active grab. Two-hand reference distance must be at least 0.08 normalized image-width units at capture. A rotation also cancels when pinch references become too close to define a stable angle. Only uniform scale and world-Y rotation are inferred; pitch/roll and unrestricted 3D hand orientation are not inferred. Existing conservative AABB collision can reject close curved/rotated shapes, and automatic stacking is still absent. CPU inference now handles up to two hands and requires physical performance testing on the laptop.

A valid, changed scale/rotation release commits one history entry; exactly unchanged transforms are no-ops. Release of either stable pinch confirms the last frozen valid preview while both tracked identities remain present; disappearance cancels instead. Scale bounds apply to all original scale components (0.1–20). Grounded objects stay grounded; elevated/on-floor objects do not automatically stack or reposition vertically. Invalid final previews are cancelled. Snap-enabled off-grid imports preview the same snapped X/Z position that the command commits. Pan uses one hand only; a second hand cancels navigation, and camera movement is bounded above ground/in the workspace. Navigation release retains its view; loss restores it. Mouse takeover and scene edits cancel all uncommitted operations.

Advanced mode and palm-menu opt-in start in safe Move/off settings on reload. Palm activation requires a stable recognized palm for 1.2 s, plus neutral rearm after manipulation/UI drag (2 s guard + 500 ms neutral) or menu closure (4 s cooldown + 500 ms neutral). Held palms and pinch release cannot rearm it. Detection confidence is unavailable; model handedness confidence is shown only under its proper label. Final physical Milestone 6 acceptance remains pending user confirmation.

### Final Milestone 6 verification and changed files

Final validation on the actual Desktop checkout (2026-10-15): **TypeScript passed; ESLint passed; all 67 unit tests passed; all 40 serial Edge/Playwright browser tests passed (5.1 minutes); production build passed.** The rendered two-hand scale preview/guide/HUD with minimized camera was visually inspected. Coverage includes identity reordering/loss/ambiguity, independent pinch recognition, uniform component limits, scaling/rotation calculations and angle wrap, tilted-object world-Y orientation, both transform mode isolation and cancellation, snapped preview/commit agreement, rotated collision rejection, all-six-shape scale/ground/JSON history, actual camera pan and restoration without object edits, opted-in menu dwell/cooldown/neutral rearm/release/UI suppression, deliberate pinch card confirmation, and every prior one-hand/editor/material/floating-panel/camera regression. Real MediaPipe executes on synthetic video; advanced physical webcam performance and accuracy are not claimed.

Modified/new files: `vision/handTracker.ts`, `landmarkStream.ts`, `gesturePipeline.ts`, `handRecognizer.ts`, `handsStream.ts`; `interaction/advancedStore.ts`, `twoHandMath.ts`, `twoHandController.ts`, `navigationController.ts`, `gestureMenuController.ts`, `intentMapper.ts`, `interactionStore.ts`; `scene/sceneStore.ts` (optional transient preview transforms); `components/viewport/GestureInteraction.tsx`; `components/camera/WebcamPreview.tsx`, `HandLandmarkOverlay.tsx`; `components/ui/AdvancedGestures.tsx`, `HandGuides.tsx`, `GestureCursor.tsx`, `GestureDiagnostics.tsx`, `GestureMenu.tsx`, `InteractionStatus.tsx`; `App.tsx`, styles and dev-only test bridge; new advanced/hands/menu/navigation unit fixtures/tests and advanced browser tests; README, DEVELOPMENT, ARCHITECTURE, GESTURES, MANUAL_TESTS and ROADMAP. The accepted detector/calibration, one-hand controller, shared command manager/serializer, primitive definitions, material presets and floating-layout implementation are unchanged.

The existing large-bundle and Zod annotation build warnings remain non-blocking. Save the verified functionality as `feat: milestone 6 advanced hand interaction`. Vite remains running at **http://127.0.0.1:5175/** for the user's acceptance test. See MANUAL_TESTS for exact scaling, rotation, menu and navigation steps. No voice/LLM integration or subsequent milestone was begun.

## Milestone 6.1 — adaptive workspace layout — 2026-10-15

Recovered the clean Desktop project at `496de70` before making targeted changes. The default layout now docks Gesture Input above Object Inspector on the left, preserves the 3D canvas in the center, and places Construction Tools on the right. Both sidebars have pointer/keyboard width separators, collapse controls and remembered expanded widths. Collapsing actually releases center space. The right icon rail retains all six creation buttons, four mouse transform tools and grid snapping; accessible names and tooltips remain available.

The left split divider allocates camera/inspector height independently. Each body scrolls without scrolling its neighbour. Camera and inspector minimize to compact headers and restore their expanded allocation. Gesture Input can undock, move, resize, maximize/restore, reset and redock. The same camera component, video element and tracker remain mounted through docking, minimizing, hiding and sidebar collapse. Only the existing Stop, hidden-tab and error lifecycle paths stop capture. Camera preview size follows available panel width; controls remain in an independently scrollable body.

Gesture Diagnostics is a separate floating window with pointer capture, arrow-key move/resize, minimize/expand, close and a visible header reopening control. It retains real primary/per-hand gesture, candidate, pinch thresholds/latch/dwell state, selectable ray hit, target, transaction/rejection, tracking, handedness metadata and advanced mode/factor/angle readings. Detection confidence remains explicitly unavailable. Diagnostics defaults to a compact bar over the viewport rather than covering construction tools. It stays mounted when hidden.

### Layout architecture and persistence

`src/workspace/WorkspaceLayout.tsx` owns docking and responsive composition; `ResizeHandle.tsx` provides accessible pointer/keyboard separators. `layoutStore.ts` stores UI preferences separately from scene commands/history and validates storage field types/ranges. CSS Grid and Flexbox resize the canvas's parent; the existing R3F ResizeObserver updates render dimensions and camera aspect without remounting the scene. No rendering/gesture dependency was added.

`holobuild.workspace.v1` stores sidebar widths/collapse state, camera height/minimized/docked state, inspector minimized state and diagnostics visibility. The extended existing floating hook stores camera geometry in `holobuild.gesture-window.v1` and independent diagnostics geometry/minimized state in `holobuild.diagnostics-window.v1`. Corrupt or disabled storage falls back safely. Viewport shrink clamps floating windows; sidebar and split preferences retain the desired expanded size for later recovery. Reset Workspace Layout restores all three layouts without clearing scene objects, history or camera capture.

Below 780px, compact rails reserve minimal width and mutually exclusive overlay drawers open on demand. A fresh layout starts with drawers closed; the chosen mobile drawer is then remembered independently of desktop collapse preferences. Expanding a rail always reveals its controls. Footer instructions update by hand count/mode in a single right-aligned line with ellipsis and a full accessible label/tooltip. Camera status messages are compact; detailed instructions remain in Help. Pointer/keyboard layout manipulation and layout reset reuse mouse takeover to cancel uncommitted previews and suppress accidental palm activation. Recognition thresholds, debounce, hand identity logic, raycasting, shared scene commands, geometry/materials and serializer were not changed.

### Verification and acceptance

Final verification on the actual Desktop checkout: **TypeScript passed; ESLint passed; all 71 unit tests in 11 files passed; all 51 serial Edge/Playwright browser tests passed (6.1 minutes); production build passed; Git whitespace checks passed.** Desktop and mobile screenshots were visually inspected. The 11 new browser cases cover default topology, independent scrolling, pointer/keyboard side/split resizing and canvas response, compact construction rails, camera docking/minimizing with gesture movement, diagnostic move/resize/minimize/hide/reopen, persistent layout/reset, corrupt-storage recovery, small-screen controls and remembered drawers, safe cancellation during layout manipulation/reset, and live synthetic camera continuity through docking/collapse/reset. Earlier one-hand/two-hand gestures, mouse editing, all six materials/shapes, Undo/Redo and JSON persistence also passed.

Regression checks caught an overbroad UI guard applying palm-menu cooldown to its settings checkbox and a small-screen diagnostics default covering camera controls. The guard was narrowed to layout handles/headers, and the small-screen default moved lower. A case-sensitive test selector was corrected. No recognition thresholds or classification/debounce algorithms were modified. Real MediaPipe/model-video tests use synthetic capture and reproducible landmark sequences; they do not establish physical webcam reliability. Existing large 3D bundle and third-party Zod annotation build warnings remain non-blocking. Vite returns HTTP 200 at **http://127.0.0.1:5175/**. Stable checkpoint message: `feat: milestone 6.1 adaptive workspace layout`.

Physical Milestone 6.1 testing is pending the user's confirmation. Milestone 6 advanced physical acceptance also remains unconfirmed. Test docking/scrolling/resizing/collapse while tracking, then one-hand grab/move/release/Undo and explicit two-hand scale/yaw. No Milestone 7, voice or LLM work was started. Existing conservative collision, stylized transparency, hand-crossing cancellation, CPU inference and bundle-size limitations remain. Narrow camera bodies require scrolling to reach advanced options; floating windows are constrained to the application workspace between header and status bar.

Changed files: `src/App.tsx`, `main.tsx`; new `src/workspace/{WorkspaceLayout,ResizeHandle,CompactHint}.tsx`, `layoutStore.ts`, `workspace.css`; `components/camera/WebcamPreview.tsx`, new `WebcamPreview.css`, `useFloatingPanel.ts`; `components/ui/Toolbar.tsx`, `AdvancedGestures.tsx`, `GestureDiagnostics.tsx`, new `GestureDiagnostics.css`; UI takeover wiring in `components/viewport/GestureInteraction.tsx`; new unit/browser workspace tests and adapted advanced/construction/refinements browser selectors; README, ARCHITECTURE, MANUAL_TESTS, ROADMAP and this log.

## User acceptance and Milestone 7 audit — 2026-10-15

The user confirms Milestones 6 and 6.1 are complete, specifically that two-hand scaling and rotation work with their real webcam and the adaptive layout is completed. This is user-reported physical acceptance, not inferred from automation. Baseline `3a17377` is clean and already preserves the complete system. Audited the scene schema, factory, snapshot command/history system, serializer, primitive renderer, PBR presets, local PMREM environment, inspector, placement bounds and gesture adapter before Milestone 7. No recognition thresholds or calibration changes are planned. Implementation proceeds through material presets, procedural textures/inspector, lighting, then integrated model import/persistence. Voice/LLM and Milestone 8 remain unstarted.

## Milestone 7 — materials, lighting and model assets — 2026-10-15

Recovered existing partial material edits without discarding changes. `d66293e` preserves that initial material stage after TypeScript, ESLint, 73 unit tests and production build passed; the physically accepted Milestone 6/6.1 baseline remains `9c7126e` / `3a17377`. Subsequent work extends the same object schema, command manager, history snapshots, factory/bounds, R3F renderer and serializer. No gesture threshold, calibration, dwell, recognition, hand identity or controller transaction logic was changed.

### Materials and textures

Nine physical presets: matte plastic, glossy plastic, satin metal (legacy `solid` ID), polished metal, glass (legacy `glass` ID), holographic, wood, brick and concrete. The original two IDs and optical values stay compatible. Presets vary roughness, metalness, clearcoat, transmission, opacity, environment response and emission. Holographic surfaces blend toward cyan, keep bright selection/hover outlines and animate subtle scan/rim highlights in the material shader without bloom or extra render passes. The emission control also governs animated highlights. Visual inspection found studio reflections washing out the holographic tint; its preset now uses restrained environment/specular response and bypasses tone mapping, confirmed by inspecting real compiled shader uniforms and rendered output.

Original deterministic 256×256 procedural wood grain, brick/mortar, concrete and brushed-metal maps are shared by the scene. They have no third-party licensing or runtime asset dependency. Mipmapping, repeat wrapping and modest anisotropy control aliasing. Blended triplanar projection uses scaled object-space positions in metres, so floors, walls, nonuniform object scaling and baked imported geometry keep texture density rather than stretching one UV image. Texture repeats/metre are adjustable from 0.25 to 8. Base color multiplies texture color; use white for native wood/brick colors. Curved surfaces blend projections and can soften grain/mortar at projection transitions. These are lightweight procedural approximations, without physically measured texture scans, displacement or detailed normal maps.

The inspector shows applicable roughness, metalness, opacity, emission and repeat controls. Finite numeric ranges are validated by Zod, every material edit/reset goes through `execute(update)`, and snapshot Undo/Redo preserves the complete surface overrides. Switching presets clears old overrides while preserving base color; reset restores optical/repeat defaults while preserving color. Imported models retain original PBR materials initially. Selecting a preset or changing the surface color explicitly overrides them; the original-material checkbox restores the imported surfaces. Shared model geometry and original materials are not mutated by inspector edits.

### Lighting

The existing local RoomEnvironment/PMREM reflection studio remains; no HDR download is required. Construction Tools exposes ambient, directional key, optional fill (zero disables), reflection intensity and shadow controls, plus reset. One 1024² key shadow map serves the central 32 m studio region; distant construction is still lit but may lie outside that shadow region. Lighting preferences are validated and remembered under `holobuild.lighting.v1`, and project JSON optionally includes lighting. These are rendering/view preferences outside object Undo/Redo. Scene object material edits remain fully undoable. The dark grid and UI palette remain intact.

### Model import and project portability

Import 3D Model accepts glTF 2.0 `.glb` or `.gltf`; use multi-select to include local BIN and PNG/JPEG/WebP dependencies. Embedded buffers/images are supported. Relative dependency paths resolve by unique filename; do not select two dependencies with the same filename. Missing files, traversal and remote URL references are rejected before loading, rather than fetching external content. Importing camera/light nodes or playing animation is outside this milestone: static mesh geometry and original PBR surfaces from the default scene are imported. Skinned, morph-target and GPU-instanced content is explicitly rejected; export a static mesh. Draco, Meshopt and KTX2 compression require decoders and are explicitly unsupported.

The GLTFLoader chunk loads on demand. A content SHA-256 identifies each immutable asset bundle. Geometry is baked through node transforms (including mirrored winding), centered and normalized so its longest dimension is 2 m. Stable object UUIDs reference asset IDs and local bounding dimensions. Models use the shared import/update/duplicate/delete commands, transform gizmos, snapping, placement validation and history. Selection and collisions use conservative transformed bounding boxes; gesture previews show those boxes, and original geometry is hidden during an active preview. Concave holes and empty parts of a bounding box are selectable and can cause conservative collision rejection. One-hand planar movement and explicit two-hand scale/yaw use exactly the existing controllers.

Asset bundles are stored in IndexedDB `holobuild.assets` (`models` object store). `holobuild.scene` contains only small scene/lighting metadata with explicit IndexedDB references when models exist. Restore local project rehydrates those assets after a page reload. Browser storage is tied to the origin (including hostname/port) and can be cleared or denied by the browser; successful imports require the asset write to complete. Disk-cache records persist beyond scene deletion so saved local references remain usable. Browser storage settings can remove that cache; keep exported project files as backups.

Save project exports self-contained version-1 JSON with the referenced model bundle bytes encoded as base64. Opening that file on another origin/browser reloads and validates its assets before replacing the scene. Legacy primitive-only version-1 JSON remains supported. Missing assets, bad checksums, mismatched geometry bounds, invalid values and storage failures produce explicit errors; a failed load/import preserves existing scene objects and history. Models are never silently omitted. Concurrent import/load attempts are rejected with a wait message so asynchronous asset transactions do not race. Project-load lighting is applied only after successful object replacement.

### Budgets and resource lifetime

Limits: 10 MiB and 64 files per model bundle; 20 MiB of asset bytes per project; 30 MiB JSON; 250,000 triangles and 256 meshes per model; 4096 pixels per texture side and 16×1024² texture pixels per model. Input accessor counts are bounded before parsing. The retained model cache is bounded to 50 MiB of source bytes and an estimated 128 MiB of geometry/texture GPU data, including resources needed by Undo/Redo. These estimates are allocation guards, not measured driver memory. If history retains too many models, save and reload the page before importing more.

Duplicate models share immutable geometry, original materials and textures. Resources stay alive while current scene or either history stack references them (history remains limited to 80 snapshots), then geometries/materials/textures are disposed and image bitmaps closed. Temporary dependency object URLs are revoked; replaced R3F surface materials are disposed. The four procedural maps have bounded scene lifetime and dispose when their provider unmounts; generated pixel buffers are about 1 MiB before mipmaps. Webcam inference subscriptions and component lifetime remain independent of material/lighting edits. No physical FPS or latency measurement is claimed; serial Edge tests use software WebGL and synthetic landmark input. Real laptop performance and physical Milestone 7 acceptance remain for the user.

### Verification

Progressive validation: material stage 73 unit tests; texture/inspector stage 75 unit tests plus six rendered shape/material regressions; lighting stage 76 unit tests and build; initial model stage 81 unit tests and eight passing import/asset/gesture browser cases. The ninth browser case revealed a missing favicon request, fixed with a local SVG while retaining strict console checks. Final full-suite results are recorded below after completion. Tests additionally inspect actual Three.js material parameters, generated texture repeat/disposal, mirrored model baking, checksum failures, simultaneous-operation rejection, portable project loading in a fresh browser context and existing layout/camera/gesture regressions. No physical webcam verification for Milestone 7 is claimed, and Milestone 8 remains unstarted.

Modified areas: `scene` material/schema/factory/serializer/commands and new lighting/surface/texture modules; new `assets` validation, IndexedDB, loader, registry and project I/O modules; inspector, toolbar, lights/environment, shared object/preview rendering, new model/import/material components; App save/load; development-only renderer inspection seam; theme-consistent control styles and local favicon; model/material fixtures and unit/browser regressions; DEVELOPMENT, ROADMAP, ARCHITECTURE, MANUAL_TESTS and README.

### Final Milestone 7 validation and checkpoint

On the actual Desktop checkout: **TypeScript passed; ESLint passed without warnings; all 83 unit tests in 14 files passed; production build passed.** The complete **61-test serial Edge/Playwright suite passed (8.6 minutes)**. After adding a local PNG dependency/original-material restoration regression and refining holographic appearance, **all 11 focused Milestone 7 browser cases passed (1.7 minutes)**. The final diagnosed holographic reflection adjustment was followed by another complete source/unit/build run and **both rendered-material cases passed (22.5 seconds)**. Thus all 62 distinct current browser cases have passing coverage across the full run and final focused reruns; the last adjustment affects the holographic preset only. The full 62-case suite was not redundantly rerun after that adjustment.

Actual rendered scene screenshots were visually inspected, including the six-shape material showcase, metallic environment reflections, procedural textures, holographic surface, imported models and original local PNG surfaces. The development seam verifies actual Three material roughness, not just store labels; the final shader diagnostic also inspected real cyan diffuse/emission uniforms and compiled scan highlights. Asset tests cover GLB, embedded GLTF, GLTF+BIN, GLTF+BIN+PNG, reload through IndexedDB and a portable export opened in a fresh browser context. Mouse, one/two-hand simulated manipulation, history, layout and synthetic live MediaPipe regressions passed. No physical webcam retest is claimed for Milestone 7.

Existing large-main-bundle and third-party Zod annotation build warnings remain non-blocking. Exact build/resource observations are in PERFORMANCE.md; no physical FPS/latency benchmark is invented. Vite remains on **http://127.0.0.1:5175/**. Save the verified checkpoint as `feat: milestone 7 materials lighting and model imports`. Follow MANUAL_TESTS.md for physical acceptance. No push/deployment, voice/LLM integration or Milestone 8 work was performed.
