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

Use **http://127.0.0.1:5175/** without `?testInput`. Start the camera, keep the tab visible, and verify both skeletons/hand IDs in even front lighting. Keep wrists apart; crossing/occlusion may cancel safely. In 7.1, access Gesture mode under Construction Tools → Gesture Controls.

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

## Milestone 7 physical webcam and rendering acceptance — accepted by user on 2026-10-15

Use the real localhost app without `?testInput`. Earlier Milestone 6/6.1 acceptance does not substitute for testing these new surfaces/models.

1. On a sphere, compare matte plastic, glossy plastic, satin metal and polished metal. On a wall/floor, compare wood, brick and concrete. Set surface color to white for native texture colors; change texture repeats/metre and nonuniform scale, and verify density rather than excessive stretching. Try glass and holographic on the six shapes. Verify bright outlines and cursor targeting remain visible.
2. Edit roughness/metalness/opacity/emission where shown, reset defaults, then Undo/Redo. Original base colors should persist. Expand Studio lighting and test ambient/key/fill/reflection/shadow controls and reset. Save/Load should preserve the surface and lighting settings.
3. Import a small static GLB, then a GLTF with its BIN/images selected together. Check original PBR surfaces, choose a preset override and restore original materials. Select from viewport/list; mouse move/rotate/scale, duplicate/delete and Undo/Redo. Missing dependencies, an OBJ or an oversized model should give an error without changing the scene.
4. Start your physical webcam. In One-hand move, point at an imported model, pinch, move and release. The bounding preview must place once and Undo must restore its position. Repeat with a textured primitive. Hand loss or invalid overlap must cancel. Release must not open unrelated menus.
5. Select the model, choose Two-hand scale, open both pinches, pinch both, move apart/together and release. Undo once. Repeat Two-hand yaw rotation; Undo once. Keep wrists apart and check the same diagnostics if an operation cancels.
6. Minimize/dock/collapse the camera and resize panels during tracking. Verify mouse controls and gestures remain usable, and material edits do not stop capture. Save project, reload, Restore local project, then load the downloaded JSON on another browser/origin to confirm imported models are present.

Report model format/size, preset/settings, mode, tracking diagnostics, target/ray hit/rejection, FPS/inference Hz and any failing step. Static bounding proxies deliberately select empty/concave areas and can reject close curved/rotated placements. Do not claim measured physical performance from software-rendered browser tests. Milestone 8 requires explicit user acceptance first.

## Milestone 7.1 physical acceptance — pending

The user confirmed Milestone 7 passed real-world acceptance. The following checks apply to the new 7.1 changes; automated landmark sequences and synthetic camera inference do not establish physical reliability or speed.

1. Open **http://127.0.0.1:5175/** without `?testInput`. Start the laptop webcam. In One-hand move, point, pinch, move, release and Undo once. Confirm there is no unwanted popup. Repeat on a textured primitive and an imported model.
2. Select an object once with the mouse or a one-hand pinch. Switch to Two-hand scale; selection must remain. Open the first pinch, then close it while bringing in the second hand within four seconds. Let the second hand stabilize, open then pinch it. Neither hand needs to aim at the selected object. Read the waiting/prepared/active status. The initial preview must not jump. Move hands apart/together, release and Undo once, then Redo.
3. Switch that same selection to Two-hand yaw rotation. Prepare the two hands independently, pinch both, tilt the connecting line and release. Undo once. Also deselect, enter Rotate and use a single hand to select once before bringing in the second. Hide a hand during an active transform: the preview must cancel without committing. A held pinch after cancellation must not restart an operation without opening again.
4. Expand diagnostics Performance Metrics. Record browser, hardware, scene/model size, negotiated capture dimensions, render FPS/p95/std deviation, camera presentation FPS, inference Hz/mean/p95, gesture Hz and processing-to-render time. Capture-to-render and skipped frames may read unavailable; do not report them as zero. Repeat under the same conditions with Balanced and Performance; optionally Quality. Switching a profile must keep the camera active and safely cancel an active preview. Actual laptop measurements, not synthetic values, decide which mode feels smoother.
5. Optional worker comparison: Stop camera, select Experimental worker CPU in Camera settings, restart and repeat step 4. Compare tracking and render rates separately; if gestures cancel or inference slows, return to main-thread CPU. The software-rendered experiment improved rendering but worsened inference. It is not the default.
6. Expand/collapse each right-side construction and inspector group using pointer and keyboard Enter/Space. Keep several groups open, reload and confirm independent remembered states. Selected-object information should remain visible. Resize/collapse the sidebars, minimize/dock/undock the camera and hide its preview while tracking. Verify the header **Stop camera** remains reachable and turns off the laptop camera indicator even when the camera panel is collapsed.
7. Move/resize/minimize diagnostics; confirm the compact status and expanded groups. Interacting with panels must not orbit the scene or commit a gesture preview. Check materials/textures, duplicate/delete, snapping, mouse gizmos and portable JSON save/load still work.

