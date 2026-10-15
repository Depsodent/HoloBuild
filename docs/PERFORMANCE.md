# Performance record

## Measurements versus targets

The footer samples rendered FPS over one-second windows. Draw calls are sampled from Three.js renderer statistics. Values depend on hardware, browser visibility, scene size and GPU; no hardware benchmark is claimed at the foundation checkpoint.

Target: approximately 30 FPS or more during gesture control on the user's laptop. This is a target, not a verified result. DPR is capped at 1.75; shadow maps are 1024 square; history is bounded at 80 snapshots and scenes at 200 objects.

Synthetic browser tests may run under software WebGL and are correctness checks, not performance benchmarks. Use the physical laptop, camera and representative scenes to collect real metrics. Worker inference and instanced rendering should follow measured bottlenecks, not precede them.

## Milestone 4 observations

The production JavaScript bundle is approximately 1.31 MB minified / 367 KB gzip, with MediaPipe in a separate lazy chunk (~144 KB / 44 KB gzip); local WASM/model assets are additional. Vite warns about the large 3D bundle. Zod produces harmless annotation warnings. These do not fail the build.

Software-rendered browser tests can exceed the 250 ms tracking-loss window under CPU contention. Diagnostics confirmed that gaps restarted gesture recognition and correctly cancelled transactions; this affected collision/Undo tests intermittently. Gesture fixtures now use Playwright's controlled clock to advance continuous frames deterministically while retaining actual rendering, raycasting, validation and commands. The stalled-input test explicitly advances 350 ms without new frames. Camera/model tests still use real timing, and the production 250 ms safeguard is unchanged. Browser tests run serially and separately from builds/unit tests. Real webcam latency, lighting robustness and the target 30 FPS have not been measured. Preview updates avoid whole-shell rerenders, but the preview itself still renders at inference cadence.

## Milestone 7 build and resource observations

Measured final production build on 2026-10-15: main JavaScript 1,374.68 kB minified / 388.32 kB gzip; lazy GLTFLoader 44.80 kB / 13.22 kB gzip; separate vision chunk 144.27 kB / 43.72 kB gzip. These are Vite output sizes, not runtime throughput measurements. The existing large-chunk and third-party Zod annotation warnings remain. Model loading does not download decoders, texture sets or environment HDRs.

Four shared 256² RGBA procedural maps allocate about 1 MiB of base pixel data before mipmaps. Texture density uses shader projection, so changing repeat does not allocate another texture. Holographic highlights add shader arithmetic without an extra pass or bloom. Key shadows remain 1024²; fill casts no shadows. PMREM generation is once per renderer lifetime, not per material change.

Model duplicates share immutable geometry/materials/textures. Current scene and both bounded history stacks retain model resources until no longer referenced. Guards limit source and estimated geometry/texture cache allocation; see DEVELOPMENT.md for exact limits and supported static model formats. GPU estimates are conservative allocation checks, not measured driver memory. Large textures, many model submeshes, transmission and software WebGL can still reduce responsiveness. No Milestone 7 physical FPS/latency result is claimed. Measure the actual laptop with the camera running and representative scenes before choosing further optimizations.
