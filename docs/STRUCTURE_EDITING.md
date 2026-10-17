# Intelligent structure editing — Milestone 10

Canonical checkout: `D:\Projects\HoloBuild`. No cloud service or model download is required. Existing Ollama uses the same compatible backend adapter as generation.

## Select components or whole structures

The compact **Selection** control at the top of the left Inspector switches between **Select Component** and **Select Entire Structure**. Clicking a generated component or pinching it follows that mode. Whole structures have gold selection edges and a contextual **Structure Inspector**; individual parts retain their existing properties and materials. Imported models/manual objects remain standalone unless they already carry explicit construction metadata. A name resemblance never creates a group.

`Select the whole house` in Ask HoloBuild can select the single matching building without a history entry. With multiple matching structures, select one first or use a unique structure name/ID. A specific named target takes precedence over a different selected structure. Unknown/ambiguous targets fail without editing the scene.

The Structure Inspector exposes collapsed **Structure Transform**, **Components**, **Materials**, **AI Edit**, and **Advanced** sections. Rename in Structure Transform (Enter or blur), inspect dimensions/component count, and select individual parts from Components. Appearance summaries use existing material presets; batch material edits preserve component colors. Advanced contains safe floor operations and Ungroup. Existing sidebar docking, sizing, scrolling and accordion persistence remain in place.

## Transform and history

Use the existing Move/Rotate/Scale tools (G/R/S; V for selection) or Structure Inspector numeric controls. The group pivot is the saved structure origin at its base; legacy groups derive a base-center pivot from their explicit members. Yaw rotates the group around world Y. Scaling uses the group's local axes, preserving relative transforms; non-uniform operations that require shear are rejected rather than approximated. Group move snaps the pivot to the 0.5 m X/Z grid, not each individual component. Whole structures may be raised explicitly while retaining connected internal geometry.

One-hand pinch/move/release translates all group members on the current construction plane. The existing two-hand Scale and Rotate gesture modes apply uniform scaling and yaw around the same group pivot. Existing calibration, thresholds, debounce, hand identity/readiness and loss/stall cancellation are unchanged. Mouse takeover, selection/mode changes and Undo cancel active previews. Ghosts cannot intercept raycasting. A completed transform is one shared command/history snapshot; unchanged transforms create no history entry.

Duplicate allocates new object and structure IDs, preserves roles/appearance and finds a free location for the entire copy. Undo/Redo restores exact snapshots/IDs. Ungroup removes membership while keeping components; Undo restores grouping. Toolbar duplicate/delete and Delete key honor whole-structure selection. Individual-component duplication creates a standalone copy, so it cannot accidentally join the source building.

## Ask HoloBuild edit workflow

Use the existing single input and microphone action. Final speech text and typed text enter the same dispatcher; microphone availability/provider behavior is unchanged. Supported deterministic requests work in Offline or Commands mode. LLM/Auto use the existing local planner for flexible interpretation; quick commands retain their deterministic path. Unrecognized wording in LLM/Auto can be interpreted as an edit; unsupported actions still fail safely.

Example requests:

- `Select the whole house`
- `Move the entire house right by 2 meters`
- `Rotate the whole structure 90 degrees`
- `Make the entire building 50% larger`
- `Make the house wider` (Offline default: local X factor 1.2)
- `Change all walls to brick`
- `Replace the roof material with polished metal`
- `Change floor 2 material in the house to concrete`
- `Duplicate this building`
- `Rename the whole house to Studio`
- `Ungroup this structure`
- `Delete the entire building`
- `Add another floor to the house`
- `Remove the top floor`
- `Duplicate floor 1 of the house`
- `Change the floor height of the house to 4 meters`

Move uses +X right, +Y up, -Z forward. Offline editing accepts explicit digit amounts, degrees, percentages/factors and the documented single-operation grammar. Use LLM mode for broader phrasing. Multi-operation Offline requests are rejected; do one edit at a time. LLM instructions also require one operation, or clarification/unsupported output.

The model returns a strict, small **intent plan**, never executable code or a replacement scene. Client and backend both validate the schema. Target resolution uses explicit scene membership. The client computes a whole-group result, checks geometry/budgets/collisions, and displays the target, affected component list and inert wireframe preview. **Confirm structure edit** applies that exact reviewed result as one atomic shared scene command; Cancel changes nothing. Scene/selection changes invalidate confirmation. Editing the prompt/settings or collapsing Ask cancels unconfirmed work and aborts in-flight inference. Unrelated objects, imported assets, lighting and colors are preserved.

For slow local inference, expand AI Settings and set Timeout to **120 seconds** (the D: private backend environment allows this existing maximum). Connection/model selection remains in the same optional settings. Auto fallback is explicitly labeled Offline; LLM failures never silently claim a model result.

## Floor relationships and supported limits

