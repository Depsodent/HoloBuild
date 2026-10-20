# Walkthrough

Choose Walkthrough at the lower left of the viewport. Confirm or cancel pending AI previews first. Webcam tracking is optional. Walking is read-only: mouse/gesture manipulation and scene Undo/Redo resume after exiting; Save remains available.

## Four primary controls

- **Look Around** requests pointer lock from your click. Its active state reflects actual mouse lock. Use WASD to move and the mouse to look. Escape releases the mouse and pauses.
- **Exit Walkthrough** releases pointer lock and restores the editor camera, panels, selection context and layout. It changes no geometry or history.
- **Reset Position** returns to the initial safe entry position and orientation, including after climbing floors. If geometry has changed around the start, a clear entry is checked again. Reset pauses movement.
- **Controls** opens a short, dismissible help region. Keyboard/touch fallback and on-screen movement buttons are here, outside the primary toolbar. Use keyboard / touch resumes without pointer lock; Arrow Up/Down move and Left/Right turn. Close controls or Escape within help dismisses it.

Movement uses 2.2 m/s and 1.6 m eye height. Extra view settings and saved viewpoints are removed. Old browser-local view preferences are retired without touching workspace preferences or saved projects. Use the normal editor's orbit/zoom for demonstrations.

The existing global **Stop Camera** action remains in the top bar while capture is active. Hiding panels does not unmount or stop webcam tracking. Mode entry pauses speech capture, invalidates delayed permission checks and preserves finalized transcript text. Exit before starting another voice edit.

## Navigation and safety

The swept body has a 0.22 m horizontal radius and 1.75 m vertical clearance. Wall sliding, gravity and actual floor/tread support handle native walls, connected stairs, floor voids and balconies. Compatible static door panels are hidden and passable only while walking; they reappear on exit. Windows and rails remain solid. This does not animate hinged doors. Empty scenes use the workspace ground. No clear entry produces an explanation rather than placing the camera inside an obstruction.

Imported meshes, curved primitives and pitched/rolled shapes use conservative solid bounds; their internal cavities and precise curved surfaces are not navigable. Reset or Exit provides recovery. Navigation is not a general physics simulation or a building-safety assessment.

## Construction and microphone checks

Build → Stairs offers Standalone Stairs and Connect Floors. Standalone flights use real steps with width/rise/run/count/position/orientation/material controls, creating no hidden floor or inferred landing. Raised placement requires real supporting geometry. Connect Floors retains actual adjacent-floor elevations, cut-outs and landing checks. Balconies require a compatible host and aligned doorway.

In Part mode, select a native manual wall or generated building wall and request Add a window to the selected wall. The existing preview/confirmation/history path creates a real segmented opening and retains unaffected openings. Cancel changes nothing. Select an existing window for opening edits. Imported/non-editable walls explain their limitation.

Native speech requires a compatible browser, microphone permission and localhost/HTTPS. Stop requests finalization; Cancel aborts but retains finalized text. Only actual final recognition events fill the composer. Unsupported or failed recognition keeps typed input available. Check site/OS permissions and the displayed support/status/error before retrying. No paid transcription service is introduced.

Physical webcam, microphone, touch and friend-laptop acceptance remain pending until users actually test them. See MANUAL_TESTS.md and the current milestone handoff.
