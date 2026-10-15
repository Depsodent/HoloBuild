# Roadmap and honest scope

1. Foundation: 3D mouse editor and validation.
2. Optional webcam: local VIDEO inference, preview, landmarks, lifecycle cleanup.
3. Recognition: normalized pinch, hysteresis, smoothing, temporal stability, hand-loss reset.
4. Interaction implemented: camera raycasting, pinch grab, planar drag, snapped/validated preview, single-command release and loss cancellation. Physical webcam acceptance confirmed by the user on 2026-10-14.
5. Construction implemented: six primitives, shared transforms/appearance/history, shape-aware conservative collision, ground alignment, free-space spawning, and mixed-shape version-1 persistence. Additional-shape physical acceptance pending; automatic stacking remains future work.
6. Advanced gestures and adaptive workspace (6.1) complete and accepted by the user with their real webcam: two-hand scale/yaw, opt-in menu and camera pan, docked split panels, resizable/collapsible sidebars and floating diagnostics.
7. Advanced materials, procedural textures, adjustable lighting, static GLB/GLTF import, shared manipulation and portable browser-local asset persistence. Automated verification and user acceptance tracked in DEVELOPMENT.md. Physical Milestone 7 acceptance is pending.
8. Future text/voice or LLM work requires the user's explicit approval after Milestone 7. No implementation started.
9. Physical benchmarks, browser matrix and portfolio polish.
10. GitHub repository and verified frontend deployment after stability gates.

No backend is required for the current browser-local editor and portable asset exports. No voice/LLM integration or deployment is claimed. A future LLM must produce schema-validated operations, never executable JavaScript.
