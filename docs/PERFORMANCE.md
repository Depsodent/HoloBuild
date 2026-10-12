# Performance record

## Measurements versus targets

The footer samples rendered FPS over one-second windows. Draw calls are sampled from Three.js renderer statistics. Values depend on hardware, browser visibility, scene size and GPU; no hardware benchmark is claimed at the foundation checkpoint.

Target: approximately 30 FPS or more during gesture control on the user's laptop. This is a target, not a verified result. DPR is capped at 1.75; shadow maps are 1024 square; history is bounded at 80 snapshots and scenes at 200 objects.

Synthetic browser tests may run under software WebGL and are correctness checks, not performance benchmarks. Use the physical laptop, camera and representative scenes to collect real metrics. Worker inference and instanced rendering should follow measured bottlenecks, not precede them.
