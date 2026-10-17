# Gesture milestones

## Recognition implemented

MediaPipe indices: wrist 0, thumb tip 4, index tip 8, middle tip 12, ring tip 16, little tip 20. Palm size is the larger of wrist-to-middle-MCP distance (0–9) and index-to-little-MCP distance (5–17). The Euclidean thumb/index distance (4–8), divided by palm size, makes pinch thresholds less sensitive to camera distance and hand size. This is a heuristic, not a calibrated probability.

- Pinch: normalized ratio below 0.32; remains active until ratio reaches 0.48. Activation/release must persist 90 ms.
- Pointing: index extended, other three fingers curled, for 120 ms.
- Open palm: all four fingers extended for 350 ms. Thumb orientation is not used for this class.
- Fist: all four curled, not pinching, for 220 ms. Recognition alone does not authorize destructive actions.
- Unknown: ambiguous extension pattern. No hand: missing/non-finite points or implausibly small palm.

Extension combines a PIP bend angle above 150 degrees with fingertip distance from wrist greater than PIP distance by 12%. Distance/angle features convert normalized y to image-width units using the source video aspect ratio; x and z already use that scale. Cursor mapping continues to use the original normalized x/y. These are not metric depth coordinates. Orientation extremes and occlusion can break these heuristics; test both hands separately.

`LandmarkSmoother` uses a time-aware exponential filter: alpha = 1 − exp(−dt/45 ms). It resets after missing data or gaps over 250 ms. The detector maintains candidate, stable gesture, candidate start time and a pinch latch. Missing input resets immediately; reappearance requires fresh dwell. Configuration lives in `vision/calibration.ts`.

The mirrored cursor is `(1 − index.x, index.y)`. High-frequency data stays in module streams; the visible gesture status is throttled to about 7 Hz plus immediate transitions. Stable/candidate indicators are not model confidence scores.

Development-only `?testInput` exposes a visibly labeled landmark injection bridge. It is eliminated from production builds and rejects injection while the real camera runs. Unit fixtures and browser tests exercise the same detector and pipeline. Headless WebGL tests run serially because CPU contention can legitimately exceed the 250 ms loss threshold.

Gesture browser fixtures use a controlled Playwright clock so host scheduling cannot accidentally turn continuous test input into hand loss. Real Three.js picking, meshes, collision checks and undo commands still execute. Camera inference tests use real time; physical hand acceptance remains separate.

Physical tests must include both hands separately, different hand sizes, lighting and camera distance, fast motion, occlusion and clutter. Two-hand interaction belongs to a later milestone.

## Webcam interaction repair — 2026-10-14

Binary pinch state has its own 90 ms activation/release timers, independent of pointing/palm/fist/unknown pose dwell. Changing the other fingers during release cannot restart the pinch release timer. Thresholds remain 0.32 / 0.48; no threshold was loosened to mask the controller bug. Both live video and synthetic fixtures supply landmarks and source aspect ratio to the same smoothing, detector, stream, controller and raycaster.

An open pinch arms aiming even with relaxed middle/ring fingers. A real selectable ray hit is briefly retained during closure (maximum 500 ms, 0.08 normalized displacement); stale/distant hits cannot select a cube. The new grab offset is captured at closure. Release freezes the last preview while debouncing, then commits exactly once if valid. A fist cancels; missing input, stalls, tracking jumps, off-screen coordinates, UI obstruction and mouse takeover also cancel safely.

Open palm never opens tools. Help → Open gesture tools is the only opening action. The virtual cursor never dispatches generic DOM clicks.

Expand Gesture diagnostics to inspect the normalized distance, unchanged thresholds, raw threshold latch, debounced pinch state, recognized/candidate pose, target, current selectable ray hit, transaction phase and rejection reason. A captured recent target can remain selected while the current ray hit reads none. Tracking confidence is unavailable from the result and is labelled accordingly; handedness confidence is not substituted. Handedness does not gate interaction; the preview and cursor each mirror horizontal coordinates once.

Calibration is deferred until actual closed/open distance readings show a threshold issue. The current changes fix independent arming, closure targeting, release debounce and image-aspect errors without weakening thresholds. Synthetic relaxed-finger/depth/closure sequences are reproducible approximations, not recorded physical hands or proof of physical acceptance.

## Milestone 6 extension

Each tracked hand now owns its own unchanged GestureDetector and LandmarkSmoother. Spatially matched IDs survive result reordering when unambiguous; primary hand loss/replacement emits cancellation into the legacy stream. Close wrists and large/gapped movements are treated conservatively. The existing thresholds remain 0.32 / 0.48 with 90 ms pinch activation/release, 45 ms landmark smoothing and 250 ms loss gap.

