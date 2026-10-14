# Implemented architecture

```mermaid
flowchart TD
  Mouse[Mouse / Inspector] --> Commands[Validated scene commands]
  Camera[Webcam] --> Vision[Local MediaPipe pipeline]
  Vision --> Interaction[Gesture state / raycast interaction]
  Interaction --> Commands
  Commands --> Store[Zustand scene store]
  Commands --> History[Bounded snapshot undo/redo]
  Store --> Renderer[React Three Fiber / Three.js]
```

## Foundation

`scene/objectTypes.ts` defines the persisted object schema: UUID, name, cube geometry, position, Euler rotation in radians, scale, color and material. Numeric positions/rotations must be finite and within ±100; scale is 0.1–20. `commandManager.ts` clones the current scene, applies one command, validates the whole result, and commits atomically. A rejected command changes status only. At most 200 objects are allowed, with unique IDs.

History retains up to 80 snapshots. This favors understandable, reliable reversal over memory efficiency. Each transform handle commits on release, not on every mouse movement. A fresh command clears redo. Selection/tool changes do not pollute history. Scene JSON has a version field; oversized, malformed, incompatible, or duplicate-ID files are rejected before mutation.

`BuildingObject.tsx` renders controlled scene data and temporary Drei transforms. Mouse-up turns the final transform into a command. `Scene.tsx` contains a perspective camera, orbit controls, lights, shadow-receiving ground and grid. An edge overlay communicates selection without postprocessing overhead. Inspector angles display degrees but store radians.

The shell subscribes only to scene fields it displays, so transient gesture previews do not rerender the whole application. Raw camera landmarks and full-rate gesture frames live in module streams outside React. The cursor updates its DOM position through a ref; only the ghost renderer observes transient preview state. Performance counters update at 1 Hz.

## Gesture interaction

`coordinateMapping.ts` maps mirrored screen coordinates to normalized device coordinates: `(2x−1, 1−2y)`. `raycasting.ts` uses the current Three.js perspective camera to select the nearest construction mesh, filtering by its object ID. The same ray intersects a horizontal plane through the grabbed cube's center. A captured grab offset prevents a jump when the cursor first grabs an off-center point.

`GestureController` requires an observed open pinch before accepting a debounced pinch edge. Strict pointing classification is not required. A recent actual ray hit is retained for at most 500 ms and 0.08 normalized cursor displacement during closure. Its grab session owns only object ID, height and offset. Subsequent stable pinches compute a candidate position and update transient preview state. They never change persisted object transforms. Debounced thumb/index release, independently of other finger pose changes, revalidates placement and calls `placeObject`, which routes through the same validated `execute(update)` command as the mouse inspector. Only that commit enters history. A fist release cancels; an ambiguous relaxed pose can place. UI overlays and mouse pointer-down cancel active grabs. A held pinch cannot restart a cancelled operation.

`placement.ts` snaps X/Z then transforms a unit cube's bounding box by its scale, rotation quaternion and translation. Axis-aligned bounds provide conservative overlap checks with 0.02 m tolerance; touching is permitted. Rotated cubes may be rejected even when their actual surfaces do not touch. Ground and ±50 m position limits apply to gesture placement. This is deterministic construction validation, not physics.

The renderer subscribes to gesture frames and cancels a grab on missing/invalid points, inactivity beyond 250 ms, viewport departure, scene/selection/tool changes or mouse pointer-down. On a scene edit, cancellation is checked even if that edit already cleared the preview. Grab setup changes selection/tool before opening the transaction, so its own setup is not mistaken for an external edit. Orbit controls are disabled only during a gesture grab.

Only Help → Open gesture tools opens the DOM tool menu; open-palm recognition has no menu side effect; pointer coordinates identify a card, and a later point/pinch edge invokes its shared command. High-frequency gesture inference remains independent of any future AI parser.

## Milestone 5 construction architecture

`objectTypes.ts` declares the six supported primitive types; `objectFactory.ts` owns their display names and base dimensions. `ObjectGeometry` is reused by real meshes and the gesture ghost, so render/pick/preview shapes agree. Stable object IDs and the existing raycaster work for every type. Recognition, thresholds, debounce, closure retention and Help-only menu activation are unchanged.

`placement.ts` computes world bounds from primitive dimensions, rotation and nonuniform scale. Boxes use transformed corners; spheres use ellipsoid support extents; cylinders use radial/axial support; cones use base-disc/apex support. Collision uses overlapping world AABBs with 0.02 m tolerance, so it is conservative rather than exact mesh intersection. Ground and ±50 m limits apply to whole bounds. Touching surfaces are permitted.

The existing `execute` create/update/duplicate commands now use that same validator. Creation/duplication search deterministic nearby grid positions. A rejected transform changes neither objects nor history. A mouse gizmo restores its actual mesh from committed state after snapping/rejection. Grounded rotation/scale preserves bottom height; explicit vertical movement is unchanged. JSON remains version 1 with an expanded type enum, preserving old cube scenes. Import validates structure/IDs/types, not collision layout, to avoid destroying legacy scenes.
