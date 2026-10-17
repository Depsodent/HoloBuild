# Workspace — Milestone 10.1

The existing holographic theme keeps Gesture Input and contextual Inspector left, 3D Workspace center and compact tool tabs right. Optional floating Gesture Diagnostics starts hidden; remembered visibility still wins.

| Tab | Tools |
| --- | --- |
| Build | Six shapes, local model import and compact import help |
| Edit | Mouse transform tools, snapping, duplicate/delete, optional advanced gesture overrides and thresholds |
| AI | One Ask HoloBuild input, microphone, short modes, Send, measured activity and pending-only preview/confirmation; secondary Settings/Help |
| Scene | Restore local project, studio lighting and Fit last generated structure |

The viewport's **Target: Part / Structure** chooses the entity for all input methods. Auto gestures are default; select an entity once, pinch/move with one hand or pinch both and use deliberate radial/line-turn movement. See GESTURES.md. Header Save/Load/Undo/Redo remain global. No capabilities were removed.

Only the active tab takes space. Tabs use Arrow Left/Right and Home/End, readable focus, appropriate roles and active-tab persistence (`holobuild.tools-tab.v1`). Old accordion preferences remain for contextual properties and secondary controls; obsolete major-group pins are no longer primary navigation. Sidebars retain independent resize/scroll/collapse/drawers and persistence. Switching tabs keeps pending previews and internal file controls mounted; stale edits must be regenerated before confirmation. Leaving AI ends speech capture. Layout reset still restores sidebar/camera defaults.

Inspector shows selected name/type, contextual Transform/Appearance/Scene Collection, or compact whole-structure sections. Target scope is not duplicated in Inspector. With no selection it shows a short empty state. Imported-original surfaces and material-specific controls remain contextual.

Gesture Input keeps Start/Stop and status accessible when minimized or docked. Minimization never unmounts video/MediaPipe. Global emergency Stop remains when sidebars collapse. Camera settings/calibration and diagnostics are optional. Diagnostics minimized view reports six actual rolling measurements; its readings identify camera presentation and processing-to-next-callback limitations. Full diagnostics includes frame variation, measured long tasks, engine/resolution and pinch/identity/controller details.

Prompt → Generate → nonselectable Preview → Confirm → selected whole structure → Edit Structure. Confirm/Cancel remove pending controls; one Undo removes the complete construction. AI Settings contains model/budget, optional final-transcript autosubmit and genuine request timings; Help contains examples/privacy/limitations. Offline fallback is always labeled.

## Physical acceptance required

Test narrow sidebars, keyboard tabs, resizing/reload, scope visibility and inspector relevance. Start webcam, minimize its panel, and verify point/pinch/move/release/Undo in Auto; then two pinches for scale/yaw and staggered hand joining. Try imported objects and whole structures, hand loss, mouse takeover and Undo during preview. Try a finalized voice request with autosubmit on/off and Cancel, and a real Ollama plan/edit through preview/confirm/Undo. Physical camera/microphone performance and usability are pending your confirmation; synthetic browser tests do not establish acceptance. No Milestone 11 has begun.