Two-hand scale/rotation require explicit mode selection and fresh open-pinches before closed-pinches. Scale uses width-normalized pinch-reference distance, component-aware uniform limits and 85 ms time-aware transform smoothing. Rotation unwraps successive 2D line angles and applies only a world-Y quaternion rotation, including tilted objects. No 3D palm orientation is inferred. Navigation is an explicit one-hand mode with smoothed reference movement and camera-only state. Loss, ambiguity, jumps, mode/scene edits, mouse takeover and UI dragging cancel/rearm safely.

The opt-in menu defaults disabled, requires stable open palm plus 1.2 s hold, and cannot rearm from pinch release. Neutral pointing/no-hand dwell, manipulation guard and menu cooldown prevent repeated reopening; mouse/UI activity suppresses activation. Current tracked IDs, gestures, ratios and model handedness scores are visible in diagnostics. Handedness scores are not detector tracking-confidence values. Milestone 6 physical webcam testing remains pending.

## Milestone 7.1 interaction refinement

Milestones 6, 6.1 and 7 have since been accepted by the user; 7.1 physical acceptance remains pending. Select once with mouse or one-hand pinch, then choose Scale or Rotate in Construction Tools → Gesture Controls. An empty selection in either mode also accepts a one-hand selection-only pinch. Two-hand transformations act on the retained object without another ray hit.

Open each pinch independently before closing it. The first hand may wait up to four seconds while the second arrives, stabilizes and prepares; they no longer have to be open simultaneously. Status reports readiness and active transformation. Both active pinches capture a fresh baseline to avoid an activation jump. Releasing confirms one changed transform; loss/cancellation requires fresh open-pinches. Thresholds, debounce and smoothing are unchanged. Camera settings/calibration and the detailed diagnostics now live in remembered collapsible groups; compact feedback and global Stop camera stay visible.


## Milestone 10.1 — Auto is the normal interaction (supersedes explicit-mode instructions)

The viewport's always-visible **Target: Part / Structure** chooses the entity. Auto is the default; Edit → Advanced gesture settings retains Move, Scale, Yaw and Camera Pan overrides. Nothing changes the established 0.32/0.48 pinch hysteresis, 90 ms pinch dwell, 45 ms landmark smoothing, calibration, identity matching or 250 ms loss guard.

Point/pinch/move/release uses the existing one-hand raycaster/controller. With a selected entity, open each pinch once, then pinch both (up to four seconds apart; do not re-aim at the surface). Both stable pinches capture a fresh camera-plane baseline. Auto holds a neutral Detecting state until radial or angular motion clearly dominates. An existing move freezes while the second hand joins; its pending translation is transferred, not committed, so a completed move-plus-scale/yaw is one Undo. Losing a hand cancels the whole uncommitted operation.

Arbitration compares `abs(log(distance/reference)) / 0.10` against `abs(unwrapped angle) / (π/18)`. The winner must reach 1 and exceed the other by 1.35× for at least 120 ms and three updates. Candidate resets below 0.75 activation or on ambiguous dominance. These starting values have reproducible noise/ambiguity/locking tests; physical suitability is pending. Advanced controls expose bounded thresholds/dwell/margin. Once chosen, the operation stays locked until release. Uniform scaling uses established component limits; rotation is world-Y yaw from the webcam-plane hand line, not unrestricted 3D orientation. Existing pivot/group validation is reused.

Small temporary hand guides show readiness, Detecting, active scale multiplier/yaw and release hints. With no hands, the default viewport stays clear. Conflicting circular/radial motion remains neutral; crossing hands, occlusion, tracking jumps, stale frames, mouse takeover and Undo cancel safely. Reopen pinches to rearm after cancellation. The optional palm menu remains disabled by default and preserves its sustained hold/cooldown/release suppression.

Physical acceptance: test Part and Structure; one-hand move; staggered second hand during a grab; radial scale; line-turn yaw; release/Undo/Redo; hand-loss and Undo during an active transform; imported model; minimized camera. Automated landmarks are not physical verification.

## Milestone 10.2 — delegate selection and mounted navigation

Gesture → Camera settings offers **Auto / GPU / CPU**, plus the retained experimental Worker CPU option. Stop capture before switching, then Start. This explicit lifecycle releases the old detector and cancels only an uncommitted operation; scene, selection and calibration survive. Fresh installations use Auto; an existing saved CPU/GPU/worker preference is respected. Auto attempts GPU when the existing scene reports WebGL2 without a known software renderer; otherwise it uses CPU. GPU is reported active only after successful creation. Initialization or runtime GPU failure falls back to CPU; runtime fallback cancels an active manipulation safely. A failed CPU path still reports an error and allows retry.

No gesture thresholds, identity rules, smoothing, debounce or automatic arbitration changed. Switching left tabs does not stop capture or dispose MediaPipe. Inactive preview skeleton drawing is skipped; hidden-video callback suspension is covered by the existing shared-pacer RAF watchdog. Exactly one inference remains in flight, repeated video times are ignored and asynchronous detector creation is serialized across stopped/restarted starts.
