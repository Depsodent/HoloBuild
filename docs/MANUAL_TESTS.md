# Manual acceptance checklist

Record actual observations and hardware/browser details. Unchecked cases have not been performed.

## Mouse foundation

- [ ] A visible cube, perspective ground grid, colored axes and HOLOBUILD branding appear.
- [ ] Left-drag empty space orbits, right-drag pans, wheel zooms.
- [ ] Clicking a cube selects it; empty space deselects it.
- [ ] Move/rotate/scale handles work; a single undo reverses a complete drag.
- [ ] Inspector axes, name, material and color update the selected object.
- [ ] Duplicate creates an independent ID; delete and reset can be undone.
- [ ] Save downloads a JSON file; Load restores it; malformed JSON preserves the existing scene.
- [ ] Narrow screen layouts remain navigable; keyboard focus indicators are visible.

## Physical webcam acceptance (not automated)

| Condition                         | Expected observation                                         | Actual result |
| --------------------------------- | ------------------------------------------------------------ | ------------- |
| Permission denied                 | Recovery message; mouse editing still works                  | Not tested    |
| Camera started/stopped            | Preview appears; camera hardware indicator turns off on Stop | Not tested    |
| Bright even lighting              | Landmarks follow one hand                                    | Not tested    |
| Dim/backlit setting               | Reduced reliability is visible; no stray committed movement  | Not tested    |
| Left hand / right hand            | Mirrored index cursor follows each hand                      | Not tested    |
| Different hand sizes/distances    | Palm-normalized pinch remains usable                         | Not tested    |
| Fast movement / partial occlusion | Lost hand cancels uncommitted drag                           | Not tested    |
| Pinch, move, release              | One snapped planar move and one undo entry                   | Not tested    |
| Release outside valid workspace   | Invalid preview rejected                                     | Not tested    |
| Palm held briefly                 | Tool menu opens once per activation                          | Not tested    |
| Two visible hands                 | One-hand mode only; two-hand transforms unsupported          | Not tested    |
| Background clutter                | Track confidence/loss is reflected honestly                  | Not tested    |

Do not mark the physical milestones accepted merely because synthetic tests pass. Record observed FPS and inference milliseconds in PERFORMANCE.md with hardware and scene count.
