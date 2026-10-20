# Milestone 12 work in progress

Updated 2026-10-20T06:45:22.435Z. Base 61c3aba, production remains Milestone11 d49952e. No M12 push/deployment yet. Preserve all local work.

Phase1 implemented: standalone native stairs versus connected floors; canonical shared steps/facade geometry, support and recipe certification; selected-wall creation targets a wall before existing-window type guards; native manual walls have genuine segmented openings; existing window editing and shared atomic previews/history retained. Compact Inspector heading truncates with full-name title. Speech Stop finalizes while Cancel aborts, finalized text survives, permission/security prechecks and actionable failures remain honest.

Evidence:64 focused unit tests across M12 fixes/commands/architecture pass;10 navigation solver tests pass; all5 distinct phase-one library/UI tests pass (one reselected-after-Undo test harness fix). Production build23.25s passes;70 notices/0 unresolved, existing annotation/chunk warnings. Phase-one ESLint passed. Physical microphone/webcam/friend-device acceptance is pending.

New pure navigation solver caches actual scene boxes; native doors are portals, windows solid; body radius .22m, step height .28m, swept movement, gravity, real tread/slab support, conservative bounds for imported/curved/tilted geometry. It is not yet wired to the camera. Unit tests cover walls, entry slab, doors, stair void/upper-floor landing, balcony access/rails, ceiling and immutable inputs.

Next: integrate view-only exploration store/camera/controls; block scene mutations and gestures while exploring without stopping camera tracking; restore camera/layout, named views and presentation; add browser integration/E2E coverage, full relevant regressions and security/live Gemini checks; commit/push/stage/deploy/verify under standing authorization with previous deployment preserved. Do not start Milestone13, paid services, quotas or credential changes.
