# Manual acceptance checklist

Record actual observations and hardware/browser details. Unchecked cases have not been performed.

## Mouse foundation

- [ ] A visible cube, perspective ground grid, colored axes and HOLOBUILD branding appear.
- [ ] Left-drag empty space orbits, right-drag pans, wheel zooms.
- [ ] Clicking a cube selects it; empty space deselects it.
- [ ] Move/rotate/scale handles work; a single undo reverses a complete drag.
- [ ] Inspector axes, name, material and color update the selected object.
- [ ] Duplicate creates an independent ID; delete and reset can be undone.
- [ ] Save downloads a JSON file; Load restores it; malformed JSON preserves the existing scene.
- [ ] Narrow screen layouts remain navigable; keyboard focus indicators are visible.

## Physical webcam acceptance (not automated)

| Condition                         | Expected observation                                         | Actual result |
| --------------------------------- | ------------------------------------------------------------ | ------------- |
| Permission denied                 | Recovery message; mouse editing still works                  | Not tested    |
| Camera started/stopped            | Preview appears; camera hardware indicator turns off on Stop | Not tested    |
| Bright even lighting              | Landmarks follow one hand                                    | Not tested    |
| Dim/backlit setting               | Reduced reliability is visible; no stray committed movement  | Not tested    |
| Left hand / right hand            | Mirrored index cursor follows each hand                      | Not tested    |
| Different hand sizes/distances    | Palm-normalized pinch remains usable                         | Not tested    |
| Fast movement / partial occlusion | Lost hand cancels uncommitted drag                           | Not tested    |
| Pinch, move, release              | One snapped planar move and one undo entry                   | Not tested    |
| Release outside valid workspace   | Invalid preview rejected                                     | Not tested    |
| Palm held briefly                 | No popup, even after pinch release                           | Not tested    |
| Two visible hands                 | Two-hand tracking; explicit scale/rotation modes             | Not tested    |
| Background clutter                | Track confidence/loss is reflected honestly                  | Not tested    |

Do not mark the physical milestones accepted merely because synthetic tests pass. Record observed FPS and inference milliseconds in PERFORMANCE.md with hardware and scene count.

## First laptop webcam session

Use the ordinary localhost URL without `?testInput`. If the embedded browser cannot request camera permission, open the same URL in Edge or Chrome. Press **Start camera**, allow access, and keep the tab visible. The status should become **Local tracking · CPU · up to two hands**. If denied, enable camera access in that browser's site settings; if busy, close other camera applications. The preview can be hidden without stopping tracking.

In even front lighting, hold one hand around 40–70 cm from the camera, with the whole hand visible. Check that all 21 points follow it. Point with the index finger; the other fingers may be relaxed. Move slowly until the cursor is over the cube, hold briefly, then pinch thumb to index. Look for **Grabbed** and the ghost preview. Move sideways, release into pointing, then click Undo: one action should restore the cube.

Repeat a grab and remove the hand: the preview must disappear without moving the cube. Create a second cube and move the first over it: a red preview must reject release. Open **Help → Open gesture tools**, then point and pinch **Create cube**. Open palm alone must never open it. End with **Stop camera** and check the laptop's camera indicator turns off.

Report: whether landmarks appeared, whether pointing/pinch labels matched, any cancellation message, displayed FPS and inference Hz/ms, browser, lighting and approximate distance. If tracking keeps restarting, report the metrics before changing thresholds. The user reported working camera/tracking/cursor, unreliable grab, and repeated popup before this repair. Physical acceptance of the repaired build remains pending.

## Required physical retest after the repair

1. Point at the cube until it highlights.
2. Pinch thumb and index to grab; check for Grabbed.
3. Move the cube while holding pinch.
4. Release to place.
5. Confirm no popup appears (also briefly show an open palm).
6. Undo the movement; the cube must return in one action.

If any step fails, expand **Gesture diagnostics** and report the gesture/candidate, pinch distance when closed and when open, latch and pinch state, targeted object, selectable ray hit, grab state, rejection reason and tracking Hz. This separates recognition, aiming, transaction and tracking-loss failures. Do not treat the automated suite as webcam verification.

