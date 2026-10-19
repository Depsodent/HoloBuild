# Milestone 10.5 — local Ollama streamed creation resume

Local work based on 6c8ad09. Architectural primitives, the shared command system and existing input paths are preserved. No publication or deployment is authorized by this checkpoint.

## Confirmed cause and correction

The baseline failure was reproduced independently of Playwright/CDP. Compatible SSE transport returned HTTP 200 with an error event carrying status 422 and kind response-schema. The provider ended normally (finish_reason=stop); independent delta assembly exactly matched collectCompletion. The 698-character response failed the runtime assistant kind union. This run was not truncated and no stream content was lost. The old decoder constrained only an outer response string, leaving the encoded inner plan unconstrained.

Trying the entire conversational union as a decoder schema timed out at the unchanged 120-second budget. A bounded create/clarify decoder returned syntactically valid but repeatedly redundant placement questions, even after answers. An isolated native JSON-object comparison produced a strict-valid creation recipe (1,622 prompt tokens + 353 completion tokens = 1,975 total; normal stop; exact assembly). It included two floors, one staircase, one balcony and two real door openings. The model context remains 4,096; no model download, context enlargement or provider timeout increase was used.

Explicit local Ollama template-creation requests now use native JSON-object output with the compact creation contract and an illustrative recipe. The example is prompt data, never an application fallback. The full runtime assistant schema still parses every response; native creation accepts only create or clarify, never a finish acknowledgement. Existing geometry, placement, canonical recipe matching, scene budgets and feature-preservation checks remain mandatory. General assistant editing, Gemini transport, security and hosted quotas are unchanged.

Compatible stream collection retains validated numeric usage and finish metadata. A length finish rejects even parseable partial data as provider-truncated; other non-stop finishes reject as provider-incomplete. Incomplete events, byte/content limits, cancellation, Gemini safeguards and tool rejection remain intact.

## Clarification continuity

An independent frontend bug sent a placement reply through the selected starter cube's Part-role guard. An explicit pending creation request now keeps placement replies on conversational planning. Its bounded original text is separate from the last six short conversation messages. Cancel, reset and successful creation clear it; invalid geometry keeps it available for retry. The backend uses this explicit pending state rather than inferring a new building from stale conversation history. Selected existing structures retain their established edit path.

## Live and rendered evidence

The exact request, generate a 2 story house including a balcony and stairs, passed the live streamed browser path using configured local qwen3:4b-instruct. Request ce40a98c-75be-4e77-b223-73d93edbf082 returned create in 70.404 seconds (first content 0.995 seconds). The application validated an inert preview, then confirmed 44 parts: 16 stair steps, four upper-floor slab tiles surrounding a real opening, eight balcony slab/rail/post parts and aligned upper-floor access. Exact Undo restored the original scene including its unrelated cube; Redo restored identical objects and metadata. No page errors were reported.

The sanitized actual plan is tests/fixtures/ollama-architecture.json. Its recorded-response regression checks rendered mesh count, real architectural parts, exact history and a cutaway of this accepted geometry. The cutaway was visually inspected. This recorded test is distinct from the successful live browser call; neither is physical webcam acceptance.

Final gate counts, build and browser receipts are recorded in MILESTONE_105_STREAM_VALIDATION.json and the current section of MILESTONE_105_HANDOFF.md.

## Reproduce safely

Run commands individually from D:\Projects\HoloBuild. Keep browser and model runs serial to avoid GPU/CPU contention.

```powershell
npm.cmd run dev:local
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test -- --maxWorkers=1
npm.cmd run test:server
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5175'
npx.cmd playwright test
npm.cmd run build
node scripts/audit-publication.mjs --write
node --env-file-if-exists=.env scripts/check-local-stream.mjs
```

The last command is opt-in and makes one actual local Ollama request through an isolated loopback planner. It refuses Gemini/hosted profiles and prints only finish category, numeric usage, assembly equality, schema issue paths, safe IDs and timings. An error event makes the command fail. It validates the response schema, not rendered geometry. Use the application for preview/confirm/history checks. Existing ignored live browser harness: npx.cmd playwright test --config .cache/live-architecture.config.ts; this consumes a cloned Fetch response in-page instead of CDP response.text().

Frontend: http://127.0.0.1:5175/ . Backend: http://127.0.0.1:5180/api/planner/status . Do not print ignored environment files, raw provider content, private claim links or credentials.

## Remaining limits

One successful live architectural browser run is evidence for this request, not a reliability guarantee for every local-model output. The small model can still return invalid data, redundant clarification or timeout, especially under render/inference contention. Such output must be rejected without geometry repair or scene mutation. Review proposed defaults/placement before confirmation. Live arbitrary follow-up model edits and fresh Gemini verification were not repeated in this resume. Hosted production remains the previously approved source; no push/deploy, quota change or paid service occurred. Physical webcam, microphone and friend-device acceptance remain unverified. Straight quarter-turn stairs, fixed door panels and visual balcony guards retain their documented engineering/animation limitations.

Final-source metadata-only diagnostic also passed: normal stop, exact assembly, 1,507 prompt + 299 completion = 1,806 tokens; native creation with two floors, one staircase and one balcony; 31.862 seconds total after a cold model (first content at 9.010 seconds). Request b2b2d79a-c0f8-4d22-ab45-563c51e7575b. This is a second real backend response/schema check, not a second rendered-browser or physical-webcam test.
