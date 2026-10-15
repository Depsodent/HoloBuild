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

Create a cube, sphere, cylinder, cone, wall, or floor from Construction. Click an object or its scene-list row to select it. V selects, G moves, R rotates, S scales. The inspector edits precise coordinates, degrees, scale and color. Use the 3D handles for mouse transforms. Drag empty space to orbit, right-drag to pan and scroll to zoom. Delete removes the selection. Ctrl+Z undoes; Ctrl+Shift+Z redoes. Save project exports versioned JSON and writes a local copy. Load validates a JSON file before replacing the scene. Reset can be undone.

## Materials and imported models (Milestone 7)

The inspector offers matte/glossy plastic, satin/polished metal, glass, holographic, wood, brick and concrete. Relevant optical controls and procedural texture density are undoable. Surface color tints textures; choose white for native texture colors. Construction Tools → Studio lighting adjusts ambient/key/fill/reflections/shadows and restores defaults. Lighting is a persisted view preference, outside object Undo/Redo.

Use **Import 3D Model** for glTF 2.0 GLB/GLTF files. Select local BIN/image dependencies together with a GLTF. Bundles are limited to 10 MiB/250,000 triangles; models normalize to a 2 m envelope and work with inspector/gizmos, one-hand move, two-hand scale/yaw, duplicate/delete and history. Imported PBR materials are preserved until you choose an override. Selection, gesture previews and placement use conservative bounding boxes. Static meshes are supported; skinned/morph/instanced meshes, animation playback, Draco/Meshopt/KTX2 compression and remote references are unsupported.

Imported bundles live in IndexedDB for the current browser origin. **Save project** exports self-contained JSON, including assets, for portability and keeps only small metadata/references in Local Storage. **Restore local project** restores the last local save; changing origin/port or clearing browser storage breaks local references, so retain exported JSON backups. **Load** validates embedded assets before changing the scene. Legacy primitive-only version-1 scenes still load. Project assets are capped at 20 MiB (30 MiB JSON). See [development details and budgets](docs/DEVELOPMENT.md) and [manual tests](docs/MANUAL_TESTS.md).

Milestones 6/6.1 and 7 were accepted by the user. Milestone 7.1 physical-webcam acceptance remains pending; automation does not establish that acceptance. Milestone 8 has not started.

## Reliability and workspace refinements (Milestone 7.1)

Select an object once by mouse or one-hand pinch, then choose Scale/Rotate in **Construction → Gesture Controls**. Each hand can open independently; pinch both within four seconds. Neither hand needs to aim at the object again. If no object is selected in Scale/Rotate, a one-hand pinch can select it without dragging. Status shows waiting/prepared/active states. Release confirms one undoable transform; tracking loss or UI takeover cancels.

Construction, inspector, camera settings/calibration readings and floating diagnostics use independent collapsible groups with keyboard activation and remembered states. Existing dock/minimize/resize and mobile sidebars remain. **Stop Camera is always in the top bar while capture is starting/running**, including with collapsed panels.

Gesture Diagnostics separates renderer FPS, camera presentation FPS, inference/gesture rates and processing timings. Camera settings offer Balanced/Performance/Quality profiles. Default CPU inference uses fresh video frames; an experimental worker path is available while stopped, with fallback when unsupported. Worker rendering can be smoother while tracking becomes slower, so compare actual inference Hz/latency rather than renderer FPS. See [measured tradeoffs](docs/PERFORMANCE.md) and [physical acceptance steps](docs/MANUAL_TESTS.md).

## Gesture construction (Milestone 4)

1. Click **Start camera**, allow access, and keep one hand clearly visible for Move mode.
2. Extend your index finger; the other fingers may be relaxed. The mirrored cursor follows your index fingertip. Point at a cube until it highlights.
3. Pinch thumb and index together briefly to grab. Move your hand while holding the pinch. A ghost cube previews the snapped position; the original remains unchanged.
4. Separate thumb and index to place; relaxed fingers are supported. A valid move creates one undo entry; a stationary grab creates none.
5. Hand loss, stalled tracking, leaving the viewport, a large tracking jump, a fist, an invalid release, or another scene edit cancels the pending move. Mouse pointer-down in the viewport takes back control.

Movement uses a camera ray intersecting a horizontal plane at the cube's existing height. It is **not free-space depth tracking**. Snapping affects X/Z at 0.5 m increments. Preview turns red for conservative bounding-box overlap, below-ground placement, or positions beyond ±50 m. Vertical dragging, automatic stacking, and precise rotated-shape collision are future work. Mouse inspector/gizmo transforms share the same placement validation as gestures. Grounded shapes remain grounded when rotated or scaled in place. New and duplicated objects search for free grid space. Touching surfaces are allowed; colliding transforms are rejected.

