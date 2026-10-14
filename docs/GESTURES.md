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
