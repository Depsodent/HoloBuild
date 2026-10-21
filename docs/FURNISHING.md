# Furniture and interactive Walkthrough (Milestone 13.1)

The editor and Walkthrough share the same native catalog, scene validation and command/history manager. Furniture is an independent selectable Part, not a separately mutated scene or an invented building component. No external asset downloads or new services are needed.

## Movement

WASD moves; Space jumps only from actual ground/support contact; hold Shift to sprint. Walking is 2.2 m/s, sprinting 4.4 m/s, eye height 1.6 m. Gravity is 9.8 m/s² with an internal 4.2 m/s launch (about 0.9 m clear-ground rise). Swept horizontal/vertical substeps retain walls, ceilings and landings; time steps are bounded to 0.1 s, so extreme rendering stalls slow simulated motion instead of tunneling. Jumping again in midair is ignored. Blur, pause, pointer-lock loss, Reset and exit clear held input.

The primary toolbar is still exactly **Look Around | Exit Walkthrough | Reset Position | Controls**. Help documents movement and keyboard/touch fallback. Jump/Sprint currently use keyboard controls; physical touch acceptance remains pending. The global Stop Camera remains accessible.

## Place furniture

In the editor open **Build → Furniture & interiors**. While walking use the separate **Furnish** action. Opening the catalog releases mouse lock and pauses movement. Search or choose a category, then choose an item. This only starts a temporary preview. Aim at the required support in the canvas (below the horizon for floors); green means valid, red explains rejection. In mouse lock, the center of the view aims; otherwise the canvas cursor aims. Surface reach is limited to 12 m.

**Q/E** or Rotate left/right turns a free-standing preview in 15° steps. Wall items align to the hit face and cannot be freely yawed off that wall. **Click the canvas**, **Enter**, or **Place furniture** confirms once. Catalog/control clicks cannot place items accidentally. **Escape** or **Cancel preview** discards the ghost without scene/history changes. Browse furniture continues; Done furnishing returns to normal read-only walking. Controls help temporarily hides the furnishing panel to avoid overlap.

In Furnish, click an existing item to select it, then Reposition or Remove. Reposition uses the same validated ghost/confirmation; Remove is one reversible command. Normal editor transforms/history remain blocked while walking. Exit Walkthrough to use Inspector, Undo/Redo and the full mouse/gesture tools. Exit restores the editor camera/layout; explicitly confirmed furniture remains in the scene. Reset affects only the camera.

## Placement and collision rules

- Floor-standing items require workspace ground or full, flat floor/platform coverage. Generated slab roles and multi-floor elevations are recognized. Exact rectangle-union checks reject floor holes even if all four corners are supported. Floors/tabletops/ceilings use millimetre-scale tolerances, not arbitrary floating placement.
- Surface decor (table lamp, monitor, television) requires a supported table, desk, counter or cabinet top. Wall items require a full upright axis-aligned wall segment; ceiling lights require full coverage under a flat slab/box underside. Unsupported tilted/non-orthogonal attachment surfaces are rejected.
- Conservative bounds reject wall/object intersections and furniture overlap. Native doorway approaches and stair treads/headroom/approaches remain reserved. Confirm revalidates the scene snapshot and current camera body to avoid stale placement or trapping. These are detectable access guards, not a guarantee of every room circulation route or any building-code compliance.
- Furniture stays upright with scale 0.25–4 per local axis. Inspector scaling preserves its floor/tabletop, wall or ceiling attachment plane. All existing position/rotation/dimensions, color, material and optical controls apply subject to validation; invalid changes remain unapplied. Furniture is independent of its host building: architectural edits must preserve its support, or furniture must be repositioned/removed first. No automatic room ownership or building-follow transform is claimed.
- Navigation uses one conservative box for substantial enclosed items and lightweight part boxes for open/slender items. Open spaces are approximate, not per-triangle collision. Safe entry/reset never deliberately spawns inside or on top of furniture. Collision data refreshes on confirmed scene changes and clears on exit.