Click Help → Open gesture tools to open the tool menu. Open palm activation is disabled by default; the optional advanced setting below enables a deliberate hold. Point and pinch a card to create a cube, undo, or close; mouse clicks also work. Rotation and scaling remain available through mouse tools and the explicit two-hand modes below.

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

## Advanced construction (Milestone 5)

The palette includes six primitives. Base dimensions: cube 1 × 1 × 1 m; sphere Ø1 m; cylinder and cone Ø1 × 1 m; wall 3 × 2 × 0.25 m; floor 4 × 0.2 × 4 m. The inspector scale multiplies those dimensions. Select from the viewport or collection; use V/G/R/S, transform handles, or inspector coordinates. Material, color, duplication, deletion and every committed transform use shared undo/redo.

Grid snapping rounds X/Z translations to 0.5 m; transform handles also offer 15° rotation and 0.1 scale increments. Inspector Y remains precise, including thin floors. To rest a default cube on a default floor, set cube Y to 0.7 m. There is no automatic surface stacking or gravity. Collision is conservative transformed world bounds, not exact mesh contact. Load preserves structurally valid version-1 scenes (including older cube scenes); it does not rearrange overlapping imported objects. Subsequent placement edits validate against the scene.

Milestone 4 physical webcam acceptance was confirmed by the user. Milestone 5 requires a fresh user acceptance test for the additional shapes; synthetic tests do not substitute for that confirmation.

## Floating camera and existing materials (5.1)

Drag the Gesture Input title to move it inside the workspace; drag its bottom-right grip to resize. Minimize/expand, maximize/restore and reset buttons control the window. Layout is saved locally; resizing the browser keeps it reachable. Focus the title/grip and use Arrow keys (Shift for larger steps). Minimizing or hiding the preview keeps capture and hand tracking running. Expand to access Stop camera; changing tabs retains the existing safe camera-stop behavior.

Satin metal is opaque with stronger metallic reflections and moderate roughness. Holographic glass is transmissive/translucent with smoother highlights. The existing object color tints both presets, and material selection remains undoable and stored in scene JSON. Reflections are generated locally; no external environment download is needed.

## Milestone 6: advanced gestures

Start camera; it tracks up to two hands locally. Find **Gesture mode** under **Construction Tools → Gesture Controls**. Existing one-hand move is the default.

- **Scale:** select an isolated object, choose Two-hand scale, open both pinches, then pinch both while keeping hands separated. Apart enlarges; together shrinks. Release to place once; Undo restores the original transform.
- **Rotate:** choose Two-hand yaw rotation. Open then pinch both hands; tilt their connecting line to rotate around world Y. Separation changes do not scale in this mode. Rotation sensitivity is adjustable before grabbing.
- **Navigate:** choose One-hand camera pan. Keep only one hand visible, open then pinch; move to pan, release to keep the view. Hand loss restores the starting view. Pan sensitivity is adjustable. This changes camera view without adding scene-history entries.
- **Menu:** optional **Enable open-palm tool menu** is off by default. After a grab or closing tools, lower your hand or point for about five seconds to reset cooldown/rearm. Then show one steady open palm for about two seconds. Point at a card and pinch to confirm. Help and mouse clicks remain available; uncheck the setting to disable activation.

The HUD and connecting guide remain visible when the camera window is minimized. Lost, overlapping/ambiguous or abruptly changing hands cancel previews; open pinches and reacquire before retrying. Model handedness scores are not tracking-confidence probabilities. Advanced modes/menu opt-in reset on reload, while your camera-window layout stays saved. No real-webcam acceptance is inferred from synthetic regression tests.

## Milestone 6.1: adaptive workspace

Gesture Input and Object Inspector share a resizable left sidebar with independently scrolling bodies. Construction tools are on the right. Drag the sidebar boundaries or left split divider; keyboard arrows resize a focused divider (Shift for larger steps). Collapse controls release more canvas space; the construction icon rail retains shapes, transforms and snapping.

The camera header provides minimize/expand and Undock/Dock. An undocked camera retains drag, resize, maximize/restore and layout reset. These actions keep its existing capture/tracker mounted. Diagnostics has a separate draggable/resizable/minimizable window; close/reopen it with the header waveform button. The adjacent layout button resets all UI layouts without clearing the scene or stopping capture. Geometry and panel preferences are stored locally, with safe defaults if storage is unavailable or corrupt.

Small screens use compact rails and one overlay drawer at a time; the chosen drawer is remembered on refresh. Mode instructions occupy a single footer line, with full text available through its tooltip and Help. Camera controls can scroll within the available panel height. Milestones 6, 6.1 and 7 have been accepted by the user. Milestone 7.1 awaits physical testing; see `docs/MANUAL_TESTS.md`. Milestone 8 is not started.