Report the exact step, mode, selected object, hand IDs/readiness, pinch state, cancellation/rejection text and Performance readings for any failure. Milestone 7.1 awaits the user's physical acceptance. Do not begin Milestone 8, voice commands or AI integration beforehand.

## Milestone 8 physical microphone acceptance — pending

The user has now confirmed Milestone 7.1 physical acceptance, superseding the preceding pending note. Use **http://127.0.0.1:5175/** in a browser with WebGL and speech support (try Chrome or Edge; speech service availability is not guaranteed). Open Construction → Ask HoloBuild. Browser recognition can transmit audio to a provider; read Help & examples before explicitly enabling the microphone. Automated speech tests used mocks and did not record real audio.

1. Before Start listening, confirm no microphone activity. Type `Create a sphere`, `Move it up 2 meters`, `Make it red`, `Apply wood material`, `Undo` and `Redo`; inspect the selected object and history. Test `Select last created object` after Undo/Redo clears selection. Confirm keyboard typing does not invoke scene shortcuts.
2. Press **Start listening**, grant microphone permission if desired, and wait for Listening. Speak one command at a time, pausing for the result: “Create a cube”, “Move it up two meters”, “Rotate it forty five degrees”, “Scale it by one point five”, “Make it blue”, “Apply glass material”. Watch interim transcript versus final Heard/result. Each changed action must happen once. Deliberately say “Move it right one meter” twice as separate utterances; both should execute once.
3. Say “Delete it”. Verify no deletion until the inline Confirm button; test Cancel, then repeat and Confirm. Undo once restores it. Request deletion, then select/create another object with the mouse before confirming: it must reject the changed scene/selection. “Clear the scene” also requires confirmation and one Undo restores the collection.
4. Try “Build a castle” and an invalid/ambiguous target or amount. Nothing should change. Deselect, say “Make it red”, and check Selected object required. Create two cubes, say “Select cube”, and check the ambiguity message; use a unique inspector name or exact ID instead. Movement is world-relative, with forward −Z even after orbiting; grid, ground and collision rules still apply.
5. Say “Save the scene” and verify the actual downloaded self-contained JSON and local metadata. Load through the existing header and compare the scene, including a supported imported model. Apply a spoken transform/material change to that model, Undo/Redo and restore original materials in the inspector.
6. Press **Stop listening** during a partial utterance; no late command should execute. Restart, collapse the command group/right sidebar, reopen and confirm it remains stopped. Hide/show the tab and check no automatic restart. Deny microphone permission or disconnect it and confirm clear feedback plus working text commands. If the browser/service is unsupported or unavailable, use text and report the status rather than changing permissions repeatedly.
7. Start the webcam separately, perform one-hand move/release/Undo and two-hand scale/rotate, then use a text/spoken command while hands are neutral. Confirm voice does not alter thresholds or stop camera tracking. Commands received during an active object preview must not commit it. Minimize/dock camera, move/resize diagnostics and check scene/material/import save/load functionality.

Report browser/version, recognized final phrase, listening/result/error message, whether the action executed zero/one/multiple times, whether a model or primitive was selected, and any microphone/network permission condition. Speech quality/latency and real microphone permission behavior remain unverified until the user confirms. Do not begin Milestone 9 or LLM structure generation.

## Combined Milestone 8 + 9 acceptance — pending

The user authorized Milestone 9 and deferred the physical microphone tests above until this combined session. Earlier Milestone 7.1 webcam acceptance remains user-confirmed; no current microphone/model or new generated-scene physical performance is inferred from mocks/synthetic video.

1. Open **http://127.0.0.1:5175/** in Chrome/Edge with WebGL. Expand Ask HoloBuild. Repeat the M8 typed and spoken create/move/rotate/scale/color/material/Undo/Redo checks. Explicitly start/stop the microphone; verify interim text does not execute, each final phrase acts once, denied/service errors preserve text editing, and delete/clear require Confirm. Read the speech provider privacy notice before activation.
2. Use Ask HoloBuild in **Offline**. Generate a small house; compare object count in the real scene before/after Generate (it must not change). Inspect source, dimensions, origin, materials, warnings, part list and ghost. Fit structure in view; orbit/zoom to inspect the preview. Cancel: no objects/history should change. Regenerate and Confirm: the whole house appears once. One Undo removes all its parts, one Redo restores them.
3. Generate the two-story house with windows, room with doorway, five-level tower, metal-roof warehouse, bridge with pillars and wooden shed. Check walls/slabs/roof contacts, real door/window openings, all floors and meaningful part names. Try dimensions/material/count/flat-or-none roof overrides; unsupported pitched/extra details should be reported. Invalid opening layouts or excessive budgets must reject without partial changes. This is a conceptual model, not engineering or building-code validation.
4. Keep an existing cube/imported model, preview another structure, then edit/create an object with the mouse. Confirm must disable until Regenerate. Cancel/invalid/timeout requests preserve earlier objects. Generate near occupied space and verify the shown origin shifts the whole assembly together without gaps. Each generation is one history operation; individual subsequent edits remain individual operations.
5. Start the actual webcam. Point/pinch a generated wall or pillar, move/release, Undo once; repeat two-hand scale/yaw on one selected part. Existing individual collisions can reject moving a tightly joined part into neighbours. Check loss cancellation, no unwanted palm popup, camera minimizing/docking, floating diagnostics and mouse takeover. Report separate render/inference/gesture rates if the larger scene feels slow; do not infer tracking speed from render FPS.
6. Speak “Build a room with a doorway.” It must open a **plan preview**, never construct automatically. Replayed recognition must not duplicate it. Cancel once, repeat, Confirm manually, and Undo. Say an ambiguous phrase and verify clarification, then a simple command (“Create a cube”) and verify the deterministic path remains functional.
7. Save a mixed generated/primitives/imported-model project, reload and restore/load the exported JSON. Verify part counts, IDs, material/color, grouping descriptors and earlier imported assets. No generated components should duplicate. Check history before reload; history itself retains the established in-memory-only behavior.
8. Optional real local model: follow AI_GENERATION.md with an already installed/loaded model, set backend `.env`, start/restart `npm.cmd run planner`, and Check model connection. Try LLM mode on a small request. Source must say LLM only after real validated output; invalid output/service failures must not change the scene. Try Auto while service is unavailable and verify explicitly labeled Offline fallback for supported templates. Cancel mid-request and confirm no late preview/objects; Stop microphone and Cancel generation are separate controls. No model download is required for the other checks.