## AI furnishing

Ask HoloBuild supports native object creation and selected-object changes with the existing preview → confirmation → one atomic command flow. Examples: **Add a sofa at 4,0,3** (base X,Y,Z in metres), **Change this sofa to blue**, **Rotate the dining table 90 degrees**, **Remove the selected wardrobe**. A selected floor/tabletop Part can establish a known support; actual geometry must still validate.

Gemini and local Ollama share a bounded **furnish** response variant with exact catalog IDs. Flexible wording can reach the real provider; explicit supported requests can use the native deterministic path, including Offline. Model-proposed coordinates must match explicit user coordinates or a verified selected support. Unknown rooms, near-window requests, wall/ceiling faces and ambiguous locations ask for clarification/catalog aiming rather than inventing room labels or coordinates. Whole-room automatic furnishing, multiple-item layout generation and custom downloaded furniture are not claimed. Existing house/window/stair/balcony routing and strict geometry validation are preserved.

## Catalog: 45 distinct native presets

Recognizable multi-part low-poly meshes use canonical physical bounds, a consistent base plane and +Z front orientation. Dimensions shown in the catalog are width × height × depth in metres; material/color/optics remain editable. Bookshelf appears in both Living Room and Office and Study, but counts as one preset.

### Living Room

| Preset | Attachment |
| --- | --- |
| Two-seat sofa | floor |
| Three-seat sofa | floor |
| Sectional sofa | floor |
| Armchair | floor |
| Coffee table | floor |
| Side table | floor |
| TV stand | floor |
| Television | surface |
| Bookshelf | floor |
| Floor lamp | floor |
| Rug | floor |

### Bedroom

| Preset | Attachment |
| --- | --- |
| Single bed | floor |
| Double bed | floor |
| Bunk bed | floor |
| Wardrobe | floor |
| Bedside table | floor |
| Dresser | floor |
| Study desk | floor |
| Desk chair | floor |
| Floor mirror | floor |

### Kitchen and Dining

| Preset | Attachment |
| --- | --- |
| Dining table | floor |
| Dining chair | floor |
| Kitchen counter | floor |
| Kitchen cabinet | wall |
| Refrigerator | floor |
| Stove / cooktop | floor |
| Sink | floor |
| Kitchen island | floor |
| Bar stool | floor |

### Bathroom

| Preset | Attachment |
| --- | --- |
| Toilet | floor |
| Washbasin | floor |
| Shower enclosure | floor |
| Bathtub | floor |
| Bathroom mirror | wall |
| Bathroom cabinet | wall |

### Office and Study

| Preset | Attachment |
| --- | --- |
| Bookshelf | floor |
| Office desk | floor |
| Ergonomic chair | floor |
| Filing cabinet | floor |
| Computer monitor | surface |

### Decor and Utility

| Preset | Attachment |
| --- | --- |
| Indoor plant | floor |
| Wall clock | wall |
| Ceiling light | ceiling |
| Table lamp | surface |
| Storage shelf | floor |
| Shoe rack | floor |

## Persistence, performance and acceptance

Furniture uses stable IDs and strict preset metadata in existing version-1 portable JSON. Older projects still load; older application versions may reject new furniture types and should be upgraded. Create, duplicate/delete, transform, materials, AI edits and scene loads share normal exact Undo/Redo. No furniture-only history or serialized camera state is introduced.

Catalog geometry is merged by palette and shared per preset, with a bounded cache retained across instances. Temporary build geometries are disposed, per-instance PBR materials have explicit cleanup and no per-object global keyboard handlers are added. Collision proxies are cached by immutable scene identity; inactive preview frames return immediately. See PERFORMANCE.md for measured 30/50/100-item observations and limitations once recorded.

Automated synthetic landmarks and permission/lifecycle tests do not establish physical webcam, microphone, touch, GPU or friend-laptop acceptance. Those remain pending. Check MANUAL_TESTS.md and the current release receipts. No new paid services, quotas, credentials or engineering certification.
