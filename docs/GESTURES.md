# Gesture milestones

## Recognition implemented

MediaPipe indices: wrist 0, thumb tip 4, index tip 8, middle tip 12, ring tip 16, little tip 20. Palm size is the larger of wrist-to-middle-MCP distance (0–9) and index-to-little-MCP distance (5–17). The Euclidean thumb/index distance (4–8), divided by palm size, makes pinch thresholds less sensitive to camera distance and hand size. This is a heuristic, not a calibrated probability.

- Pinch: normalized ratio below 0.32; remains active until ratio reaches 0.48. Activation/release must persist 90 ms.
- Pointing: index extended, other three fingers curled, for 120 ms.
- Open palm: all four fingers extended for 350 ms. Thumb orientation is not used for this class.
- Fist: all four curled, not pinching, for 220 ms. Recognition alone does not authorize destructive actions.
- Unknown: ambiguous extension pattern. No hand: missing/non-finite points or implausibly small palm.

Extension combines a PIP bend angle above 150 degrees with fingertip distance from wrist greater than PIP distance by 12%. Coordinates are MediaPipe normalized x/y/z, not metric depth. Orientation extremes and occlusion can break these heuristics; test both hands separately.

`LandmarkSmoother` uses a time-aware exponential filter: alpha = 1 − exp(−dt/45 ms). It resets after missing data or gaps over 250 ms. The detector maintains candidate, stable gesture, candidate start time and a pinch latch. Missing input resets immediately; reappearance requires fresh dwell. Configuration lives in `vision/calibration.ts`.

The mirrored cursor is `(1 − index.x, index.y)`. High-frequency data stays in module streams; the visible gesture status is throttled to about 7 Hz plus immediate transitions. Stable/candidate indicators are not model confidence scores.

Development-only `?testInput` exposes a visibly labeled landmark injection bridge. It is eliminated from production builds and rejects injection while the real camera runs. Unit fixtures and browser tests exercise the same detector and pipeline. Headless WebGL tests run serially because CPU contention can legitimately exceed the 250 ms loss threshold.

Gesture browser fixtures use a controlled Playwright clock so host scheduling cannot accidentally turn continuous test input into hand loss. Real Three.js picking, meshes, collision checks and undo commands still execute. Camera inference tests use real time; physical hand acceptance remains separate.

Physical tests must include both hands separately, different hand sizes, lighting and camera distance, fast motion, occlusion and clutter. Two-hand interaction belongs to a later milestone.
