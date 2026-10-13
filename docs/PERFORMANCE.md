# Performance record

## Measurements versus targets

The footer samples rendered FPS over one-second windows. Draw calls are sampled from Three.js renderer statistics. Values depend on hardware, browser visibility, scene size and GPU; no hardware benchmark is claimed at the foundation checkpoint.

Target: approximately 30 FPS or more during gesture control on the user's laptop. This is a target, not a verified result. DPR is capped at 1.75; shadow maps are 1024 square; history is bounded at 80 snapshots and scenes at 200 objects.

Synthetic browser tests may run under software WebGL and are correctness checks, not performance benchmarks. Use the physical laptop, camera and representative scenes to collect real metrics. Worker inference and instanced rendering should follow measured bottlenecks, not precede them.

## Milestone 4 observations

The production JavaScript bundle is approximately 1.31 MB minified / 367 KB gzip, with MediaPipe in a separate lazy chunk (~144 KB / 44 KB gzip); local WASM/model assets are additional. Vite warns about the large 3D bundle. Zod produces harmless annotation warnings. These do not fail the build.

Software-rendered browser tests can exceed the 250 ms tracking-loss window under CPU contention. Diagnostics confirmed that gaps restarted gesture recognition and correctly cancelled transactions; this affected collision/Undo tests intermittently. Gesture fixtures now use Playwright's controlled clock to advance continuous frames deterministically while retaining actual rendering, raycasting, validation and commands. The stalled-input test explicitly advances 350 ms without new frames. Camera/model tests still use real timing, and the production 250 ms safeguard is unchanged. Browser tests run serially and separately from builds/unit tests. Real webcam latency, lighting robustness and the target 30 FPS have not been measured. Preview updates avoid whole-shell rerenders, but the preview itself still renders at inference cadence.
