# Walkthrough and presentation

Use Walkthrough or Present at the lower left of the viewport. Webcam tracking is optional. Confirm or cancel pending AI previews before entering. Exploration is read-only: object dragging, transform handles, scene commands and Undo/Redo resume after exiting. Save project remains available.

## Walkthrough

- Look around requests mouse pointer lock from a deliberate click. Move with WASD. Escape unlocks and pauses.
- Use keyboard / touch works without pointer lock. Arrow Up/Down move; Arrow Left/Right turn. The on-screen movement buttons support pointer/touch holds.
- Pause and window/tab interruptions clear movement. Choose controls to resume. Reset position finds a clear entry near the selected building. Return to editor restores the previous camera and leaves selection/tool settings intact.
- View settings offers 0.5–6 m/s movement and 1.2–1.9 m eye height. Increasing eye height is rejected if the current ceiling cannot accommodate it.

The body has a 0.22 m horizontal radius and eye-height plus 0.15 m clearance. Bounded movement sweeps, wall sliding, gravity and real floor/tread support prevent ordinary wall/floor tunneling. Native floor voids and connected stairs remain actual geometry. Existing certified static door panels are hidden and treated as open portals only while walking; they reappear on exit. No hinged-door animation is implied. Windows and railings remain solid.

Imported models, curved primitives and pitched/rolled geometry use conservative solid bounds. Their internal cavities and exact curved/tilted surfaces are not navigable. This is bounded architectural navigation, not a general physics engine or a building-safety assessment. Reset or Exit is always available. Empty scenes use the workspace ground.

## Presentation and saved viewpoints

Presentation hides editing panels without unmounting webcam capture or rewriting sidebar preferences. Orbit by dragging; scroll to zoom. Fit scene provides an overall view. Walkthrough and Overview switch within the same presentation session; Exit Presentation restores the editor camera/layout. Camera Stop remains available while panels are hidden, including inside fullscreen. Fullscreen is optional and depends on browser permission/support.

Save named camera viewpoints under View settings. Up to twelve viewpoints and speed/eye-height preferences persist in this browser's Local Storage. They are view preferences, outside scene history and outside portable scene JSON. A walking viewpoint is checked against the current collision geometry before use; an obstructed viewpoint needs a reset or a different view.

## Native construction fixes

Stairs offers Standalone Stairs and Connect Floors. Standalone flights use the same native treads with explicit step count, overall rise, run, width, position, orientation and appearance. They create no hidden floor or automatic opening. Ground or compatible supporting floors are required; use an actual aligned platform for raised access. A destination/landing is not inferred. Connect Floors retains adjacent-floor elevation, opening and landing validation inside compatible multi-floor structures.

Select a native wall in Part mode, then type or submit a finalized transcript: Add a window to the selected wall. An ordinary manual wall becomes a native single-face assembly with real segmented geometry. A generated building wall resolves its stable facade/floor relationship. Existing openings are preserved and invalid/overlapping layouts rejected. Preview and Cancel do not change the confirmed scene; confirmation is one undoable action. Select an existing window to resize/move its opening. Imported meshes and uncertified walls explain why they cannot be cut. In Structure mode specify a facade/floor, or choose Part for a particular wall.

## Microphone acceptance

Native browser recognition is feature-detected; unsupported browsers retain normal text entry. Permission/security checks run where available. Stop asks the browser to finish captured speech; Cancel aborts the current capture. Only actual final recognition results fill the composer, and finalized text survives interruptions. Auto-submit remains opt-in and uses the same validated request pipeline as typed input. Pause/exit exploration before starting another voice edit.

A browser speech service can still reject microphone access, fail to find a device or report network/no-speech errors. Follow the displayed instruction, check the site's microphone permission and OS input device, then restart deliberately or type the same request. The implementation cannot establish another laptop's speech-service compatibility. Physical webcam, microphone, touch and friend-device acceptance remain pending until the user tests them.

API references: [SpeechRecognition.stop](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/stop) and [requestPointerLock](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock). Both features depend on actual browser support; fallback controls remain available.