## Milestone 5 physical acceptance (pending)

Milestone 4's six webcam actions passed according to the user's 2026-10-14 report. Repeat with **each** of sphere, cylinder, cone, wall and floor:

- Create from the palette; pan/zoom if necessary to bring the object into view.
- Point until highlighted, pinch, move, release; verify no Help popup.
- Undo once, then Redo. Try a collision: it should show red and cancel on release.
- With the mouse, select and test Move/Rotate/Scale handles and inspector position/rotation/scale. Verify rejected transforms restore the object.
- Change material/color, duplicate, delete, and undo those operations.
- Save a mixed-shape scene, reset, and load it again.

Record object type, camera conditions, diagnostics and any failure. Milestone 5 is not physically accepted until the user confirms these checks. Do not proceed to Milestone 6 meanwhile.

## Milestone 5.1 user acceptance (pending)

- Start the physical camera and confirm landmarks/gestures.
- Drag by the title; resize with the corner; confirm the scene does not orbit or move from those mouse actions.
- Minimize and perform point → pinch → move → release → Undo. Confirm capture stays active.
- Expand, maximize/restore and reset; reload to confirm layout persistence (camera restarts only by explicit Start).
- Shrink the browser and use keyboard arrows on the title/grip; all controls must remain reachable.
- Compare Satin metal and Holographic glass on cube, sphere, cylinder, cone, wall and floor; retain the selected color.
- Undo/Redo material selection and save/load a mixed-material scene.

Do not mark physical retesting complete based on automated synthetic camera or landmark tests.

## Milestone 6 physical webcam checklist — accepted by user on 2026-10-15

Use **http://127.0.0.1:5175/** without `?testInput`. Start the camera, keep the tab visible, and verify both skeletons/hand IDs in even front lighting. Keep wrists apart; crossing/occlusion may cancel safely. Expand/scroll the camera panel to access Gesture mode.

1. **Two-hand scale:** Select one isolated cube. Choose Two-hand scale. Show both hands with thumb/index apart for about half a second, then pinch both. Move apart and together; inspect the factor, ghost and unchanged inspector values during preview. Release a pinch to confirm. Undo once, Redo once. Repeat with sphere, cylinder, cone, wall and floor. Hide a hand mid-operation; the original transform must remain unchanged.
2. **Two-hand rotation:** Select an object and choose Two-hand yaw rotation. Open both pinches, pinch both, then tilt the connecting line by raising one hand and lowering the other. Keep separation comfortable. Confirm the angle/ghost changes without scaling. Release; Undo restores the original orientation. Try a previously tilted object and a nearby obstacle; invalid red previews must not commit.
3. **Deliberate menu:** Enable open-palm tool menu. Lower your hand or point for five seconds after manipulation/close; then hold one steady open palm for about two seconds. Point at Scale/Rotate/Move/Pan view and pinch to confirm. Brief palms, pinch release into a held palm, and mouse/panel dragging must never open tools. Close and keep your palm held; it must remain closed. Uncheck activation and confirm it stays disabled. Help/mouse cards still work.
4. **Camera navigation:** Choose One-hand camera pan and keep one hand visible. Open then pinch; move sideways/up/down. Release retains the view, and object transforms/history stay unchanged. Hide the hand mid-pan; the initial view returns. Confirm mouse orbit works afterward. Return to One-hand move before grabbing objects.
5. **Preservation:** Minimize/restore and drag/resize the camera window during tracking. Repeat one-hand point/grab/move/release/Undo. Test materials, duplicate/delete, snapping and mixed-scene save/load.

Report mode, hand count/IDs, factor/angle, diagnostics/rejection text, FPS/inference Hz, lighting and any failure. The developer's simulated landmark/model-video tests do not establish physical reliability. Do not begin further gesture/voice/LLM work before accepting this milestone.

## Milestone 6.1 physical layout checklist — accepted by user on 2026-10-15

