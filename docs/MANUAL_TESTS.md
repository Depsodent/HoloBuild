# Current manual acceptance checklist

All fresh Milestone13 physical webcam, microphone, touch and friend-device results are **pending**. The user previously confirmed Milestone4's six real-webcam actions; that historical acceptance is not evidence that the current release works on every device. Automated/synthetic tests are recorded separately in milestone receipts. Use non-sensitive sample scenes and report browser/version, OS, engine and actual observations.

## Editor and Inspector

- Create all six shapes. Select with mouse and Collection in Part/Structure modes. Move/rotate/scale, duplicate/delete and exact Undo/Redo.
- Check Materials | AI Edit | Advanced and Request | AI Settings | AI Help stay accessible. Short names stay on one line; long names expose their full title and actions fit narrow panels.
- Change color, material and optics; edit precise dimensions/position; check grid increments, snapping and optional measurements. Cancel invalid placements without moving confirmed objects.
- Save/load portable JSON and supported local GLB/GLTF assets. Reject malformed/oversized data without replacing the existing scene. Keep exported backups of your own work.

## Native architecture and AI

- Build → Stairs → Standalone Stairs: insert in an empty scene, including270° orientation. Edit dimensions/material, add steps and confirm; new treads inherit whole-flight appearance. Check history. Raised placement needs actual support, not invented floors/landings.
- On a compatible multi-floor host use Connect Floors: actual treads, floor void and correct landings. Add/edit/remove a balcony with real aligned access; invalid connections must explain rejection.
- In Part mode select a manual/generated wall and ask Add a window to the selected wall. Verify a genuine opening, preserved existing openings and unrelated objects, inert preview, Cancel, Confirm and exact Undo/Redo. Select an existing window to move/resize it. Test Structure-scope follow-ups separately.
- In Auto/LLM generate a two-floor house with stairs and balcony, then refine the same house without repeating its description. Check preview/confirmation/cancellation and save/load. Offline supports basic templates/explicit edits and must not be presented as equivalent interpretation of every complex prompt. Unexpected output must be rejected rather than silently repaired.

## Four-control Walkthrough

- Primary controls are exactly Look Around, Exit Walkthrough, Reset Position and Controls. Normal editor orbit/zoom still works before/after.
- Enter without a webcam. Look Around shows active feedback only after actual mouse lock. WASD moves; mouse looks; Escape unlocks/pauses. Arrow/touch fallback is in Controls. Help is readable, keyboard accessible and dismissible.
- Walk through an actual native doorway, climb connected stairs/void to the next floor, reach balcony and return. Solid walls/windows/rails block the body. Imported/curved/tilted geometry uses conservative solid bounds, not navigable internal cavities.
- Reset twice from the upper floor and check the same safe start/orientation. Exit restores camera/layout/selection and releases mouse lock. No geometry/history change; editor transforms/Undo resume.
- Pending AI preview prevents entry without discarding it. Check empty scenes, repeated entry/exit, narrow laptop layouts and browser zoom. Pointer-lock denial should expose usable keyboard fallback, not strand the user.

## Physical webcam (pending for this release)

Use localhost/HTTPS without ?testInput. Allow camera permission, keep the tab visible, and check the actual reported engine/status; Auto/GPU/CPU availability depends on the browser/device. In even lighting keep the whole hand visible.

1. Point at a cube and check highlighting/cursor alignment.
2. Pinch once to grab; move the hand; release to place.
3. Undo returns exactly once. Releasing must not open unwanted help.
4. Remove a hand mid-grab: preview cancels without a committed movement. Try a collision: invalid placement is rejected.
5. Repeat on supported primitives/imported/native structure selections. In Auto, two stable pinches permit scale/yaw; hand loss or Undo safely cancels.
6. Minimize/hide preview, then enter Walkthrough. Capture remains active, editing is blocked, and global Stop Camera stays reachable. Stop must end the actual hardware indicator/stream. Exit and restart deliberately.

Record render FPS separately from camera presentation FPS, inference Hz/mean/p95ms, engine, frame dimensions and lighting. These software readings do not measure sensor FPS or full physical hand latency. Do not tune recognition thresholds to hide a failing stage.

## Physical microphone and friend laptop (pending)

Use a compatible browser on localhost/HTTPS and check site/OS microphone permission and input device. Start → speak a non-sensitive wall request → Stop. Only a real finalized transcript may populate the composer; review/edit then Send through normal preview/confirmation. Cancel preserves finalized text. Unsupported recognition retains typed input. Check denial/no-device/network/no-speech feedback and a deliberate restart.

Start permission checking, enter/exit Walkthrough, then finish the check: old capture must not start behind hidden panels or after cancellation. Test real device behavior separately from mocked lifecycle tests. On the friend's laptop report browser/version, date/time/timezone, support/listening/error text and whether final text survived Stop. For AI network failure collect only sanitized status/category/request ID/retry fields as described in DEPLOYMENT.md; never send credentials, raw audio or unrelated traffic.

## Acceptance record

Record task, device/browser, expected/actual behavior, pass/fail/unsupported, diagnostics and reproduction steps. Leave unknown results pending. Do not manufacture participants, user-study results, hardware support or community impact.
