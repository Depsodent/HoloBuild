# Performance record

## Milestone 13.1 furniture observations — 21 October 2026

One serial 1440×960 headless Edge/SwiftShader run loaded six repeating native presets in non-overlapping ground placements; no camera, model call, build or other browser suite ran concurrently. These are short software-renderer observations, not physical hardware acceptance or a before/after FPS claim.

| Furniture items | Window keydown / blur listeners | Sampled RAF median ms | Load + mount ms | Scene mesh instances / triangles |
| --- | --- | ---: | ---: | ---: |
| 30 | 3 / 1 | 76.5 | 387 | 80 / 3180 |
| 50 | 3 / 1 | 111.1 | 483 | 133 / 5268 |
| 100 | 3 / 1 | 166.8 | 648 | 267 / 10572 |

Listeners stay at **3 keydown / 1 blur** for every size and after five Walkthrough visits. Collision builds remain0 during editor-only loads and reach5 after five visits. The scene restores exactly. RAF one-cube baseline48.6ms and restored48.7ms are short observations, not statistically established equivalence. Load/mount includes automation, JSON and rendering, not isolated UI CPU cost; mesh/triangle counts describe scene instances, not actual GPU draw calls after culling.

Live buffer/texture observations: one cube20/7;100furniture243/8; after visits319/8; restored cube68/8. Visited preset geometry stays in a bounded shared cache (the48additional buffers) and the shared wood texture remains resident. Instance buffers are released, but this does not prove absence of every leak or quantify driver memory bytes. Enclosed furnishings use a single conservative navigation box, open/slender items part boxes, all cached by scene identity. No per-triangle collision or per-object global keyboard handlers.

Production app entry is751,893bytes/232,883gzip bytes (build11.89s; use raw receipt for exact gzip values). Shared React and Three vendor chunks are69,054/181,579gzip bytes; extra furniture functionality adds bytes rather than proving faster cold load. No dependencies were added. Raw reproducible recipe and observations: scripts/benchmark-furniture131.mjs and benchmarks/2026-10-21-m131-furniture.json. Existing hardware/device limitations below still apply.

## Milestone 13 historical measurements — 20 October 2026

Before/after use the same1440×960 headless Edge/SwiftShader session recipe, a fresh context, one then100 cubes, five walkthrough entry/exits and a restored one-cube scene. These are software-rendered, short observations, not physical GPU/camera tests or controlled FPS claims. Raw receipts: benchmarks/2026-10-20-m13-before.json and benchmarks/2026-10-20-m13-after.json.

| Reading                                  | Before | After |
| ---------------------------------------- | -----: | ----: |
| Window keydown listeners with100 cubes   |    104 |     3 |
| Window blur listeners with100 cubes      |    102 |     1 |
| Restored one-cube live buffer count      |     20 |    20 |
| Restored one-cube live texture count     |      7 |     7 |
| 100-cube sampled RAF median(ms)          |  201.9 | 195.0 |
| Restored one-cube sampled RAF median(ms) |   48.8 |  48.7 |

The listener reduction is deterministic: inactive objects no longer attach drag cancellation handlers, and walking input listeners exist only while walking. All five exits return listener counts to baseline. Collision-cache instrumentation records0builds through editor-only scene loading, exactly5after five visits, and no extra build after restoring in editor. Euler reuse, position-change-only telemetry and optional help subscriptions reduce avoidable allocations/UI updates without changing navigation math.

Temporary100-cube transition samples retain856buffers versus736before transition in both runs; restoring the original scene returns20. These counts include deferred disposal and are observations, not driver memory bytes or proof against every possible leak. The tiny timing differences do not justify a general FPS/speed claim. Large scenes, complex imported meshes, transmission and software rendering can remain slow. No inference threshold, debounce, delegate or provider contract changed.

App entry gzip changed from474529 to220919bytes. React/Three core vendor chunks total250632gzip bytes, so initial entry+vendors is471551bytes versus474529previously. Total initial transfer is only slightly smaller. Existing Vercel asset headers were observed as public,max-age=0,must-revalidate with ETags: requests still revalidate. The main benefit is cache isolation: unchanged vendor hashes survive app-only edits, reducing re-download size on updates, not proving faster cold startup. GLTFLoader, vision and optional worker remain separate lazy chunks. Native model/WASM assets are additional.

Historical observations below retain their original dates and do not supersede current measurements.

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

