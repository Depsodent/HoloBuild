# GitHub and public deployment preparation

Status: published after explicit owner approval. Public repository: https://github.com/Depsodent/HoloBuild. Production: https://holobuild.vercel.app. Public AI is enabled after successful staged security/quota checks, claimed Free Upstash and owner confirmation that Gemini billing is disabled. Milestone 11 remains out of scope. Earlier preparation and local validation below are retained as historical context; the final hosted release record takes precedence.

## Repository

- Account: **Depsodent** (authenticated account checked).
- Proposed repository: **HoloBuild**, **public**, `https://github.com/Depsodent/HoloBuild`.
- Existing local history is preserved. No reset, history rewrite, push or remote resource creation is part of preparation.
- Excluded: `.env*` except placeholder `.env.example`, credential/key files, node_modules, dist, local caches/reports, `.vercel`, model weights, generated MediaPipe assets and personal imported GLB/GLTF/BIN bundles.
- Secret audit scans current non-ignored files, every reachable historical blob, and production output; it also checks for exact locally configured secrets without printing values. `docs/PUBLICATION_AUDIT.json` records findings and reviewed fake fixtures. Pattern scanning is not a guarantee of complete detection.
- Production dependency advisory check: zero reported vulnerabilities on 2026-10-17. Author credits, commit author metadata and historical local-path development notes remain visible in a public repository; no private configuration was intentionally included.
- Original code remains UNLICENSED. Third-party license inventory and recovered upstream notices are generated during build. The stats-gl notice gap is resolved for distribution: no implementation bytes are shipped, and a Vite build guard fails if that changes. See `THIRD_PARTY_NOTICES.md` and the generated distribution.json evidence.

## Hosting choice

Use **one Vercel project**: Vite static output plus Node function `api/planner/[action].mjs`, sharing `server/app.mjs` with the local planner. Frontend requests remain same-origin `/api/planner/status`, `/connection`, `/plan`, `/edit`; no public localhost dependency. Native Gemini REST supports SSE streaming without an SDK/server daemon or local GPU. The 130-second function duration accommodates a backend budget up to 120 seconds plus cleanup; start Gemini at 30 seconds.

