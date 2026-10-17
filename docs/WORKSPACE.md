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

## Milestone 10.2 — left navigation

The left sidebar now has **Gesture / Inspector / Collection** tabs with Arrow Left/Right, Home/End and roving keyboard focus. Only one primary pane occupies the sidebar. `holobuild.left-tab.v1` remembers the selection. Inspector holds the contextual object or whole-structure controls; Collection replaces the old embedded lists with name/type/role search and expandable structure/component groups. Selecting a component selects Part scope; selecting the group action selects Structure scope. A selection opens Inspector.

The camera component, video and HandTracker remain mounted across tab changes. Inactive docked preview/landmark drawing is hidden; inference still uses the existing fresh-frame scheduler and watchdog. A compact **Stop Camera** remains in the sidebar when Inspector/Collection is active; the global Stop covers collapsed sidebars. Floating/docking, camera minimization, sidebar resizing, scrolling and prior layout preferences remain available. The optional camera settings contain delegate/quality choices and the Performance diagnostics toggle.

Appearance offers common swatches, native picker and validated HEX (`#RGB` or `#RRGGBB`). Changes preview immediately without changing the scene, history or saved JSON. **Apply Color** commits one existing command; **Reset to Material Default** resets only tint, preserving optical parameters. Whole-structure Materials resolves All or actual component roles from metadata. Imported original PBR surfaces retain their maps/optics and receive a multiplicative instance tint.
