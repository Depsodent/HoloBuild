# Architectural primitives — capability audit and phased implementation

Audit baseline: local35eed57 (documentation only over application8f833f6); production/GitHub8f833f6. Working tree was clean before this work. No reset/recreation, provider configuration, hosted quota or security changes. No publication authorized for this work.

## Confirmed capabilities and gaps

- Six reusable renderer shapes already support materials, selection, mouse/gesture transforms, save/load and command history. Stairs do not require another scene renderer or gesture-only data model.
- ConstructionPlan has strict component identity/roles and120-part/200-scene budgets. Structures have shared frame, metadata, template and floor layouts; edits use the existing pure applyStructure and command-manager history.
- Template slabs are solid rectangles at level*(storeyHeight+0.2), with top surface0.2m above that datum. A valid stair must span storeyHeight+0.2m and cut its destination slab. Graph connectivity alone is not a usable stair connection.
- Front/back wall openings are already made from piers/sills/lintels and static panels. Counts, selected floor counts, global window size and ground entrance offset exist; arbitrary individual opening identity, facade, offset and per-opening dimensions do not.
- Floor redesign checks template integrity before rebuilding. Matching existing part IDs can become unstable when earlier opening counts change; preserve geometrically unchanged components by stable matching when extending layouts.
- Conversational refinement explicitly rejects stairs/balconies/hinges, and unconfirmed generation previews currently require confirmation before refinements. Both must change only after valid geometry builders and preview tests exist.
- Generic Part manipulation invalidates template certification. Parametric assemblies need explicit identity/assembly editing and must not silently permit a single tread to break its floor connection.
- Structure movement/two-hand transforms can already move all member shapes together. Retain that path; extend parameter editing through existing commands and Inspector controls.

## Smallest safe implementation sequence

1. **Geometry and persistence foundation:** backward-compatible optional staircase recipes and assembly IDs; steps from existing cube shapes; actual rectangular upper-slab void split into non-overlapping floor pieces; adjacent-floor elevation, exterior-wall clearance, approach/exit landing, overlap and existing overall geometry validation. Test before routing any conversational request to it.
2. **Staircase editing and conversation:** existing structure design operation carries bounded staircase recipes. Add/reconfigure/remove through the same pure edit/preview/confirm/atomic-history path. Parameter Inspector selects an assembly, not an accidental individual tread. Clarify missing floor/location; retain current building context. Enable unconfirmed-preview refinement without confirmed-scene mutation or premature history entries.
3. **Editable openings:** reusable segmented facade builder, explicit bounded door/window recipes and stable identity; selected-floor counts and individual add/remove/move/resize. Preserve unrelated wall faces/components and their appearance. Panels remain static; animated hinges are a separate unimplemented behavior.
4. **Balconies:** bounded slab/railing recipes attached at actual floor elevation; explicit facade/offset, access opening and collision/extent checks. Use ordinary member shapes and the same structure command path.
5. **Integration regression gate:** multi-floor connections, rotated/scaled structures, stale previews, Part/Structure scope, mouse/Inspector, existing one/two-hand behavior, exact history and save/load. Unit/backend/browser/build and rendered-geometry evidence at each substantial phase; local checkpoint only after successful validation.

## Initial geometry boundaries

Straight flights use quarter-turn local orientations (0/90/180/270degrees),4–32steps, explicit rise/run/width and floor endpoints. Floor-to-floor rise must match exactly; invalid values are rejected, not silently adjusted. At most one stair opening per destination floor in this first builder. Overlapping successive flights are rejected. A minimum0.6m visual-model approach/exit region is checked; this is not a claim of regulatory egress, headroom, structural support or accessibility compliance. More complex turns, spirals, engineering simulation and animated hinged doors are outside this safe initial scope.

Live provider verification, if required after integration, must be bounded and preserve existing free-tier admission. Physical webcam/microphone/device acceptance cannot be inferred from recorded/simulated tests. No push or deployment without fresh explicit owner approval.
