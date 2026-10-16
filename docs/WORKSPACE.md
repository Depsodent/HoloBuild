# Minimal workspace — Milestone 9.1 UI refinement

The holographic theme and existing scene/gesture command architecture are unchanged. The workspace keeps Gesture Input and Object Inspector on the left, the live 3D canvas in the center, and four major groups on the right.

| Group | Available tools |
| --- | --- |
| Shapes | Cube, sphere, cylinder, cone, wall, floor |
| Tools | Select/move/rotate/scale, snapping, duplicate/delete, gesture mode and optional gesture settings |
| Ask HoloBuild | One text field and microphone toggle for quick commands or structure requests; mode, pending review, optional AI settings, Offline parameters, examples and Help |
| Scene | Import GLB/GLTF and related local assets, restore local project, studio lighting and Fit for the last generated structure |

Shapes starts expanded. Opening another major group collapses unpinned peers. The pin next to each group keeps it open; it can still be explicitly collapsed. Native summaries support Enter/Space, and pin controls support keyboard focus and activation. Group states and pins are stored separately in `holobuild.accordions.v1` and `holobuild.pins.v1`. Existing independent panel geometry/docking/scrolling preferences remain supported. Storage restrictions fall back to session state.

Inspector shows the selected name/type and quick Duplicate/Delete actions. Its three groups are Transform, Appearance (material, contextual optical/texture controls, color, editable name and ID), and Scene Collection. No selection hides irrelevant property fields and keeps the collection accessible. Selecting an imported model retains the original-material option.

Ask HoloBuild accepts up to 1200 characters in its single field. Quick commands still use the existing deterministic parser (240-character grammar limit) regardless of planner choice. Commands mode restricts input to quick commands. Offline, Auto and LLM remain available for explicit Build/Generate requests. The microphone starts only when explicitly activated; its toggle stops listening. Speech-provider privacy information is in Help. Collapsing Ask HoloBuild stops speech and cancels unconfirmed planning, independently of webcam tracking.

Plan review, ghost/confirm/regenerate/cancel controls appear only for a pending plan. Successful confirmation and cancellation clear the input and remove review controls; a concise result remains. Fit for the last committed structure is accessible from Scene. Pending destructive quick commands still require their separate Confirm/Cancel actions and reject changed scene/selection snapshots.

Gesture Input keeps capture Start/Stop in its header. When minimized, the bar shows capture status, hand count, recognized gesture and active gesture mode, with Stop still accessible. Dock/undock, minimize/restore, floating move/resize, global emergency Stop, and keyboard controls remain. Minimization hides the body without unmounting video or the tracker. Calibration values and camera settings are optional expanders; Gesture Diagnostics starts hidden and can be shown using the top-bar diagnostics button. Existing remembered visibility takes precedence. Reset Workspace Layout restores the smaller default camera area (280 px) and hides diagnostics.

Sidebars retain keyboard/pointer resize handles, independent vertical scrolling, collapse rails, and narrow-screen drawers. Collapsing sidebars releases central canvas space. No feature uses a separate gesture scene or history stack. Hand recognition thresholds, smoothing, debounce, readiness and loss handling were not modified.

## User acceptance still required

Automated browser and simulated-input checks do not establish physical usability acceptance. With your laptop webcam, verify point → pinch → move → release → Undo, then two-hand scale/rotation. Minimize Gesture Input during tracking and confirm its status and Stop remain usable. Try pinning Tools alongside Ask, resizing both sidebars, restoring the page, importing a model, material edits, lighting, text/microphone requests, preview/cancel/confirm, Save/Load and Undo/Redo. Report any clipped action, confusing group placement, or camera/inference/gesture latency readings. Actual microphone recognition and a configured local model also require physical/provider testing.

## Milestone 10 additions

The Inspector's compact Selection control switches between individual components and whole structures. Whole selection replaces individual properties contextually with five initially collapsed Structure Transform / Components / Materials / AI Edit / Advanced groups; it does not add another permanent tool window. Group accordion preferences use the same storage and keyboard-accessible controls. The right sidebar still has exactly four main groups. Ask HoloBuild remains the single text/microphone input, now also presenting a modification review only while one is pending. Commands mode supports deterministic structure edits as well as existing quick commands; LLM/Auto can interpret flexible edit wording. See [structure editing](STRUCTURE_EDITING.md).
