# Milestone 10.1 changed files

This manifest covers the preserved milestone implementation and final validation fixes against `a7f0f12`. No dependencies were installed and no scene data or private environment file is committed.

## Application

- `src/App.tsx`
- `src/commands/speech.ts`
- `src/components/camera/WebcamPreview.tsx`
- `src/components/camera/panelLayout.ts`
- `src/components/camera/useFloatingPanel.ts`
- `src/components/ui/AdvancedGestures.tsx`
- `src/components/ui/CompactPerformance.tsx`
- `src/components/ui/GestureCursor.tsx`
- `src/components/ui/GestureDiagnostics.css`
- `src/components/ui/GestureDiagnostics.tsx`
- `src/components/ui/HandGuides.tsx`
- `src/components/ui/InteractionStatus.tsx`
- `src/components/ui/ModelImport.tsx`
- `src/components/ui/ObjectInspector.tsx`
- `src/components/ui/PerformanceReadings.tsx`
- `src/components/ui/PlannerActivity.tsx`
- `src/components/ui/StructureGenerator.tsx`
- `src/components/ui/StructureInspector.tsx`
- `src/components/ui/Toolbar.tsx`
- `src/components/ui/VoiceCommands.tsx`
- `src/components/viewport/BuildingObject.tsx`
- `src/components/viewport/GestureInteraction.tsx`
- `src/components/viewport/ImportedModel.tsx`
- `src/components/viewport/Scene.tsx`
- `src/generation/editPlanner.ts`
- `src/generation/editStore.ts`
- `src/generation/generationStore.ts`
- `src/generation/planner.ts`
- `src/generation/plannerPreferences.ts`
- `src/generation/plannerTransport.ts`
- `src/interaction/advancedStore.ts`
- `src/interaction/autoGestureController.ts`
- `src/interaction/autoIntent.ts`
- `src/interaction/gestureController.ts`
- `src/interaction/placement.ts`
- `src/interaction/twoHandController.ts`
- `src/scene/commandManager.ts`
- `src/styles/index.css`
- `src/vision/cameraSettings.ts`
- `src/vision/handTracker.ts`
- `src/vision/performanceStore.ts`
- `src/workspace/toolsStore.ts`

## Backend

- `server/app.mjs`
- `server/app.test.mjs`
- `server/providerSchema.mjs`
- `server/providerStream.mjs`

## Tests

- `tests/e2e/advanced.spec.ts`
- `tests/e2e/auto-gestures.spec.ts`
- `tests/e2e/commands.spec.ts`
- `tests/e2e/editor.spec.ts`
- `tests/e2e/generation.spec.ts`
- `tests/e2e/materials-models.spec.ts`
- `tests/e2e/minimal-workspace.spec.ts`
- `tests/e2e/reliability-ui.spec.ts`
- `tests/e2e/shapes.spec.ts`
- `tests/e2e/structure-safety.spec.ts`
- `tests/e2e/structures.spec.ts`
- `tests/e2e/workspace.spec.ts`
- `tests/helpers/workspaceTools.ts`
- `tests/unit/autoGestures.test.ts`
- `tests/unit/commands.test.ts`
- `tests/unit/performance.test.ts`
- `tests/unit/placementCache.test.ts`
- `tests/unit/plannerTransport.test.ts`

## Manual measurement scripts

- `scripts/benchmark-camera.mjs`
- `scripts/live-edit-smoke.mjs`
- `scripts/live-generation-smoke.mjs`

## Documentation and saved measurements

- `docs/AI_GENERATION.md`
- `docs/COMMANDS.md`
- `docs/DEVELOPMENT.md`
- `docs/GESTURES.md`
- `docs/MANUAL_TESTS.md`
- `docs/MILESTONE_10_1_CHANGES.md`
- `docs/PERFORMANCE.md`
- `docs/ROADMAP.md`
- `docs/STRUCTURE_EDITING.md`
- `docs/WORKSPACE.md`
- `docs/benchmarks/2026-10-16-10.1-baseline-main.json`
- `docs/benchmarks/2026-10-16-10.1-baseline-worker.json`
- `docs/benchmarks/2026-10-16-10.1-final-main.json`
- `docs/benchmarks/2026-10-16-10.1-final-worker.json`
- `docs/benchmarks/2026-10-16-10.1-gpu.json`
- `docs/benchmarks/2026-10-16-10.1-live-edit.json`
- `docs/benchmarks/2026-10-16-10.1-live-generation.json`
- `docs/benchmarks/2026-10-17-10.1-validation.json`

## Configuration

- `.env.example`

Total: 86 files. Production/browser artifacts remain ignored.
