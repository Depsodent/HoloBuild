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
| Two visible hands                 | One-hand mode only; two-hand transforms unsupported          | Not tested    |
| Background clutter                | Track confidence/loss is reflected honestly                  | Not tested    |

Do not mark the physical milestones accepted merely because synthetic tests pass. Record observed FPS and inference milliseconds in PERFORMANCE.md with hardware and scene count.

## First laptop webcam session

Use the ordinary localhost URL without `?testInput`. If the embedded browser cannot request camera permission, open the same URL in Edge or Chrome. Press **Start camera**, allow access, and keep the tab visible. The status should become **Local tracking · CPU · one hand**. If denied, enable camera access in that browser's site settings; if busy, close other camera applications. The preview can be hidden without stopping tracking.

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
