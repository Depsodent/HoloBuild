# Milestone 10.2 changed files

Base checkpoint: `e460e25`. This manifest covers the complete checkpoint; generated build output, browser reports, dependencies and local environment files remain ignored.

Custom color preview is transient; Apply/Reset use the existing shared command history. Navigation preserves the mounted camera controller. GPU fallback reuses the same local model and input/scene pipeline. No gesture thresholds were changed. See DEVELOPMENT.md for validation and PERFORMANCE.md for measured evidence and limitations.

## Documentation

- [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- [docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md)
- [docs/GESTURES.md](../docs/GESTURES.md)
- [docs/MANUAL_TESTS.md](../docs/MANUAL_TESTS.md)
- [docs/MILESTONE_10_2_CHANGES.md](../docs/MILESTONE_10_2_CHANGES.md)
- [docs/PERFORMANCE.md](../docs/PERFORMANCE.md)
- [docs/ROADMAP.md](../docs/ROADMAP.md)
- [docs/WORKSPACE.md](../docs/WORKSPACE.md)

## Measured evidence and validation receipts

- [docs/benchmarks/2026-10-17-10.2-baseline-cpu.json](../docs/benchmarks/2026-10-17-10.2-baseline-cpu.json)
- [docs/benchmarks/2026-10-17-10.2-baseline-gpu.json](../docs/benchmarks/2026-10-17-10.2-baseline-gpu.json)
- [docs/benchmarks/2026-10-17-10.2-final-auto.json](../docs/benchmarks/2026-10-17-10.2-final-auto.json)
- [docs/benchmarks/2026-10-17-10.2-final-cpu.json](../docs/benchmarks/2026-10-17-10.2-final-cpu.json)
- [docs/benchmarks/2026-10-17-10.2-final-gpu.json](../docs/benchmarks/2026-10-17-10.2-final-gpu.json)
- [docs/benchmarks/2026-10-17-10.2-final-idle.json](../docs/benchmarks/2026-10-17-10.2-final-idle.json)
- [docs/benchmarks/2026-10-17-10.2-validation.json](../docs/benchmarks/2026-10-17-10.2-validation.json)

## Shared scene commands, color state and benchmark tooling

- [scripts/benchmark-camera.mjs](../scripts/benchmark-camera.mjs)
- [shared/editSchema.d.mts](../shared/editSchema.d.mts)
- [shared/editSchema.mjs](../shared/editSchema.mjs)
- [src/scene/colorPreview.ts](../src/scene/colorPreview.ts)
- [src/scene/colors.ts](../src/scene/colors.ts)
- [src/scene/objectTypes.ts](../src/scene/objectTypes.ts)
- [src/scene/structures.ts](../src/scene/structures.ts)

## Camera, inspector, collection and material rendering

- [src/components/camera/WebcamPreview.tsx](../src/components/camera/WebcamPreview.tsx)
- [src/components/ui/ColorEditor.tsx](../src/components/ui/ColorEditor.tsx)
- [src/components/ui/ModelImport.tsx](../src/components/ui/ModelImport.tsx)
- [src/components/ui/ObjectInspector.tsx](../src/components/ui/ObjectInspector.tsx)
- [src/components/ui/PerformanceReadings.tsx](../src/components/ui/PerformanceReadings.tsx)
- [src/components/ui/SceneCollection.tsx](../src/components/ui/SceneCollection.tsx)
- [src/components/ui/StructureGenerator.tsx](../src/components/ui/StructureGenerator.tsx)
- [src/components/ui/StructureInspector.tsx](../src/components/ui/StructureInspector.tsx)
- [src/components/viewport/ImportedModel.tsx](../src/components/viewport/ImportedModel.tsx)
- [src/components/viewport/Scene.tsx](../src/components/viewport/Scene.tsx)
- [src/components/viewport/SurfaceMaterial.tsx](../src/components/viewport/SurfaceMaterial.tsx)

## Workspace navigation and compact styles

- [src/styles/index.css](../src/styles/index.css)
- [src/workspace/WorkspaceLayout.tsx](../src/workspace/WorkspaceLayout.tsx)
- [src/workspace/leftStore.ts](../src/workspace/leftStore.ts)
- [src/workspace/workspace.css](../src/workspace/workspace.css)

## Tracking delegation and graphics diagnostics

- [src/vision/cameraSettings.ts](../src/vision/cameraSettings.ts)
- [src/vision/delegateDetector.ts](../src/vision/delegateDetector.ts)
- [src/vision/graphicsInfo.ts](../src/vision/graphicsInfo.ts)
- [src/vision/handTracker.ts](../src/vision/handTracker.ts)

## Regression tests and navigation fixtures

- [tests/e2e/advanced.spec.ts](../tests/e2e/advanced.spec.ts)
- [tests/e2e/camera.spec.ts](../tests/e2e/camera.spec.ts)
- [tests/e2e/colors.spec.ts](../tests/e2e/colors.spec.ts)
- [tests/e2e/construction.spec.ts](../tests/e2e/construction.spec.ts)
- [tests/e2e/editor.spec.ts](../tests/e2e/editor.spec.ts)
- [tests/e2e/left-navigation.spec.ts](../tests/e2e/left-navigation.spec.ts)
- [tests/e2e/materials-models.spec.ts](../tests/e2e/materials-models.spec.ts)
- [tests/e2e/minimal-workspace.spec.ts](../tests/e2e/minimal-workspace.spec.ts)
- [tests/e2e/refinements.spec.ts](../tests/e2e/refinements.spec.ts)
- [tests/e2e/reliability-ui.spec.ts](../tests/e2e/reliability-ui.spec.ts)
- [tests/e2e/shapes.spec.ts](../tests/e2e/shapes.spec.ts)
- [tests/e2e/structure-safety.spec.ts](../tests/e2e/structure-safety.spec.ts)
- [tests/e2e/structures.spec.ts](../tests/e2e/structures.spec.ts)
- [tests/e2e/workspace.spec.ts](../tests/e2e/workspace.spec.ts)
- [tests/helpers/editorTest.ts](../tests/helpers/editorTest.ts)
- [tests/helpers/workspaceTools.ts](../tests/helpers/workspaceTools.ts)
- [tests/unit/colors.test.ts](../tests/unit/colors.test.ts)
- [tests/unit/delegate.test.ts](../tests/unit/delegate.test.ts)

The validation receipt records the successful complete 111-case final browser run. Physical webcam/NVIDIA acceptance remains pending. No push, deployment or Milestone 11.
