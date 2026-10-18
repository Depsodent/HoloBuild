# Milestone 10.4: conversational design and production reliability

This update is local until the owner approves publication. The existing public deployment remains unchanged. Local frontend: http://127.0.0.1:5175/. Planner: http://127.0.0.1:5180/api/planner/status.

## Confirmed investigation

One production Auto request reproduced the exact detailed-house failure in 6.34 seconds: Gemini returned an HTTP200 SSE result, schema validation succeeded, and strict browser geometry rejected floor/wall overlap. Reference: 8d94fcfe-b69f-4c95-bce4-557db5771d41. Auto then prepared an incomplete Offline fallback because the old word parser did not recognize “six” and role-specific colors were not applied. This was not evidence that Offline execution itself failed. The new error path preserves both causes if both operations actually fail. See MILESTONE_104_INITIAL_INVESTIGATION.json and PRODUCTION_TROUBLESHOOTING.md.

The friend's historical failure remains unattributed. Previously deployed request references, SSE error handling, cancellation compatibility, trusted-IP guards and pre-response lease release remain intact. No new quota exemptions were added:5 requests/IP/minute,100 admitted attempts/UTC day,2 concurrent hosted requests. Rejected reservations do not consume the daily budget; admitted failures and explicit retries do. Temporary Redis failures still fail closed.

## Assistant workflow

Open AI and describe a structure. The default assistant recognizes polite wording, house/home/cottage synonyms and supported construction requests. For supported template designs, Auto uses tested local construction primitives and says so; this is not represented as a Gemini call. A basic Auto house infers two windows per floor and displays that default. Explicit Offline remains a deterministic template. LLM forces a provider request. Unsupported/flexible details use the configured planner and retain honest warnings/errors.

The exact two-story/yellow-wall/purple-wooden-door/six-window/pink-roof design preserves every specified supported attribute. Walls are segmented around fixed door and window panels. The openings are real geometry gaps, but windows and doors are not hinged or physically simulated. There are no stairs or balconies. The model is a visual construction, not an engineering specification.

A proposal does not modify the scene. Confirm with its button or “Yes,” “Looks good” or “Perfect.” The confirmed structure becomes the conversation target. Request another change, review and confirm again. Each confirmed proposal uses the existing command manager and produces one undoable operation. Undo/Redo retain exact object identities. Save/Load includes template dimensions, appearance and layout metadata. Start a new design conversation to clear conversation context while preserving the scene.

Examples after confirming a house:

- Make it two stories; Add a second floor; Add another floor.
- Give it a blue roof and larger windows.
- Change the walls to yellow; Change the front door to wood.
- Add six windows, three on each floor; Put two windows on the second floor.
- Increase the height; Make the house wider; Move the entrance to the left.
- Actually, undo that; Redo; Explain this design; I'm done.

Defaults for relative changes are disclosed: floor height +0.5m, width +20%, window width/height ±20%, entrance shift0.25m. Window counts are a replacement layout, not an unbounded additive operation. An unsupported balcony/stair/hinged-door request explains the limitation instead of claiming success. A nonexistent floor or invalid/colliding layout is rejected without partial edits. Rebuilding floor/window/entrance layouts requires an intact house/tower/office template. Manually altered geometry must be edited with ordinary component tools.

Up to four safe edits can be validated together and confirmed atomically. The interpreter cannot run JavaScript or mutate the scene. Destructive and selection operations are separate. Component creation, transforms, materials and deletion also use preview/confirmation in the default assistant; advanced Commands retains its established deterministic workflow. Imported assets continue through the existing object/material/gesture paths.

The conversation retains at most40 messages. Provider edit requests include at most6 recent messages of160 characters, up to12 structure summaries, selected dimensions, role appearance and a bounded original design request. No camera frames, microphone audio, unrestricted history or complete scene asset data are sent to Gemini by this feature. Browser speech recognition itself can use the browser's external speech service.

