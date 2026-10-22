# Walkthrough controls

Enter Walkthrough requests Look Around directly from the entry click. Actual pointer lock controls the active indicator. If the browser refuses, is unsupported or is finishing an earlier release, click Look Around once or choose Controls → Use keyboard / touch. There are no automatic retry/prompt loops.

| Input | Action |
| --- | --- |
| W/A/S/D | Move |
| Space | Jump from support |
| Hold Shift | Sprint |
| Ctrl + right mouse drag | Select and reposition a supported target |
| E | Open/close the furniture catalog |
| Left/Right Arrow | Rotate selected/moving object in 15-degree increments |
| Escape | Exit the entire Walkthrough, cancelling unconfirmed operations |

The primary toolbar remains **Look Around / Exit Walkthrough / Reset Position / Controls**. Reset returns to the initial safe position and orientation and pauses. Arrow Up/Down remain an optional movement fallback; touch Turn buttons still turn the camera. Left/Right Arrow no longer turn the camera. Editable fields ignore construction shortcuts; Escape still exits Walkthrough. Held/repeated keys cannot create repeated rotation history entries.

## Direct manipulation

While locked, aim the center crosshair at the object and hold Ctrl + right mouse. The camera and walking inputs freeze during the drag. Relative mouse deltas move a temporary preview across a camera-relative horizontal plane at the original elevation; the code does not use stale screen coordinates under pointer lock. With an unlocked pointer, pick the target normally in the canvas. Release right mouse to commit one validated movement/rotation command; invalid placement cancels. Context menus are suppressed for this interaction.

Independent primitives, imported models and furniture are supported. Structure selection moves/rotates the entire selected structure through its existing strict group command. Connected architectural Parts remain protected: use their Inspector/architectural tools, or choose Structure before entry. A Part hit never silently becomes a whole-building edit. Floor elevation, supported furniture, reserved doors/stairs, collisions and current-player clearance must remain valid. Wall-mounted furniture retains its face and cannot freely yaw away. Vertical relocation remains an Inspector operation.

Left/Right Arrow rotates an active preview; release commits movement plus rotation together. A selected target without an active drag receives one validated undoable rotation per non-repeated key press. With no applicable selection, arrows do nothing. Escape, blur, hidden document, stale selection or scene changes cancel active movement safely. Confirmed changes remain normal scene objects and work with Inspector, gestures, save/load and exact Undo/Redo after exit.

## Catalog and mouse ownership

E opens the existing 45-preset catalog and deliberately releases the pointer. E or Done furnishing closes it, cancels any unconfirmed placement and requests Look Around from that interaction where permitted. Search fields keep E and arrow keys for text editing. While walking, arrows rotate the placement ghost; click the canvas, Enter or Place furniture confirms. Cancel preview discards only the preview; Escape exits all of Walkthrough. In the editor, existing Q/E rotation and Escape-to-cancel remain available.

A locked pointer belongs to the canvas, so mouse clicks cannot target ordinary UI buttons. Use E to release it for the catalog, or Tab/focus a toolbar action and Enter; keyboard activation keeps Controls, Reset, Exit and global Stop Camera accessible. Actual browser permissions and native Escape timing vary. Unexpected native lock loss exits; intentional catalog/fallback/blur unlocks do not accidentally exit. No physical keyboard/mouse acceptance is claimed from automated tests.

## Existing navigation and capture

Movement remains 2.2m/s, Shift 4.4m/s, eye height1.6m. Grounded jump, gravity, swept wall/ceiling collisions, native doors, connected stairs, slab voids and balcony rails retain their existing solver. Imported/curved/tilted bounds remain conservative. Navigation is not structural certification or a general physics simulation.

Entry rejects pending AI previews. Exit releases the pointer, clears movement, cancels unconfirmed edits and restores the previous editor camera/panels/layout. Ordinary walking remains read-only outside explicit furnishing/direct transforms; Undo/Redo resume after exiting. Camera capture stays mounted, global Stop Camera remains accessible, and speech generation/permission guards preserve finalized transcript text. Physical webcam/microphone/touch/friend-device checks remain pending.