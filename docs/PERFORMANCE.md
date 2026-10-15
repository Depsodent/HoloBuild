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

## Milestone 7.1 — separate rates and latency — 2026-10-15

These are **single rolling-window observations**, not a controlled benchmark and not physical-webcam results. Each used headless Edge/SwiftShader at 1280×720, a 640×480 canvas requesting 30 FPS, real local CPU MediaPipe with no hand image, and a ten-second settling period. Main-thread timer contention also affects the synthetic source. The app UI changed between initial and final runs; system load and warm-up vary. Inference-duration differences cannot be attributed to scheduling alone.

| Observation | Legacy CPU / adaptive RAF | Experimental worker CPU | Final default CPU / fresh frames |
| --- | ---: | ---: | ---: |
| Render FPS | 16.7 | 25.4 | 9.7 |
| Render frame p95 (ms) | 155.9 | 71.9 | 205.6 |
| Render frame std deviation (ms) | 55.0 | 19.2 | 75.2 |
| Camera presentation FPS | 8.9 | 26.0 | 4.8 |
| Inference updates/s | 5.5 | 3.0 | 9.8 |
| Mean inference (ms) | 124.2 | 273.2 | 82.6 |
| Gesture updates/s | 5.5 | 3.0 | 9.7 |
| Mean gesture/controller processing (ms) | 0.15 | 0.35 | 0.12 |
| Processing → next render callback (ms) | 139.2 | 316.0 | 91.7 |
| Result → next render callback (ms) | 9.2 | 31.6 | 9.4 |

The worker improved renderer responsiveness here but reduced tracking throughput and could exceed the existing 250 ms loss guard. It is optional/experimental, not automatically enabled. Main-thread CPU remains the accepted default. The final default improves update frequency in this sample while reducing render throughput; do not describe it as an overall FPS improvement. Real GPU acceleration/camera input may produce different tradeoffs. No GPU delegate or confidence thresholds were changed.

Diagnostics use independent two-second windows, published at most twice a second. Camera presentation FPS uses video callback `presentedFrames`; it is **not sensor capture FPS**. Track settings are reported/negotiated values rather than measurements. A RAF watchdog handles hidden/unsupported video callbacks and shares duplicate suppression/deadlines, without a frame queue. Skipped presentation counts become unavailable if callback metadata cannot be associated reliably; they are never described as measured sensor drops. Capture timestamp was unavailable in these runs, so true camera/hand-to-cursor latency is unknown. Processing-to-render callback includes inference/recognition/queue wait but excludes exposure, configured smoothing and GPU/compositor presentation.

Preserved filters: 45 ms landmark smoothing; 85 ms two-hand interpolation; independent 90 ms pinch activation/release dwell. These constants are not measured latency and their effects depend on motion and sampling. New logic removes the old inference-duration×1.8 delay, avoids duplicate video frames, permits only one inference in flight, throttles UI-only updates and skips hidden skeleton drawing. Quality profiles request different capture sizes/target rates; they do not guarantee hardware performance.

Reproduce against the running development server:

```powershell
node scripts/benchmark-camera.mjs --output camera-main.json
node scripts/benchmark-camera.mjs --worker --output camera-worker.json
```

Set `HOLOBUILD_URL` if the server uses a different URL. Runs launch isolated synthetic contexts and do not access the laptop webcam. Raw observations: [2026-10-15-camera.json](benchmarks/2026-10-15-camera.json). Final production sizes are recorded with the 7.1 verification log; existing bundle/Zod warnings remain. Physical laptop acceptance is required before further optimization or Milestone 8.

The final 7.1 production build reports main JavaScript 1,389.99 kB / 392.97 kB gzip, optional tracking worker 144.79 kB, lazy worker client 1.73 kB / 0.82 kB gzip, lazy GLTFLoader 44.80 kB / 13.22 kB gzip, vision bundle 144.27 kB / 43.72 kB gzip and CSS 24.74 kB / 6.04 kB gzip. These are transfer/build sizes, not runtime timing or physical memory measurements. The optional worker is loaded only when selected and supported.
