# Milestone 12 — verified production handoff

Updated 2026-10-20T08:28:08.015Z. Project: D:\Projects\HoloBuild. Public: https://holobuild.vercel.app. Repository: https://github.com/Depsodent/HoloBuild.

## Released state

Deployed source: 40cd7a650d8e40e5b9b53baf9f4156aca041a982. Deployment: dpl_4498oLZWjGa9tHyXbTsYY1C1njzs, READY. All served JavaScript hashes match the audited production bundle. The final documentation checkpoint records receipts only and needs no runtime redeploy. Previous M12 dpl_BSCM9hc1dQx9GzpXLA4zQHGoApyo and M11 dpl_ENkGDZHgqYubXaakkSfWWFZCJTWp remain READY for rollback. No credentials, protected variables, quotas, billing or infrastructure changed.

## Completed

Standalone stairs and connected floors remain distinct and strictly validated. Native tread geometry, all quarter orientations, parametric editing, appearance inheritance and exact history work. Selected manual/generated walls create real segmented window openings through the shared typed/final-speech preview pipeline, with stable target/scope checks and specific unsupported explanations. Inspector names stay compact.

Walkthrough reuses the existing camera: keyboard/arrows, deliberate pointer lock, touch controls, pause/reset/exit, eye height/speed, real door/tread/slab/void/balcony collision and camera restoration. Presentation hides panels without unmounting capture, restores layout, supports orbit/walking, named browser-local views and optional fullscreen. Shared command/history guards keep exploration read-only and preserve pending AI previews.

Speech Stop requests finalization; Cancel preserves finalized text. Permission/support/errors are honest. A reproduced delayed-permission race was fixed with cancellation generations across cancel/submit/panel hide/page hide/cleanup/exploration. Late results cannot start hidden capture, including after mode exit. Restart and Stop/final-event retention pass production-bundle tests with synthetic recognition. Physical acceptance remains pending.

## Validation

- 392 unit tests in 39 files pass after the final patch.
- 66 backend tests pass; backend unchanged after the gate.
- Referenced TypeScript, ESLint and production build pass (14.58s local, 13.61s remote frontend); 70 package notices, zero unresolved. Existing annotation/large-chunk warnings remain.
- 149 distinct browser cases have passing evidence. The broad 148-case run had 147 pass and one mocked speech startup race; all 13 affected rerun cases pass. Final 17 command/exploration cases pass including the new delayed-permission regression. This is not one uninterrupted 149/149 execution.
- Real Gemini local and public two-floor construction/edit checks pass with 44 parts, 16 steps, a real floor void and eight balcony parts/aligned access. Actual rendered door/stair/balcony navigation, pointer lock, restore, selected wall openings, 270-degree standalone stairs, materials/precision, preview/cancel/confirm, save/load and exact Undo/Redo pass with zero page errors. Public creation 1.829s, edit 1.574s. Final microphone-only patch reuses unchanged provider/geometry/navigation evidence and adds final-source browser/production lifecycle smoke; no duplicate provider calls.
- Final source/alias/private-upload/Hobby/environment metadata, HTTPS/headers, CORS, private paths, known-secret/bundle hashes, WASM and notices pass. Actual production log windows show no 5xx/unexpected runtime errors. Redis active leases = 0. See MILESTONE_12_RELEASE_VALIDATION.json and MILESTONE_12_PRODUCTION_VALIDATION.json.

## User acceptance remaining

1. Build an empty-scene Standalone Stairs flight; resize/recolor it, confirm and Undo/Redo. Test Connect Floors on a compatible house.
2. In Part mode select a manual/generated wall; type Add a window to the selected wall. Check inert preview, Cancel, Confirm and exact Undo/Redo. Repeat through a real final microphone transcript on both laptops; report browser/version, displayed support/permission/status/error and whether final text survives Stop. Do not send secrets or raw microphone recordings.
3. Generate/confirm a two-floor house with stairs and balcony. Walk through the entry, climb stairs, reach balcony, Escape/pause/reset and return to editor. Check camera restoration and solid wall/window/rail collision.
4. Enter Presentation, switch overview/walking, save/recall a view and exit. Confirm layout restoration. While real webcam tracking is active, enter presentation and check capture continues and Stop camera remains reachable.
5. Recheck pointing/pinch/move/release/Undo and two-hand transforms in editor. Test touch controls on an actual supported device if available.

## Limits and safe resume

Imported, curved and pitched/rolled geometry has conservative solid bounds; mesh cavities are unsupported. Native static doors act as open portals while walking, not animated hinges. Standalone flights create no inferred destination slab/landing. Saved viewpoints are browser-local, outside scene JSON/history. Native speech/pointer-lock/fullscreen availability depends on browser services/permissions. Headless software rendering does not certify laptop performance; geometry is not building-code or structural certification. Invalid model output remains rejected.

Local frontend http://127.0.0.1:5175 and production-compatible Gemini validation frontend/backend http://127.0.0.1:5182 both returned200 at final verification. Existing planner5180 was preserved. For a future related patch use existing commands: npm run lint; npx tsc -b; npm test; npm run test:server; npm run build; PLAYWRIGHT_BASE_URL=http://127.0.0.1:5175 npx playwright test tests/e2e/commands.spec.ts tests/e2e/exploration.spec.ts. scripts/smoke-exploration-permissions.mjs runs against HOLO_RELEASE_URL with HOLO_SOURCE_SHA, without real microphone/provider calls. Full Gemini smoke requires explicit HOLO_LIVE_GEMINI=1 and follows existing free-tier limits. Never print ignored env/auth values.

Stop here for physical acceptance. Do not start Milestone 13. Standing routine release authorization remains; paid services, spending/quotas, production deletion or major infrastructure changes still require user approval.
