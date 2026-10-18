# Production request troubleshooting

Public site: https://holobuild.vercel.app. Browser/client acceptance remains required on the affected physical laptop. Do not clear site storage without exporting your project first.

## Collect one sanitized failure

1. Open the public URL in your friend's browser. Record date, local time and timezone, browser name/version (About), and selected mode. Save your project first. Reload with DevTools open, Network: Preserve log and Disable cache. Do not repeatedly click Send.
2. Filter Network by /api/planner/. Choose LLM and type the same building request once. Select the POST /plan (or /edit). Record status, duration, Content-Type, Retry-After, X-Request-ID, X-Vercel-ID and response Date, where present. Record only origin/path, not the request payload.
3. Under Response, copy only safe diagnostic fields: error, kind, status, requestId and retryAfterSeconds. For text/event-stream, HTTP200 does not prove success: find event: error and its data JSON. A result event followed by an interface error can mean client schema/geometry rejection; include the interface error and Reference. Do not copy generated scene data or the full stream unnecessarily.
4. If no POST appears, record the first relevant red Console message (for example unsupported API or fetch/CORS failure), removing private URLs, prompts and identifiers unrelated to this request. Include whether /status succeeded and whether the page loaded its hashed JS asset. A missing POST suggests routing/browser failure before the backend.
5. For speech: first confirm the final transcript matches the intended request and that LLM/Auto/Offline is selected. Commands is a limited deterministic grammar. If auto-submit is disabled, press Send. Record whether the same /plan request appears. Transcription success alone does not establish AI request success.
6. Share this short template: time/timezone; browser/version; mode; typed vs speech; POST present yes/no; HTTP status; safe response fields; Retry-After; X-Request-ID; X-Vercel-ID; interface error. Do not share a raw HAR, Copy as cURL, Cookie/Authorization headers, keys, Redis credentials, or all request/response headers. Redact private prompt content.
7. Obey Retry-After before one retry. If a same-network peer was sending requests, both may share the five-per-minute network allowance. Do not rotate VPN/IP to evade limits. Offline remains available.

## Error meanings

- rate-limit: network/process window; retry after the supplied seconds.
- concurrency: both generation slots are occupied; retry after the estimated lease deadline (capacity can return sooner).
- daily-quota: public daily generation budget; retry at next UTC day. Failed admitted attempts count, rejected reservations do not.
- quota-store: safety service unavailable. Requests fail closed with503 and five-second retry guidance. This does not establish a Gemini failure. No automatic retry of ambiguous Redis reservations.
- provider-quota: provider returned429, including metadata verification; retry guidance is conservative, and free-tier daily quotas may require longer. There is no paid escalation or model switching.
- validation/client validation: invalid request/output/geometry was rejected safely; no geometry repair. Client errors carry the backend Reference when available.
- A server reference appears in X-Request-ID and error/result payloads; safe structured runtime entries contain timestamp, logical status, phase, category and reference. They exclude prompts, raw IPs, credentials and provider bodies. SSE errors retain logical status in their payload because HTTP headers may already be200.

## Cache, origin and browser audit

Frontend uses relative same-origin /api/planner/*, JSON POST and SSE. Only the exact production Host/Origin is accepted; no CORS wildcard or client-supplied trusted-IP fallback was added. HTML is max-age=0,must-revalidate and JS is content-hashed. Source registers no service worker. An old already-open tab can retain old code until reload; preserve project files when refreshing. Fresh-profile browser tests cannot establish the affected laptop's cache state or extension behavior.

AbortSignal.any/timeout calls were removed from the frontend planner path in favor of cleanup-aware AbortController deadlines. Fetch, streaming responses, TextDecoder, AbortController and WebGL are still required. Speech service/browser support varies; typed input remains available.

Historical incident window: Oct18 00:00–00:35 IST (Oct17 18:30–19:05 UTC). Exact request query returned launch-test failures and two later200 plan calls at00:31:11/00:31:44 IST. Historical function messages and original SSE payloads were unavailable. These cannot prove your friend's identity, provider failure, Redis outage or successful previews. See CROSS_DEVICE_INCIDENT.json. No paid observability was activated.

Platform references: [Vercel trusted request headers](https://vercel.com/docs/headers/request-headers) and [runtime logs/retention](https://vercel.com/docs/logs/runtime). The exact historical runtime query was rejected as outside Hobby retention; no paid upgrade was performed.

## Confirmed live reproduction and correction

The exact house request reproduced overlapping generated walls/floor in fresh Edge and Chromium profiles on the developer laptop. Invalid output was safely rejected; network/quota acquisition succeeded. A geometry-tested six-part example now guides local dimensions, rotations, wall elevations and non-overlapping corners. This is provider guidance, not automatic repair or an Offline substitution. Post-correction construction, confirmation and exact Undo/Redo passed in both profiles; arbitrary future model output can still fail validation. A completed serverless response also retained a quota lease until expiry; release now finishes before the terminal result/error is sent. The final public test confirmed zero leases immediately after completion. These findings do not prove which failure occurred on your friend's historical request. Reload and test that laptop; use the sanitized capture procedure above for any recurrence.
