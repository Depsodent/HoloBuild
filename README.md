# HOLOBUILD

**Gesture-Controlled 3D Spatial Construction Environment · Made by Aaryan**

A local-first React/TypeScript construction editor for an AI/ML engineering portfolio. The project is developed in validated milestones. See [development progress](docs/DEVELOPMENT.md) for exact verification status; physical webcam results are never inferred from automated tests.

## Run on Windows

Node 22.12+ or 24 LTS is recommended. In this directory:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the Local URL printed by Vite (normally http://127.0.0.1:5173). The app does not need an LLM API key. Camera access requires localhost or HTTPS and explicit user permission.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

## Mouse controls

Create a cube from Construction. Click an object or its scene-list row to select it. V selects, G moves, R rotates, S scales. The inspector edits precise coordinates, degrees, scale and color. Use the 3D handles for mouse transforms. Drag empty space to orbit, right-drag to pan and scroll to zoom. Delete removes the selection. Ctrl+Z undoes; Ctrl+Shift+Z redoes. Save project exports versioned JSON and writes a local copy. Load validates a JSON file before replacing the scene. Reset can be undone.

## Architecture

React 19 and React Three Fiber 9 render the editor. Drei supplies camera, grid and transform helpers. Zustand owns serializable scene state. Zod validates commands and imports. The command manager is the only path that commits object changes; the renderer never owns persistent transforms. See [architecture](docs/ARCHITECTURE.md), [gesture design](docs/GESTURES.md), [performance](docs/PERFORMANCE.md), and [roadmap](docs/ROADMAP.md).

External references: [React Three Fiber installation](https://r3f.docs.pmnd.rs/getting-started/installation), [MediaPipe Hand Landmarker for Web](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js).

Developer: **Aaryan** · GitHub: **Depsodent**. Local development checkpoint; no public deployment or connected AI service is claimed.