Build: `npm run setup:vision && npm run build`. MediaPipe runtime/model are downloaded from official sources and hash-verified, then deployed with static output. Build includes full dependency notices. Node function does not call `listen()`. Both raw Node request streams and Vercel parsed JSON bodies retain the 8 KiB limit. Confirm Node 24 and Fluid Compute/duration settings in the actual hosting account before deployment. Current [Vercel Node runtime](https://vercel.com/docs/functions/runtimes/node-js) and [function limits](https://vercel.com/docs/functions/limitations) informed this choice; account/project settings remain unverified.

Exact production HTTPS origin must be set before activating AI. Camera/microphone are limited to self by Permissions-Policy; browser permission still requires explicit user action. HTTPS, real streaming behavior, function bundling, asset MIME types and permissions require post-deployment testing. Local Vite preview is not proof of hosted behavior. Vercel was discovered as an available, uninstalled plugin; CLI is not installed. Hosting login/project access will be needed after approval.

## Secure host environment

Enter secrets directly in Vercel's encrypted environment settings, never chat, Git, build arguments or VITE_ variables. Use separate production credentials; do not expose secrets to previews/untrusted branches.

| Variable                   | Production setting                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `PLANNER_MODE`             | `hosted` (also enforced when VERCEL is set)                                                             |
| `LLM_PROVIDER`             | `gemini`                                                                                                |
| `GEMINI_API_KEY`           | Secret; restrict to Generative Language API in Google settings                                          |
| `GEMINI_MODEL`             | `gemini-3.5-flash-lite`, verified against configured account and both production UI paths on 2026-10-17 |
| `LLM_TIMEOUT_MS`           | `30000` initially; maximum 120000                                                                       |
| `APP_ORIGINS`              | Exact final HTTPS origin, no wildcard/path; explicit comma-separated origins only if needed             |
| `PUBLIC_AI_ENABLED`        | `false` until quotas/origin/secrets verified, then `true`                                               |
| `PUBLIC_AI_DAILY_LIMIT`    | `100` generation attempts/day initially (valid 1–1000)                                                  |
| `UPSTASH_REDIS_REST_URL`   | Private HTTPS *.upstash.io endpoint                                                                     |
| `UPSTASH_REDIS_REST_TOKEN` | Secret with required EVAL/ZREM access                                                                   |

Do not set local Ollama URLs/models as a public fallback. Hosted mode rejects compatible providers. Auto may explicitly fall back to browser Offline templates; LLM mode fails visibly without changing the scene.

## Gemini choice and observed behavior

Official native `generateContent`/`streamGenerateContent` requests use `x-goog-api-key` in a server header and JSON schema guidance. The model ID is exact, server-allowlisted and metadata-verified; no moving alias is used. Account discovery listed 34 generation-capable IDs (GEMINI_MODELS.json), including unsuitable image/audio and retired preview variants; listing alone is not a suitability test.

**Final recommendation: `gemini-3.5-flash-lite`.** The configured account verified it, and real production UI construction and material editing passed in **2.81s / 3.31s** to preview. It is a current stable model with structured output support and no announced shutdown in the checked schedule: [model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [schedule](https://ai.google.dev/gemini-api/docs/deprecations). Quality on arbitrary complex geometry is not established by these small smokes; invalid results remain rejected.

Initial `gemini-3.8-flash` construction passed at 6.7s backend-only and 26.2s production UI, but real edits exceeded the unchanged 30s cap both with its default thinking and supported low thinking. Native Gemini3+ requests now omit deprecated sampling parameters; explicitly selecting 3.8 also uses supported low thinking, covered by backend regression. A 3.1 Flash-Lite edit succeeded, but its announced retirement/replacement favored evaluating the current 3.5 version. The final model was changed deliberately in ignored server configuration and retested on both UI paths; there is no automatic provider/model fallback. Timeout/validation failures never modified the scene. See [current native request guidance](https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.8).

The live test exposed a real provider constraint: large array `maxItems` values triggered generic INVALID_ARGUMENT. Decoder guidance omits maxima above 16 while retaining exact short tuples; the original strict schemas still enforce all part/contact counts, bounds, enums and unknown-field rejection. No geometry is repaired. Backend JSON validity is followed by client geometry/materialization checks and review before commit.

GEMINI_LIVE_VALIDATION.json retains the initial 3.8 backend-only measurement as historical evidence. **PRODUCTION_VALIDATION.json and GEMINI_EDIT_VALIDATION.json are the final configured-model receipts**: construction and edit previews are inert, confirmation is atomic, exact Undo/Redo works and other objects are preserved. Production Save/Load passed. An injected backend outage separately verified explicitly labeled Offline fallback and safe cancellation; it was not a claimed real Gemini outage. No key, raw provider body or private thought text is exposed in browser errors. Remote latency/quality can vary and the 30s budget still applies.

## Abuse and spend limits

Public AI is anonymous, not authenticated. CORS/origin/host checks prevent unintended browser use but do not authenticate non-browser clients. Mitigations therefore include strict schemas, fixed endpoints, server-only system prompts/model allowlist, no arbitrary URLs/tools, 120 parts, 1,200-character prompts, 8 KiB requests, bounded responses and cancellation/timeouts.

Upstash executes one atomic Lua reservation across function instances: **5 requests/IP/minute**, **100 generation attempts/UTC day globally**, **2 active global generation leases**. Failed attempts still count; metadata checks count toward IP limits, not daily generation. IPs are HMAC-hashed, never stored raw; only Vercel's overwritten IP header is trusted. Missing headers share one conservative bucket. Leases expire and are released after completion; failed release is bounded by expiration. Missing/unreachable quota store fails closed. Local process limits also remain. Disable public AI immediately with PUBLIC_AI_ENABLED=false if abused. Real Upstash concurrency/expiry and Vercel header behavior remain to be verified after authorized setup.

These are request limits, not a guaranteed dollar cap: token usage varies, provider billing can include thinking, and cancellation may not refund work already performed. Configure provider quotas, host usage limits and billing alerts before enabling paid usage. Do not promise free production: account tier, region, daily provider quotas and Vercel/Redis usage determine costs. As of 2026-10-17, Google's [pricing](https://ai.google.dev/gemini-api/docs/pricing) lists Gemini 3.5 Flash-Lite paid text rates of $0.30/1M input and $2.50/1M output tokens (including thinking). Google free-tier availability/limits are account-specific; [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) and data-use terms must be reviewed. Free-tier content may be used to improve Google products; do not submit private prompts without reviewing terms. Webcam frames/imported assets are not sent by the planner; prompts and compact selected-structure metadata are sent to Gemini.

## Approval and launch sequence

1. Finish local checks, production smoke, redacted history/bundle audit and stable local checkpoint. Present results, exclusions, licensing/privacy caveats, model, costs and this plan.
2. Obtain explicit approval to create public Depsodent/HoloBuild and push the validated local history. No force push or history rewriting.
3. After deployment approval, authenticate/connect the chosen hosting account; create one project and quota store, enter secrets directly, verify exact origin and account limits. Prevent automatic deployment before approval.
4. Deploy with public AI disabled; verify build/static assets, runtime endpoints and headers. Enable AI only after distributed limits and provider connection succeed.
5. Verify real Gemini preview → confirm → Undo, editing, cancellation, rate rejection and explicit Offline fallback over HTTPS. Check imported-asset Save/Load and restore, and no credential leakage in network/bundle/logs.
6. Ask the owner to physically test camera/microphone, Part/Structure pointing/grabbing and two-hand transforms. Record failures; do not infer acceptance from synthetic tests.

If any launch gate fails, keep AI disabled and report it; local editing/Offline generation remain usable. No public URL exists until deployment is approved and succeeds.


## Approved public release — 2026-10-18 (India)

- Public GitHub: https://github.com/Depsodent/HoloBuild, master; approved baseline 38f2bb1 preserved with additive commits, no history rewrite. License distribution gate excludes unused stats-gl implementation and fails future builds if it enters the bundle; authentic missing notices were not fabricated.
- Production: https://holobuild.vercel.app. Final deployment dpl_HUcY2aq2fB7bAYVRV49rq4YwjN3r is READY, Node24, Vercel Hobby. Frontend and planner share the same HTTPS origin. No GitHub automatic deployment integration was installed; future releases use an explicitly authenticated deployment.
- Initially deployed with AI disabled: anonymous frontend, HTTPS redirect, camera/microphone self permissions, asset MIME types, private-path404, CORS403 and disabled-generation503 passed. Public JavaScript hashes matched the validated local build; exact known private credentials were absent. The final deployment contains no private environment/cache/Git/auth files; .env.example is intentionally a placeholder. All10 environment settings are sensitive and production-only.
- Free Upstash was claimed by the owner; post-claim PING passed. The owner confirmed Gemini free tier with billing disabled. No paid service was activated. AI was enabled only after those confirmations and staged checks. Native exact model: gemini-3.5-flash-lite; timeout30s.
- Real public quota test: five connection metadata requests200; sixth generation request429 before provider invocation. Actual Redis atomic tests also verified daily cap and two concurrent generation leases across independent guard instances. Production limits:5 requests/IP/minute,100 generation attempts/UTCday,2 global generations. Failures count, leases release/expire, missing store fails closed. After public generation/edit, active leases=0. These are application safeguards, not provider/account billing guarantees.
- Real public Gemini browser construction:2.644s to preview, first streamed content1.10s; two validated parts, inert preview, confirm, exact single-action Undo/Redo, portable Save/Load. Injected outage produced explicit Offline fallback and safe cancellation. Real wall-material edit:1.797s, four walls changed, other objects preserved, inert preview and exact Undo/Redo. Zero page errors in both. Public Offline/mouse smoke also passed six shapes, Inspector, Collection Part/Structure, history and persistence.
- Invalid public content type415, unknown fields422, oversized request502 (safely rejected with generic error; status specificity could improve). No validator or application timeout was relaxed. No provider request was needed for these rejection checks.
- Retained verified baseline:249 unit tests,32 backend tests,114 serial Playwright cases; TypeScript and local/remote production builds passed. Full ESLint reran successfully for added hosted smoke scripts. Frontend/client behavior did not change during publication; no unnecessary duplicate full browser suite or expensive model benchmarks were run.
- Receipts: HOSTED_RELEASE_VALIDATION.json, HOSTED_SECURITY_VALIDATION.json (initial AI-disabled stage), HOSTED_CONFIGURATION_VALIDATION.json, HOSTED_UI_VALIDATION.json, HOSTED_QUOTA_VALIDATION.json, HOSTED_REQUEST_VALIDATION.json, HOSTED_GEMINI_GENERATION_VALIDATION.json, HOSTED_GEMINI_EDIT_VALIDATION.json and REDIS_VALIDATION.json. Public screenshot: images/public-workspace.png. Earlier localhost receipts remain separate.
- Free-tier quotas/cold starts/model variation may cause delays or rejected requests. CORS is not authentication; the endpoint is anonymous and bounded. Small live smokes do not establish arbitrary complex-plan quality. Public visibility does not grant a license to original UNLICENSED code.
- Local development/configuration remains preserved. Physical webcam/microphone were not retested. Owner acceptance: open the HTTPS site; allow camera; point/pinch/move/release/Undo; select a generated structure and test two-hand scale/yaw; minimize camera and verify tracking/Stop; test microphone support; generate/edit then confirm/Undo/Redo/save/load. Do not begin Milestone11 before acceptance.
