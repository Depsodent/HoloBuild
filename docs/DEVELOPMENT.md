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

