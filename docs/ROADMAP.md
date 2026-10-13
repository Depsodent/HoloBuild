# Roadmap and honest scope

1. Foundation: 3D mouse editor and validation.
2. Optional webcam: local VIDEO inference, preview, landmarks, lifecycle cleanup.
3. Recognition: normalized pinch, hysteresis, smoothing, temporal stability, hand-loss reset.
4. Interaction implemented: camera raycasting, pinch grab, planar drag, snapped/validated preview, single-command release and loss cancellation. Physical webcam acceptance remains pending.
5. Construction: additional geometry, surface alignment/stacking, stronger collision rules, richer persistence.
6. Two-hand transforms, calibration and gesture menus.
7. Text/voice commands with validated deterministic parsing.
8. Structured scene generation and secure backend LLM integration only when credentials are configured.
9. Physical benchmarks, browser matrix and portfolio polish.
10. GitHub repository and verified frontend deployment after stability gates.

No backend is needed for the initial browser-local MVP. No AI integration, voice support, two-hand manipulation, model imports or deployment is claimed before implementation and testing. A future LLM must produce schema-validated operations, never executable JavaScript.