Open http://127.0.0.1:5175/ without test input. Gesture Input is now above Object Inspector on the left; construction tools are on the right. Use the header waveform button to reopen diagnostics and the layout button to reset panel geometry.

1. Start your laptop camera. Move both sidebar inner boundaries and the divider below Gesture Input; also focus each divider and use arrow keys (Shift for 40px steps). Scroll the inspector and confirm the preview does not move. Check the scene resizes and mouse orbit/selection still work.
2. Minimize/expand Gesture Input, collapse/expand its sidebar, undock/drag/resize/redock it and hide/show the preview. Confirm tracking remains active throughout, including while minimized. Minimize/restore Object Inspector independently.
3. Drag/resize/minimize/restore/close/reopen diagnostics. Check gesture, pinch ratio, target/ray hit, mode, factor/angle and rejection readings. UI manipulation must neither orbit nor place objects; an active uncommitted operation cancels safely.
4. Point at an object, pinch, move, release, confirm no popup and Undo once. Repeat explicit two-hand scale/yaw modes. Return to One-hand move afterward.
5. Collapse construction tools and create shapes/use transforms from its icon rail. Restore it; check inspector transforms, materials/color, duplicate/delete, snapping and JSON save/load. Verify Undo/Redo.
6. Reload to check saved widths, split height, docking, minimize/collapse and diagnostics geometry. Camera restart after a full reload remains explicit. Use Reset Workspace Layout while capture is active; only the layout should reset.
7. Shrink the browser. On small screens use the side rail expand controls to open one drawer at a time; verify camera and Undo/Redo remain reachable, the page does not scroll horizontally and footer hints stay on one line (hover/focus Help for full instructions).

Report any failure with screen dimensions, mode, camera/tracking status, inference Hz/FPS, pinch ratio, target/ray hit and rejection text. Physical webcam acceptance must be supplied by the user.

## Milestone 7 physical webcam and rendering acceptance — pending

Use the real localhost app without `?testInput`. Earlier Milestone 6/6.1 acceptance does not substitute for testing these new surfaces/models.

1. On a sphere, compare matte plastic, glossy plastic, satin metal and polished metal. On a wall/floor, compare wood, brick and concrete. Set surface color to white for native texture colors; change texture repeats/metre and nonuniform scale, and verify density rather than excessive stretching. Try glass and holographic on the six shapes. Verify bright outlines and cursor targeting remain visible.
2. Edit roughness/metalness/opacity/emission where shown, reset defaults, then Undo/Redo. Original base colors should persist. Expand Studio lighting and test ambient/key/fill/reflection/shadow controls and reset. Save/Load should preserve the surface and lighting settings.
3. Import a small static GLB, then a GLTF with its BIN/images selected together. Check original PBR surfaces, choose a preset override and restore original materials. Select from viewport/list; mouse move/rotate/scale, duplicate/delete and Undo/Redo. Missing dependencies, an OBJ or an oversized model should give an error without changing the scene.
4. Start your physical webcam. In One-hand move, point at an imported model, pinch, move and release. The bounding preview must place once and Undo must restore its position. Repeat with a textured primitive. Hand loss or invalid overlap must cancel. Release must not open unrelated menus.
5. Select the model, choose Two-hand scale, open both pinches, pinch both, move apart/together and release. Undo once. Repeat Two-hand yaw rotation; Undo once. Keep wrists apart and check the same diagnostics if an operation cancels.
6. Minimize/dock/collapse the camera and resize panels during tracking. Verify mouse controls and gestures remain usable, and material edits do not stop capture. Save project, reload, Restore local project, then load the downloaded JSON on another browser/origin to confirm imported models are present.

Report model format/size, preset/settings, mode, tracking diagnostics, target/ray hit/rejection, FPS/inference Hz and any failing step. Static bounding proxies deliberately select empty/concave areas and can reject close curved/rotated placements. Do not claim measured physical performance from software-rendered browser tests. Milestone 8 requires explicit user acceptance first.