Report browser/version, exact prompt/final transcript, mode/source/model/status, warnings/error, object count/expected count, history behavior, part/type, and render/inference/gesture timing if slow. Physical speech accuracy, local-model quality and generated-scene webcam responsiveness remain pending until the user confirms. No Milestone 10, push or deployment is authorized.

## Milestone 9.1 — Minimal workspace physical acceptance (pending)

Use the current [workspace guide](WORKSPACE.md). Verify major-group exclusivity and pins with keyboard/pointer, reload persistence, Inspector empty/selected states, narrow and collapsed sidebars, compact camera Start/Stop with tracking still active, and the single Ask field. Test quick text/microphone commands and structure preview/cancel/confirm/Undo; review controls should disappear after completion. Numeric pinch calibration should appear only when its optional section is expanded. Repeat real one-hand move and two-hand scale/rotation while minimizing/docking panels. No physical approval is recorded for this redesign until the user confirms it.

## Milestone 10.1 — physical acceptance (pending)

Use http://127.0.0.1:5175/ with the planner at http://127.0.0.1:5180. Allow camera/microphone only when you deliberately start them. Auto gesture mode is default; explicit overrides are under Edit → Advanced gesture settings. AI planner mode is a separate choice.

1. **One hand:** Target Part; point at a cube, pinch/grab, move, release and Undo. Repeat on an imported model. Verify no unwanted menu. Minimize Gesture Input while tracking; status and Stop must remain usable. With sidebars collapsed, use the header Stop action.
2. **Two hands in Auto:** Select once, open each pinch, pinch both with either hand joining first, then separate/together for scale. Release; Undo/Redo once. Repeat by turning the hand line for yaw. Mixed motion should stay Detecting until one intent dominates; once active, it should remain that operation. Rotation is yaw only.
3. **Transition and cancellation:** Start a one-hand move, let a second open hand join, then pinch it and scale/yaw. Check for no activation jump and a single Undo for the combined operation. Hide a hand or press Undo during a preview; it must cancel safely. Mouse takeover should also cancel and preserve editor controls.
4. **Whole structure:** AI → Offline → Build a house → Preview → Confirm → Edit Structure. Target should read Structure. Repeat move/scale/yaw; joints must stay aligned. Switch Part and edit a component; Save/Load and history should preserve metadata/materials.
5. **Voice/AI:** Press mic, speak one request, wait for a finalized transcript and capture ending. Interim text must not execute; one final result submits once. Try Auto-submit final transcript off in AI Settings and then Send manually. Cancel/Stop must discard pending audio/replies. In LLM mode verify actual Ollama source, stages/elapsed and timings; any Auto fallback must explicitly say Offline. Confirm only the intended valid plan/edit, then Undo.
6. **Workspace/performance:** Use Build/Edit/AI/Scene and keyboard Arrow/Home/End navigation; resize/collapse/reload sidebars and check scope/Inspector/actions remain accessible. Open optional diagnostics and compare the same scene with camera active and minimized. Do not infer gesture smoothness from Render FPS alone.

If tracking feels laggy, report **Render FPS, Camera presentation FPS, Inference Hz, Inference p95 ms, Gesture Hz, and Process → render ms**, plus scene object count, execution/profile/resolution, full render variation/long-task readings, whether Ollama is generating and whether panels/window are minimized or hidden. Capture/model load and true physical hand-to-screen latency may be unavailable. Optional worker/GPU modes are experiments; change one setting at a time and report both readings and perceived behavior. Automated tests do not establish physical webcam/microphone or usability acceptance. Milestone 11 remains unstarted.
