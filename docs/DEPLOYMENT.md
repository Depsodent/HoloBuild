# GitHub and public deployment preparation

Status: local preparation only. Do not create a repository, push, connect automatic hosting or deploy until the owner explicitly approves this plan. No public deployment has been verified. Milestone 11 is out of scope.

## Repository

- Account: **Depsodent** (authenticated account checked).
- Proposed repository: **HoloBuild**, **public**, `https://github.com/Depsodent/HoloBuild`.
- Existing local history is preserved. No reset, history rewrite, push or remote resource creation is part of preparation.
- Excluded: `.env*` except placeholder `.env.example`, credential/key files, node_modules, dist, local caches/reports, `.vercel`, model weights, generated MediaPipe assets and personal imported GLB/GLTF/BIN bundles.
- Secret audit scans current non-ignored files, every reachable historical blob, and production output; it also checks for exact locally configured secrets without printing values. `docs/PUBLICATION_AUDIT.json` records findings and reviewed fake fixtures. Pattern scanning is not a guarantee of complete detection.
- Production dependency advisory check: zero reported vulnerabilities on 2026-10-17. Author credits, commit author metadata and historical local-path development notes remain visible in a public repository; no private configuration was intentionally included.
- Original code remains UNLICENSED. Third-party license inventory and recovered upstream notices are generated during build. See `THIRD_PARTY_NOTICES.md` for the stats-gl upstream notice gap.

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