| Observation                             | Legacy CPU / adaptive RAF | Experimental worker CPU | Final default CPU / fresh frames |
| --------------------------------------- | ------------------------: | ----------------------: | -------------------------------: |
| Render FPS                              |                      16.7 |                    25.4 |                              9.7 |
| Render frame p95 (ms)                   |                     155.9 |                    71.9 |                            205.6 |
| Render frame std deviation (ms)         |                      55.0 |                    19.2 |                             75.2 |
| Camera presentation FPS                 |                       8.9 |                    26.0 |                              4.8 |
| Inference updates/s                     |                       5.5 |                     3.0 |                              9.8 |
| Mean inference (ms)                     |                     124.2 |                   273.2 |                             82.6 |
| Gesture updates/s                       |                       5.5 |                     3.0 |                              9.7 |
| Mean gesture/controller processing (ms) |                      0.15 |                    0.35 |                             0.12 |
| Processing → next render callback (ms)  |                     139.2 |                   316.0 |                             91.7 |
| Result → next render callback (ms)      |                       9.2 |                    31.6 |                              9.4 |

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

| Reading                              |  Before CPU | Final CPU | Final worker CPU | Optional GPU (software) |
| ------------------------------------ | ----------: | --------: | ---------------: | ----------------------: |
| Render FPS                           |         9.5 |       8.6 |             29.4 |                     2.3 |
| Camera presentation FPS              |         4.7 |       3.8 |             27.8 |                     1.1 |
| Inference Hz                         |         9.6 |       8.7 |              4.8 |                     3.4 |
| Mean inference ms                    |        89.1 |      97.4 |            171.7 |                   272.7 |
| Inference p95 ms                     |       113.3 |     272.8 |            234.8 |                   301.4 |
| Gesture Hz                           |         9.4 |       8.7 |              4.8 |                     3.4 |
| Render frame p95 ms                  |       220.4 |     453.3 |             63.9 |                   600.8 |
| Render variation/std ms              |        73.8 |     111.1 |             18.1 |                   145.7 |
| Process → next render callback ms    |        99.1 |      94.9 |            197.3 |                   287.1 |
| Result → next callback ms            |         7.0 |       6.4 |             23.6 |                    10.5 |
| Main-thread tasks >50 ms / 2 s       | unavailable |      11.0 |              1.0 |                     3.0 |
| Measured long-task duration / 2 s ms | unavailable |    1614.0 |             63.0 |                  1471.0 |

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

## Milestone 10.2 — native graphics / delegate evidence — 17 October 2026

The installed MediaPipe Tasks Vision 1.1.0 exposes CPU/GPU Hand Landmarker delegates. Fresh settings now choose Auto; existing explicit preferences remain. Auto consults the **existing scene WebGL context**, creates no probe context, skips known software renderers and attempts GPU on reported WebGL2. This is an initialization policy, not an adaptive speed test. Explicit GPU remains available with CPU fallback. Actual engine is assigned after successful initialization, with CPU fallback reasons; GPU runtime failure closes the GPU detector before creating CPU and cancels an uncommitted gesture. Initialization is serialized across starts; obsolete late instances close. One detector and one in-flight frame remain the rule. Stop before changing delegate. The same local WASM/model URLs are reused; no alternate model download or new package.

Baseline observations before application changes used **native headless Edge 155 without SwiftShader flags**, 1280×720, the same 640×480 synthetic canvas requesting 30 FPS, no hand image, ten seconds settling and one final two-second rolling window. Runs were serial. These are single observations subject to warm-up/system scheduling, **not physical webcam or motion-to-photon benchmarks**.

| Baseline observation                      |             CPU |             GPU |
| ----------------------------------------- | --------------: | --------------: |
| Active engine                             | main-thread CPU | main-thread GPU |
| Render FPS                                |           41.49 |           97.24 |
| Camera presentation FPS                   |           13.43 |           28.01 |
| Inference Hz                              |           13.89 |           24.96 |
| Mean / p95 inference ms                   |   51.34 / 59.70 |   15.13 / 17.80 |
| Gesture Hz                                |           13.73 |           24.96 |
| Processing → render callback ms           |           54.94 |           18.97 |
| Result → render callback ms               |            4.05 |            3.59 |
| Main-thread long tasks / blocked ms (2 s) |       19 / 1193 |         2 / 135 |

Raw baseline JSON: `benchmarks/2026-10-17-10.2-baseline-{cpu,gpu}.json`. The improvement shown here is **GPU versus CPU in this scene**, not a before/after application speed claim. The CPU path already existed in 10.1. No inference pacing/filter thresholds were reduced for these results. Synthetic delivery itself runs on the main thread, so CPU inference can reduce its apparent camera FPS.

