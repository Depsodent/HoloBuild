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

## Milestone 10.1 audit and recovery — 16 October 2026

The following are isolated **single two-second rolling windows** after ten seconds settling, headless Edge/SwiftShader, 1280×720, real local MediaPipe and a uniform synthetic 640×480 canvas requesting 30 FPS; no real hand, exposure timestamp, physical camera, hardware GPU or concurrent Ollama generation. Before/after runs differ in warm-up/system scheduling and final instrumentation. They establish separate bottlenecks, **not an overall performance improvement or physical latency benchmark**. No inference threshold, debounce or smoothing was lowered. Raw JSON is in `docs/benchmarks/2026-10-16-10.1-*.json`; the early worker baseline is also retained.

| Reading | Before CPU | Final CPU | Final worker CPU | Optional GPU (software) |
| --- | ---: | ---: | ---: | ---: |
| Render FPS | 9.5 | 8.6 | 29.4 | 2.3 |
| Camera presentation FPS | 4.7 | 3.8 | 27.8 | 1.1 |
| Inference Hz | 9.6 | 8.7 | 4.8 | 3.4 |
| Mean inference ms | 89.1 | 97.4 | 171.7 | 272.7 |
| Inference p95 ms | 113.3 | 272.8 | 234.8 | 301.4 |
| Gesture Hz | 9.4 | 8.7 | 4.8 | 3.4 |
| Render frame p95 ms | 220.4 | 453.3 | 63.9 | 600.8 |
| Render variation/std ms | 73.8 | 111.1 | 18.1 | 145.7 |
| Process → next render callback ms | 99.1 | 94.9 | 197.3 | 287.1 |
| Result → next callback ms | 7.0 | 6.4 | 23.6 | 10.5 |
| Main-thread tasks >50 ms / 2 s | unavailable | 11.0 | 1.0 | 3.0 |
| Measured long-task duration / 2 s ms | unavailable | 1614.0 | 63.0 | 1471.0 |

Default CPU remains unchanged. Long synchronous inference (~97 ms mean in this final sample) occupies the main thread; its observed tasks over 50 ms totaled 1614 ms in the last two seconds. This is a correlation of actual observer entries, not exclusive attribution of every task to MediaPipe. Worker mode frees camera/render callbacks here but its slower inference (~4.8 Hz) can approach/exceed the 250 ms loss safeguard. GPU delegate under **software** WebGL was worse, so it is optional with CPU initialization fallback, never auto-enabled. Hardware GPU/laptop tests may differ. Do not infer real camera quality or end-to-end hand latency from these numbers; the target 30 FPS gesture interaction is still unverified.

Audit findings and targeted changes:

- Existing frame-pacer deduplicates video media times; one inference may run at once, no backlog; RVFC and RAF watchdog share pacing. No duplicate count increase appeared in these windows. Inference Hz may exceed distinct camera presentation FPS because the watchdog accepts fresh video media time between sparse presentation callbacks; these are different observations, not sensor frame counts. Skipped-frame and capture latency stayed unavailable and are not guessed.
- Existing visibility cleanup stops capture/inference when the document hides. Minimization only hides the preview; it does not stop video/tracking. UI-only hand publication remains throttled (~150 ms), performance publication at 500 ms. Per-frame recognition/controller updates stay outside React.
- Scene shell formerly followed parent FPS changes; memoized Scene and BuildingObject plus retained identities for unchanged validated objects avoid unrelated whole-scene React work. Bounds cache uses geometry/transform signatures and cloned results, preserving validation even if an object changes in place. Static shadow maps now invalidate on object/lighting/preview/import changes and mouse-gizmo changes; no change to scene geometry, material appearance, render resolution or shadow quality.
- Generated scenes still incur meshes/materials/submeshes and conservative validation work; 120-part plans / 200-object scenes remain bounded. No instancing rewrite or claimed large-scene FPS uplift. Imported assets and transmissive surfaces can remain costly.
- CPU remains Balanced request 640×480 / target 30. Lower capture profiles, optional worker and GPU execution are user-selectable experiments; actual negotiated settings are reported. No additional cursor prediction/filter delay was added. Existing 45/85 ms smoothing is preserved to avoid breaking accepted pinch behavior.
- Optional compact diagnostics exposes Render FPS, Camera presentation FPS, Inference Hz, p95, Gesture Hz and process-to-next-render callback. Full details add render p95/std, real `PerformanceObserver` tasks over 50 ms in the last two seconds, engine/scheduler and unavailable capture timing. Next callback excludes exposure, smoothing and compositor/GPU presentation. New samples/counters are bounded and reuse the existing UI publication cadence.
- Ollama residency/VRAM is optional request telemetry, not proof that it caused camera contention. Camera benchmarks were separate from live model calls; simultaneous physical inference contention needs user measurements. No model unload or hardware changes were made.

Reproduce sequentially: `node scripts/benchmark-camera.mjs --output <json>`, then `--worker` or `--gpu`. Do not run builds, browser suites or model generation concurrently. New unit checks cover rolling metrics and cache invalidation; serial browser checks cover minimized tracking and cleanup.

For physical lag reports include scene count, active execution/profile/resolution, the six compact readings, full render variation/long-task values, whether Ollama is generating, and panel/window visibility. Compare the same scene and lighting with CPU/worker/optional GPU separately. A high render FPS with low inference/gesture Hz still means hand control is slow. Physical webcam/microphone acceptance remains pending.
