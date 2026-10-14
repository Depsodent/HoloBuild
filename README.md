# HOLOBUILD

**Gesture-Controlled 3D Spatial Construction Environment · Made by Aaryan**

A local-first React/TypeScript construction editor for an AI/ML engineering portfolio. The project is developed in validated milestones. See [development progress](docs/DEVELOPMENT.md) for exact verification status; physical webcam results are never inferred from automated tests.

## Run on Windows

Node 22.12+ or 24 LTS is recommended. In this directory:

```powershell
npm.cmd ci
npm.cmd run setup:vision
npm.cmd run dev
```

Open the Local URL printed by Vite (normally http://127.0.0.1:5173). The app does not need an LLM API key. Camera access requires localhost or HTTPS and explicit user permission.

`setup:vision` copies the installed MediaPipe 1.1 runtime and downloads the official version 1 hand model once, verifying SHA-256. The generated assets are ignored by Git but included in the production build. After setup, tracking needs no external asset requests. Start camera explicitly; Stop releases the webcam and model. Hiding the preview does not stop tracking; hiding the browser tab does. Select a camera while stopped when multiple devices are available.

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

## Gesture construction (Milestone 4)

1. Click **Start camera**, allow access, and keep one hand clearly visible.
2. Extend your index finger; the other fingers may be relaxed. The mirrored cursor follows your index fingertip. Point at a cube until it highlights.
3. Pinch thumb and index together briefly to grab. Move your hand while holding the pinch. A ghost cube previews the snapped position; the original remains unchanged.
4. Separate thumb and index to place; relaxed fingers are supported. A valid move creates one undo entry; a stationary grab creates none.
5. Hand loss, stalled tracking, leaving the viewport, a large tracking jump, a fist, an invalid release, or another scene edit cancels the pending move. Mouse pointer-down in the viewport takes back control.

Movement uses a camera ray intersecting a horizontal plane at the cube's existing height. It is **not free-space depth tracking**. Snapping affects X/Z at 0.5 m increments. Preview turns red for conservative bounding-box overlap, below-ground placement, or positions beyond ±50 m. Vertical dragging, automatic stacking, and precise rotated-shape collision are future work. Mouse inspector/gizmo transforms retain their existing numeric validation and do not yet share these gesture-specific collision restrictions.

Click Help → Open gesture tools to open the tool menu. Open palm never opens it automatically. Point and pinch a card to create a cube, undo, or close; mouse clicks also work. Rotation and scaling are available through mouse tools, not hand gestures yet.

For repeatable development tests, `?testInput` enables a clearly labeled synthetic landmark bridge. It exists only in Vite development mode. Automated fixtures exercise actual raycasting and commands; they do not establish physical hand-tracking accuracy. See [manual acceptance tests](docs/MANUAL_TESTS.md).

To run the browser suite with installed Edge against an existing server:

```powershell
$env:PLAYWRIGHT_CHANNEL='msedge'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5175'
npm.cmd run test:e2e
```

## Architecture

React 19 and React Three Fiber 9 render the editor. Drei supplies camera, grid and transform helpers. Zustand owns serializable scene state. Zod validates commands and imports. The command manager is the only path that commits object changes; the renderer never owns persistent transforms. See [architecture](docs/ARCHITECTURE.md), [gesture design](docs/GESTURES.md), [performance](docs/PERFORMANCE.md), and [roadmap](docs/ROADMAP.md).

External references: [React Three Fiber installation](https://r3f.docs.pmnd.rs/getting-started/installation), [MediaPipe Hand Landmarker for Web](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js).

Developer: **Aaryan** · GitHub: **Depsodent**. Local development checkpoint; no public deployment or connected AI service is claimed.
