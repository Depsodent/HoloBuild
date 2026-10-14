# Roadmap and honest scope

1. Foundation: 3D mouse editor and validation.
2. Optional webcam: local VIDEO inference, preview, landmarks, lifecycle cleanup.
3. Recognition: normalized pinch, hysteresis, smoothing, temporal stability, hand-loss reset.
4. Interaction implemented: camera raycasting, pinch grab, planar drag, snapped/validated preview, single-command release and loss cancellation. Physical webcam acceptance confirmed by the user on 2026-10-14.
5. Construction implemented: six primitives, shared transforms/appearance/history, shape-aware conservative collision, ground alignment, free-space spawning, and mixed-shape version-1 persistence. Additional-shape physical acceptance pending; automatic stacking remains future work.
6. Two-hand transforms and further calibration — NOT STARTED; blocked on user acceptance of Milestone 5.
7. Text/voice commands with validated deterministic parsing.
8. Structured scene generation and secure backend LLM integration only when credentials are configured.
9. Physical benchmarks, browser matrix and portfolio polish.
10. GitHub repository and verified frontend deployment after stability gates.

No backend is needed for the initial browser-local MVP. No AI integration, voice support, two-hand manipulation, model imports or deployment is claimed before implementation and testing. A future LLM must produce schema-validated operations, never executable JavaScript.