New deterministic house/tower/office templates store certified recipe parameters and explicit zero-based component floor indices. These support adding an upper floor, removing the top floor, duplicating a chosen floor on top (including its segmented openings and finishes), changing all storey heights, and changing floor/slab materials. Floor-layout relationships are persisted; roof/slab alignment, existing component IDs and finishes are retained where components match. Duplicate-floor operations copy actual layout rather than pretending a different upper layout is identical.

Before regeneration, compare saved recipe/layout geometry against actual members. A manually moved/scaled/deleted component invalidates the recipe for the entire affected group. Material/color edits do not. Missing, forged or mismatched recipes fail safely. Older groups retain their explicit membership but never acquire guessed floor relationships.

Limits remain: **120 components per structure, 200 scene objects, 32×40×32 m structure dimensions, ±50 m workspace, 0.1–20 component/group scales, 1–6 template floors, 2.5–5 m unscaled storey height**. Size and external collisions can further limit edits. A rejected operation does not partially apply or add history.

## Known limitations

- Adding new openings, stairs, balconies, arbitrary roof redesign and mixed multi-step geometry edits are unsupported. Existing template door/window openings are real segmented geometry, but editing does not invent a new opening by overlaying a decorative object. No hinges, stairs or structural engineering simulation.
- Floor layout editing applies to intact certified house/tower/office templates. Bridges, sheds, arbitrary LLM geometry, legacy groups and manually reshaped buildings still support valid group transforms/materials/duplication, but do not receive guessed floor regeneration.
- Rotation is yaw; arbitrary group pitch/roll is not offered. Non-uniform scale requiring shear is rejected. External collision validation retains conservative world-axis bounds, which can reject some close rotated placements even when visible surfaces do not intersect.
- Local-model interpretation remains dependent on model availability, response schema and prompt quality. All output is bounded and validated; unsupported/ambiguous/invalid requests preserve the scene.
- Automated landmark/video fixtures establish regression behavior, not physical webcam/microphone acceptance. No FPS improvement is claimed. Performance diagnostics continue reporting measured render/inference/camera/gesture timings.

## Persistence and architecture

Project version 1 remains backward-compatible. Each component keeps its stable object ID and `construction.structureId`, `partId`, role and optional level. A compact shared structure metadata record (name/type/base origin/yaw/scale, certified template, floor layouts and declared contacts) is embedded consistently on members. This uses existing scene snapshots and JSON/asset persistence, avoiding a parallel gesture-only group scene or separate history. Schema checks reject duplicate part identities and conflicting metadata within a group.

The strict shared edit schema is in `shared/editSchema.mjs`; the local provider endpoint is `POST /api/planner/edit`. The existing compatible `/chat/completions` adapter, backend-only credentials, allowlist, loopback/Origin checks, request/response limits, concurrency/rate guards and cancellation remain in use, so a future provider can be adapted without granting it scene authority. Inference is backend/provider work, never a synchronous browser rendering task. Commands batch scene mutations once; preview geometry/material pools are reused.

## Physical acceptance checklist

1. Build a house (Offline first), choose Select Entire Structure and point/pinch a visible part.
2. Move/release the whole building; check every component stays aligned. Undo once.
3. Choose Scale, open both pinches, pinch both and separate hands; release once. Undo.
4. Choose Rotate, arm both hands and turn the hand line; release. Check yaw/alignment and Undo.
5. During a grab, lose one hand or press Undo; ensure the preview cancels safely.
6. Ask for brick walls/metal roof, inspect the preview, Cancel once, then Confirm and Undo.
7. Add/duplicate/remove a floor; save/load and verify the group, finishes and level relationships.
8. Check a manual shape/imported model, mouse tools, sidebar/minimized camera continuity and no unwanted popup.
9. Try one LLM edit with qwen3:4b-instruct; report the wording/result and performance readings if tracking feels slow.

Physical acceptance is pending the user's test. Milestone 11 is not started.

If physical tracking feels slow, report the scene's object/component count and Gesture Diagnostics readings: Render FPS and frame p95, Camera presentation FPS and reported resolution/FPS, Inference rate and average/p95, Gesture updates/processing, and Execution/scheduler. Include whether preview/panels were minimized. These measurements distinguish rendering, capture and inference; do not interpret synthetic/headless test FPS as laptop webcam performance.


## Milestone 10.1 interaction update

Use the viewport's **Target: Part / Structure** control; it remains discoverable in every tool tab. Confirmation of a generated structure selects the whole structure and exposes Edit Structure. Part returns to ordinary component editing. Explicit select/rename/material/floor controls and shared atomic command/history/JSON metadata remain unchanged.

Auto now performs one-hand move and recognizes two-hand scale versus yaw on the retained selection; no mode switch or second surface hit is required. Capture each open pinch, pinch both, then separate hands or turn the hand line. A short neutral recognition phase rejects mixed motion; once active, the operation locks until release. Pending one-hand translation transfers into the same group frame and command, preserving one Undo and all relationships. Hand loss/scene changes/mouse takeover cancel. See GESTURES.md for tested arbitration settings and physical checklist. Existing certified floor/geometry/collision limits still apply; this milestone does not implement arbitrary pitch/roll or redesign.