Windows read-only adapter enumeration reports AMD Radeon 740M and NVIDIA GeForce RTX 3050 Laptop GPU. Both native Edge baseline runs reported `ANGLE (AMD, AMD Radeon 740M Graphics (0x00001901) Direct3D11 vs_5_0 ps_5_0, D3D11)` for the **Three.js context**. This suggests Edge selected the integrated adapter for that context. It does **not prove a particular physical adapter for every MediaPipe operation**. Successful GPU delegate initialization is separate evidence from a WebGL renderer string. HoloBuild cannot force NVIDIA selection or read the browser's OS graphics preference/acceleration setting reliably. Privacy restrictions may redact the debug renderer extension; absence of a known software string does not certify hardware acceleration. No new WebGPU adapter/device is requested just to guess the GPU.

The embedded Codex browser probe failed to create WebGL; native Edge rendered correctly. Use normal Edge/Chrome for acceptance. HoloBuild reports unavailable graphics rather than pretending GPU support. If desired, the user can enable browser graphics acceleration and choose their browser's High performance GPU in Windows Graphics settings, restart and recheck. The app does not change those settings.

Read-only Ollama `/api/ps` during this audit returned no resident models. Thus these timings do not establish performance during concurrent model generation or GPU memory contention. Web APIs do not expose reliable cross-process VRAM use. Compare the same scene with Ollama idle/active manually; do not equate its GPU use with browser use.

Diagnostics distinguish actual render callbacks, camera presentation metadata, inference/gesture windows, mean/p95 timings, measured long tasks and processing/result-to-render callbacks. Capture→render stays unavailable unless video metadata supplies capture time. Sensor/exposure delay, 45 ms configured landmark smoothing, 85 ms two-hand interpolation, display/compositor delay and physical motion latency are not measured. A high render FPS alone cannot diagnose a 5–7 Hz hand pipeline.

Reproduce serially against the running D: server (no physical webcam access):

```powershell
node scripts/benchmark-camera.mjs --hardware --output camera-cpu.json
node scripts/benchmark-camera.mjs --hardware --gpu --output camera-gpu.json
```

`--hardware` means software-rendering flags are omitted; it does not select or certify a physical GPU. Benchmark metadata records that request separately from the reported renderer and actual initialized engine. Keep camera profile, viewport, scene and background load comparable. Worker CPU remains optional/experimental; no worker speed improvement is claimed. Final observations are below; full validation is recorded in DEVELOPMENT.md. Physical user acceptance remains pending.

### Final native observations

After final application changes, the same script/source/profile/viewport/ten-second settling ran serially with no concurrent test, build or model request. Each number remains one rolling two-second observation, not a statistical benchmark.

| Final observation               |             CPU |             GPU |            Auto |
| ------------------------------- | --------------: | --------------: | --------------: |
| Active engine                   | main-thread CPU | main-thread GPU | main-thread GPU |
| Render FPS                      |           12.82 |           11.80 |           12.30 |
| Camera presentation FPS         |           18.36 |           26.37 |           26.87 |
| Inference Hz                    |           11.39 |           11.92 |           12.45 |
| Mean inference ms               |           54.11 |           21.43 |           22.25 |
| p95 inference ms                |           60.30 |           32.00 |           33.80 |
| Gesture Hz                      |           11.39 |           11.92 |           12.33 |
| Processing → render callback ms |           60.92 |           27.86 |           28.24 |
| Result → render callback ms     |            6.53 |            6.13 |            5.40 |
| Long tasks (last 2 s)           |           20.00 |            3.00 |            3.00 |
| Blocked ms (last 2 s)           |         1261.00 |          226.00 |          173.00 |

Raw files: `benchmarks/2026-10-17-10.2-final-{cpu,gpu,auto}.json`. Both requested GPU and Auto **successfully initialized main-thread GPU**. All three scene contexts again reported the AMD Radeon 740M ANGLE string. GPU lowered measured inference and processing-to-render duration relative to CPU in these samples; it did **not consistently increase update/render throughput**. The earlier 25Hz/97-render-FPS GPU baseline was not reproduced here. No claim of an overall before/after speedup is supported.

A separate native Edge camera-off observation (`...final-idle.json`) measured **12.42 render FPS, 81.10ms render p95, 0.40ms frame variation, zero long tasks and zero inference**, with document visibility `visible`. This establishes that the later ~12Hz rendering limit also occurred without MediaPipe; it is not evidence that inference caused the limit. The exact browser/system pacing cause is unresolved. No OS/browser performance or security settings were changed to force a result. Physical foreground-browser/hand tests are required. Real webcam recognition, exposure latency, RTX-specific delegation, thermal behavior and concurrent Ollama remain unmeasured.

Final production build passed (`tsc -b && vite build`, 15.63s Vite phase): main JS **1,487.21kB / 424.18kB gzip**, CSS **30.50kB / 7.18kB gzip**, optional worker144.79kB, vision144.27kB, lazy GLTFLoader44.80kB. Existing large-chunk and Zod annotation warnings remain. These are build sizes, not memory or throughput measurements.
