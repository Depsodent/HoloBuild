# Deployment and server configuration

Public app: https://holobuild.vercel.app. Repository: https://github.com/Depsodent/HoloBuild. One existing Vercel project serves Vite assets and Node planner functions. See the latest milestone production receipt for exact source/deployment IDs, safe logs and rollback. Routine owner authorization covers Implement → Test → Commit → Push → Stage → Verify → Promote → Smoke → Report. Paid services, spending/quotas, production deletion and major infrastructure changes still require separate approval.

## Local development

Use Node22.12+ or Node24, npm ci and npm run setup:vision. The latter downloads versioned MediaPipe runtime/model assets from official sources and verifies hashes; generated assets are ignored by Git and rebuilt for hosting. npm run dev:local starts/reuses Vite on127.0.0.1:5175 and planner5180. npm run dev:gemini uses the separate ignored Gemini profile. Check the actual printed URL and health, rather than starting duplicate servers.

Offline requires no provider key and supports bounded templates/explicit edits. Local Ollama uses ignored .env based on .env.example: LLM_PROVIDER=compatible, PLANNER_MODE=local, loopback LLM_BASE_URL ending /v1, and an exact already-installed LLM_MODEL/LLM_MODELS. No model is downloaded by the planner. Keep Ollama loopback-only; local Ollama is not available to a public Vercel function.

For Gemini, use ignored .env.gemini.local with LLM_PROVIDER=gemini, PLANNER_MODE=local, GEMINI_API_KEY, an exact account-supported GEMINI_MODEL, timeout and localhost APP_ORIGINS. Never prefix credentials with VITE_ or put them in source/build flags/chat. npm run check:gemini discovers account metadata without generating. The existing hosted model is gemini-3.5-flash-lite, validated against this configured account; this is not a claim about universal availability or current pricing.

## Existing production

Vercel builds npm run setup:vision && npm run build into dist. api/planner/[action].mjs reuses server/app.mjs and does not listen on a public port. Hosted mode enforces native Gemini and same-origin relative /api/planner/status, /connection, /assistant, /plan and /edit endpoints. Compact schema-compatible output envelopes are followed by strict runtime and geometry validation; HTTP200 alone does not prove a streamed result succeeded. Preview is inert; confirmation uses the existing atomic scene command.

Protected **production-only server variables** are PLANNER_MODE=hosted, LLM_PROVIDER=gemini, GEMINI_API_KEY, exact GEMINI_MODEL, LLM_TIMEOUT_MS, exact HTTPS APP_ORIGINS, PUBLIC_AI_ENABLED, PUBLIC_AI_DAILY_LIMIT, UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. Verify metadata without printing values. The existing deployment remains Hobby; the owner reported free-tier Gemini with billing disabled and claimed Free Upstash. No code/API check can independently establish future provider billing status. Do not enable or upgrade a paid service.

Credentials stay server-side. Ignored .env*, .cache, .vercel, Git internals, test/build outputs, model weights and personal GLB/GLTF assets are excluded from publication/upload. docs are GitHub reference material, excluded from the runtime upload. Build-generated full third-party notices are public; the stats-gl distribution guard fails if its unlicensed implementation bytes enter the bundle. Original project code remains UNLICENSED.

## Admission, privacy and errors

Preserve existing atomic Upstash limits: **5 requests per IP/minute, 100 admitted generations per UTC day, 2 concurrent generation leases**. IP identity uses the trusted Vercel-overwritten header, canonical IPv4/IPv6/mapped forms and a conservative missing-header bucket; Redis keys contain HMAC identities. Rate/day/concurrency rejection occurs before daily increment. Provider failures after admission consume that admitted attempt. Leases release on completion and expire defensively. Connection checks use the IP gate, not generation/day admission; GET status returns metadata without a generation call. Missing/unavailable quota storage fails closed. CORS/origin checks are browser protections, not anonymous-client authentication.

