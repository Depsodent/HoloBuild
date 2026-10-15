# Voice and text construction commands — Milestone 8

Open **Construction Tools → Voice & AI Commands**. The name follows the workspace roadmap; this milestone uses a deterministic TypeScript parser, with no AI model, external application API, backend or API key. Type a command and press Enter/Execute, or explicitly press Start listening. Listening never starts automatically and does not resume itself after an error/disconnection.

Both input methods use the same normalize → allowlisted intent → target/argument validation → confirmation when destructive → existing scene command → result pipeline. Unsupported/ambiguous requests leave the scene unchanged. Use one command per utterance/input. Capitalization, repeated whitespace and trailing sentence punctuation are ignored. Number words, decimals and common verb/unit synonyms work; arbitrary conversational sentences and chained operations are outside this milestone.

| Action | Examples |
| --- | --- |
| Create | `Create a cube`, `Add a sphere`, `Create a cylinder`, `Add a cone`, `Create a wall`, `Add a floor` |
| Select | `Select Cube`, `Select object named My wall`, `Select object with id <exact ID>`, `Select last created object` |
| Deselect | `Deselect`, `Clear selection` |
| Move | `Move it right by 2 meters`, `Translate this up 50 centimeters`, `Move selected object forward one point five metres` |
| Rotate | `Rotate it by 45 degrees`, `Turn that minus ninety degrees` |
| Scale | `Scale the selected object by 1.5`, `Resize it by two times` |
| Duplicate/delete | `Duplicate it`, `Copy selected object`, `Delete it`, `Remove that` |
| Color | `Make the selected object red`, `Change its color to blue`, `Set color to #39dcca` |
| Material | `Apply wood material`, `Change material to glass`, `Apply concrete material`, `Apply polished metal material` |
| Scene | `Undo`, `Redo`, `Save the scene`, `Clear the scene` |

Create verbs: create/add/make/insert. Shape names are the six existing primitive names; no new model import/structure generation command is implied. Creation and duplication select the new object through the existing command manager. Select matches exact case-insensitive unique names or full IDs (Object Inspector → Object Properties). Duplicate names produce an ambiguity error. Last created means the last object in scene collection order, including a newly imported/duplicated object; after loading a project it refers to that collection's last entry. A named object called “last” is reserved by this shortcut; use its ID instead.

`it`, `this`, `that`, `selected object`, `this object` and `that object` resolve only to the current selection, not gaze, hand position or a random scene object. Transform/appearance/delete/duplicate commands fail clearly when nothing is selected. Imported static models support the same allowed transforms, duplication/deletion and material/color overrides; changing appearance disables their original-material rendering exactly as the inspector does. Restore original surfaces through the existing inspector checkbox.

## Coordinates, numbers and validation

Movement is **world-relative**, independent of camera orbit: right/left = ±X, up/down = ±Y, forward/backward = −Z/+Z. `forwards`, `back` and `backwards` are accepted. Distances default to metres; m/meters/metres, cm/centimeters/centimetres, mm/millimeters/millimetres, feet/foot/ft and inch/inches/in are supported. Amounts must be positive and at most 50 metres after conversion; use the opposite direction rather than a negative distance. Whole-object ground, workspace and collision checks may reject smaller requests too.

Rotation is world-Y yaw, using the same quaternion helper as two-hand rotation, preserving existing tilt. Degrees are default; nonzero signed angles up to ±3600 are accepted. There is no camera-relative movement, arbitrary-axis voice rotation or multi-object editing. Scale is a uniform positive multiplier at most 20; every resulting object axis must remain between 0.1 and 20. Grounded rotation/scaling preserves ground contact through the existing command manager. X/Z grid snapping remains 0.5 m when enabled; sufficiently small snapped moves may be unchanged and create no history.

Numeric forms include `1.5`, `two`, `twenty-five`, `one hundred and eighty`, `one point five`, and signed rotation forms `-90`, `minus ninety`, `negative forty five`. The grammar is bounded to hundreds with optional spoken decimal digits. Expressions, fractions, exponential notation, NaN/Infinity and guessed homophones are rejected. Inputs are limited to 240 characters.

Colors: red, blue, green, yellow, orange, purple, pink, white, black, gray/grey, cyan, teal and six-digit hex. Presets: matte plastic, glossy plastic, satin metal (`solid`), polished metal, glass, holographic, wood, brick and concrete; exact existing IDs are also accepted. Material changes preserve base color and clear prior optical overrides just as the inspector does. Commands do not invent unsupported textures or settings.

## Confirmation, history and compatibility

Delete and clear-scene always show an inline Confirm/Cancel step. No spoken “yes” executes a pending destructive request. Confirm uses the captured target ID, scene snapshot and selection; any intervening object/selection change or active preview rejects it. Other commands wait for that confirmation to be resolved. Cancelling changes nothing. A successful changed object command creates one existing history entry, with no separate voice scene/history. Selection, saving, failed commands and no-op transforms create none. Undo/Redo operate existing stacks and clear selection according to prior behavior. Re-select afterward when needed.

Spoken commands received during an active object preview are rejected until it is released/cancelled. Pointer interaction with the sidebar retains existing gesture takeover/cancellation behavior. Voice input never listens to gesture streams or dispatches generic virtual DOM clicks. Concurrent commands are rejected while an asynchronous save is pending. Save uses the exact same portable JSON/local-metadata helper as the header button, including imported resources. Browser download policy can require a user action; verify the downloaded file and use the header Save button if necessary.

## Speech support and privacy

Runtime detection uses `SpeechRecognition` or `webkitSpeechRecognition`; English (`en-US`) is requested. Browser/provider support and network availability vary even when the API exists. Text input is always available. No microphone call is made until Start listening. Stop aborts pending audio rather than executing a partial phrase. Collapsing this group, collapsing construction tools/unmounting the panel, hiding the document or leaving the app also aborts recognition; reopening never auto-starts it. Webcam capture remains independent.

Interim transcripts are display-only. Only final results execute; each final result index is processed once per recognition session. Replayed cumulative results cannot duplicate an action. Deliberately repeating an utterance as a new final result is a new command. Late callbacks from stopped/replaced sessions are ignored. Permission denial, unavailable/busy audio, service/network errors, no speech, no match and cancellation produce visible feedback without automatic restarts. A save already requested may finish after the panel is closed.

Speech recognition is **not guaranteed offline or private**. Some browser implementations send audio to a remote recognition service; this app does not select or control that provider. Review browser/site microphone settings and provider policies. No microphone recordings or transcripts are persisted by HoloBuild. See [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) and [final-result semantics](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionResult/isFinal). Automated microphone tests use mocks; actual speech accuracy/permissions require the user's physical acceptance.
