# Roadmap and honest scope

1. Foundation: 3D mouse editor and validation.
2. Optional webcam: local VIDEO inference, preview, landmarks, lifecycle cleanup.
3. Recognition: normalized pinch, hysteresis, smoothing, temporal stability, hand-loss reset.
4. Interaction implemented: camera raycasting, pinch grab, planar drag, snapped/validated preview, single-command release and loss cancellation. Physical webcam acceptance confirmed by the user on 2026-10-14.
5. Construction implemented: six primitives, shared transforms/appearance/history, shape-aware conservative collision, ground alignment, free-space spawning, and mixed-shape version-1 persistence. Additional-shape physical acceptance pending; automatic stacking remains future work.
6. Advanced gestures and adaptive workspace (6.1) complete and accepted by the user with their real webcam: two-hand scale/yaw, opt-in menu and camera pan, docked split panels, resizable/collapsible sidebars and floating diagnostics.
7. Advanced materials, procedural textures, adjustable lighting, static GLB/GLTF import, shared manipulation and portable browser-local asset persistence: accepted by the user. Refinement 7.1 adds independent two-hand readiness/selection, separate pipeline measurements, fresh-frame scheduling, optional worker execution and persistent collapsible groups. The user physically accepted 7.1, including camera smoothness; details in DEVELOPMENT.md.
8. Deterministic shared text/voice construction commands implemented with explicit microphone activation, final-result deduplication, inline destructive confirmation and existing scene/history/save flow. Physical microphone acceptance pending. No LLM or structure generation included.
9. Future work requires explicit approval after Milestone 8 acceptance. No implementation started; physical benchmarks/browser matrix/portfolio polish remain future scope.
10. GitHub repository and verified frontend deployment after stability gates.

No backend is required for the current browser-local editor and portable asset exports. Browser speech may use its provider's remote recognition service; text uses the local deterministic interpreter. No LLM integration or deployment is claimed. A future LLM must produce schema-validated operations, never executable JavaScript.
