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