Schemas bound prompt/request/response/part counts; arbitrary tools/URLs/code are not executable plans. HTTPS, nosniff, referrer and camera/microphone Permissions-Policy headers remain. Safe error categories, retry seconds and request IDs support recovery. Rate failures must retain the existing safeguards. Offline can handle basic templates/explicit edits; it must not be described as an equivalent fallback for any complex LLM prompt.

Camera frames/landmarks remain on the device. Browser-native speech may use the browser provider. AI prompts and compact scene/selection context reach the selected server-side provider; don't enter private data without reviewing that provider/account's terms. No sensitive prompt cache or unnecessary content logging is added.

## Release procedure

1. Preserve changes and inspect Git/instructions. Run referenced TypeScript (npx tsc -b), ESLint, relevant unit/backend/browser tests and production build. Run one serial browser process at a time. Reuse valid unchanged-path results with explicit scope; do not change runtime files mid-suite.
2. Run npm audit --omit=dev and node scripts/audit-publication.mjs --write. Audit current files, all reachable history and final output for patterns/exact locally configured values without printing secrets. Review intentional negative fixtures and notices. Commit a stable checkpoint; push the existing branch normally.
3. Snapshot current READY deployment/rollback, account plan and sensitive-variable metadata using authenticated read-only APIs. Stage the existing project with vercel deploy --prod --skip-domain --yes --meta githubCommitSha=<fullSHA> --meta githubCommitRef=master. Use the existing authenticated official CLI; never embed auth tokens.
4. Verify READY/exact source/project, private upload exclusions, unchanged protected settings and free plan. Promote the candidate with vercel promote <candidateURL> --yes. Preserve the previous deployment for rollback. If genuinely broken, promote the previous working URL rather than leaving known broken production active.
5. Verify public alias metadata and every deployed JS hash against the audited local build. Run scripts/verify-hosted-security.mjs for HTTPS/headers, exact origin/CORS denials, private404, known-secret absence, WASM MIME and notices. Review safe Vercel request IDs/status/category/timestamps; check terminal SSE result/error events independently. Verify generation leases release, without modifying quota counters.
6. Explicit real-provider smoke: HOLO_LIVE_GEMINI=1, HOLO_MILESTONE=13, HOLO_EXPLORATION_SMOKE=1, HOLO_PRECISION_SMOKE=1, HOLO_SOURCE_SHA=<fullSHA>, HOLO_RELEASE_URL=<production-compatible local/public URL>, then node scripts/smoke-milestone105.mjs. This uses real Gemini, not mocks, and follows existing quotas. Check actual rendered geometry, typed follow-ups, preview/cancel/confirm, exact history and portable IO. Production permission smoke uses scripts/smoke-exploration-permissions.mjs with synthetic recognition and no provider calls.
7. Save actual receipts, update DEVELOPMENT and the milestone handoff, commit/push final documentation and verify a clean tree. Documentation-only changes need no runtime redeploy. Separate physical-device acceptance from automated evidence.

## Troubleshooting and sanitized reports

If localhost AI returns503, check both services and configured provider; the UI retains typed input and specific local-planner guidance. For public errors, report browser/version, exact date/time/timezone, mode, displayed category/request ID and retry seconds. Hard-refresh if the UI is stale. The app has no registered service worker; ordinary browser/CDN caching still applies.

For a friend-device failure, open Developer Tools → Network, filter /api/planner/, submit a non-sensitive example once and select the failed request. Share only HTTP status, request ID header (if present), Retry-After, and sanitized response fields kind/status/error/requestId/retryAfterSeconds. For an HTTP200 event stream, capture the terminal event:error fields instead of assuming success. Exclude request payloads, Authorization/Cookie headers, credentials, raw provider output and unrelated personal traffic. A failed request must leave confirmed scene geometry unchanged.

For camera/microphone, use localhost/HTTPS, inspect site and OS permission/device selection and the actual displayed support/status/error. Stop finalizes captured speech; Cancel aborts but preserves finalized text. Unsupported native recognition keeps normal text entry. Physical microphone/webcam/touch/friend-laptop acceptance remains pending until actually reported.
