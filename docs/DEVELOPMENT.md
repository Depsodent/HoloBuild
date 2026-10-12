# Development checkpoints

## Environment — 2026-10-12

- Verified Windows Known Folder and registry Desktop: `C:\Users\AARYAN DESHPANDE\OneDrive\Desktop`.
- Created independent Desktop `HoloBuild` folder and opened it in VS Code.
- Node 24.20.0, npm 11.19.0, Git 2.55.0, GitHub CLI 2.102.0, VS Code 1.141.0, Python 3.12.10 detected.
- Installed missing ESLint, Prettier, GitLens and Error Lens extensions. Python/Pylance already present. No global editor settings or machine PATH changed.
- Source prepared in Codex's writable staging folder and copied to Desktop at validated checkpoints. `sources/` remains untouched.

## Milestone 1 — implementation awaiting checks

Implemented the React/Vite/TypeScript foundation, 3D grid/camera/light/cube scene, mouse transform handles, inspector, shared command manager, undo/redo, import/export, keyboard controls and responsive UI. Primary files: `src/App.tsx`, `src/components/viewport/*`, `src/components/ui/*`, `src/scene/*`.

Algorithms: Three.js applies scale, rotation and translation to a unit cube. Transform handles preview locally and commit one validated snapshot on release. Zustand makes the validated scene available to both the UI and renderer. R3F provides declarative mesh lifetime management; Drei avoids rebuilding standard camera and transform controls.

Test: run the README checks, create a cube, orbit, change X, undo, save and reload. Exercise: change the default cube color in `src/scene/objectFactory.ts` and observe new cubes.

Limitations: only cubes; no surface collision/stacking engine yet. Future interaction milestones are not represented as completed.

Milestone 1 verification: typecheck, lint, 3 unit tests, production build, and 3 Edge/Playwright browser tests passed. Screenshot inspected. npm audit: 0 vulnerabilities after upgrading Vitest to 5.0.4. Browser verification required an elevated Vite server on port 5175 because the sandbox-bound port was not reachable. Build reports a large 3D bundle; optimization is deferred until measured.