## Voice and recovery

New users get manual transcript sending by default. Start the microphone, inspect the recognized text in Ask HoloBuild, edit it, then Send. An existing explicit auto-submit preference remains available in AI Settings. Interim and repeated final events cannot submit duplicate requests. Cancel stops recognition and invalidates pending work. Speech-service/network/permission failures are separate from AI failures and preserve typed text. Browser speech support and connectivity vary; text always remains available.

AI geometry is never silently repaired. Explicit floor/window counts and requested role colors/materials are checked against the generated result. One user-invoked geometry retry is allowed per generation, with bounded overlap/grounding/bounds feedback and normal quota admission. It is not an automatic loop. A failed request keeps the existing scene and original input; safe backend references remain available for troubleshooting.

## Physical acceptance after publication approval

Run the same checklist on the owner's laptop and the friend's laptop; record browser/version, date/time/timezone and whether both share a network. These steps are not yet a claim of physical acceptance.

1. Save existing work, open the approved version in a clean browser tab and choose AI. Confirm the technical modes are under AI Settings.
2. Try “Build a house,” “Generate a home” and “Create a modern two-story house.” Inspect, confirm and Undo each proposal. Test the exact detailed-house request and count six windows, three per floor, with all requested colors/materials.
3. Confirm one design. Ask for a blue roof/larger windows, a second floor and a wider building. Confirm each and verify the same structure changes. Undo/Redo, Save/Load, Cancel and Request Changes must preserve the rest of the scene.
4. Allow microphone access. Speak a request, confirm the editable transcript before Send, and compare with typed sending. Stop/Cancel must stop listening. A speech network error should leave the text available and should not imply Gemini failed.
5. Allow the webcam. Point/pinch/move/release/Undo, two-hand scale/yaw and minimized-camera tracking must still work; Stop Camera must stay accessible. No pinch calibration/threshold change was made.
6. For a failure, follow PRODUCTION_TROUBLESHOOTING.md: send only timestamp/timezone, browser/version, selected mode, POST presence, HTTP/logical SSE status, safe kind/reference/retry fields and the UI error. Do not share raw HARs, keys, cookies, cURL commands or complete streams. Respect Retry-After and public quotas.

New public workflows cannot be verified before the explicitly required publication approval. Automated speech/landmarks and two browsers on one laptop are not independent physical-device verification. Final test counts and local Gemini receipts are recorded in MILESTONE_104_VALIDATION.json after validation completes. No Milestone11/12 work.

## Selected-component coexistence addendum

Part mode keeps natural requests such as “Make this wall blue” scoped to the selected object. “Move this door to the right” uses a disclosed0.25m default; “Make the selected window wider” proposes a disclosed20% local-X width change. Every transform uses the existing placement/snap/collision checks. A door/window fitted tightly into a segmented opening may therefore reject a component-only move/resize: the assistant explains the collision and offers Structure layout editing rather than changing other windows or silently rebuilding walls. These are the same physical placement constraints as mouse/Inspector editing.

Structure mode targets the selected group. Explicit “all/every/whole/entire” requests can promote a selected component to its own containing structure; unrelated structures remain untouched. A singular “this wall” request while an entire structure is selected asks the user to choose Part. “Resize this entire house” without a factor/dimensions asks a clarification. Inspector or mouse changes during a preview make it stale; confirmation cannot overwrite them. Component transforms invalidate only the existing template certificate as ordinary mouse edits already do, while preserving object identity and group membership. No hand-controller, calibration, debounce or scene architecture rewrite was needed.

Browser speech support was checked against the primary [MDN SpeechRecognition reference](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) and [recognition error reference](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionErrorEvent/error) on2026-10-18. SpeechRecognition remains limited across browsers; some implementations use an external recognition service. A recognition network error is therefore distinct from a Gemini request failure. HoloBuild does not claim offline/universal microphone recognition or force-install browser language packs.
