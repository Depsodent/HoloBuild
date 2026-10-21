# HoloBuild project overview

HoloBuild is a browser-based 3D construction editor made by Aaryan (Depsodent). It combines mouse/Inspector controls, local webcam landmarks, optional native speech and validated conversational AI in one scene-command/history architecture. Public demo: https://holobuild.vercel.app. Source: https://github.com/Depsodent/HoloBuild. Public source is UNLICENSED; visibility is not an open-source license grant.

## What can be demonstrated

1. Build a scene from six primitive shapes, then transform, duplicate, recolor and undo edits.
2. Generate a two-floor house with connected stairs and balcony using Gemini, inspect its real steps, floor void and aligned access, preview before confirming, then undo/redo exactly.
3. Select a wall in Part mode and add a real window opening without replacing unrelated components. Use Structure mode for whole-building changes.
4. Enter Walkthrough with four primary controls, pass through a native door, climb stairs, visit the balcony and restore the editor view on exit.
5. Jump/sprint in Walkthrough, furnish supported interior surfaces from 45 native presets, then use the same Inspector, AI, gestures and exact history. Unknown room labels require clarification.
6. Save portable JSON, including supported imported GLB/GLTF assets, and load it back. Show mouse/gesture/Inspector edits sharing the same history.

AI availability and model output vary; invalid designs are rejected, and complex prompts may need clarification. Offline supports bounded templates and explicit edits, not arbitrary equivalent LLM generation. Camera and speech demonstrations require actual supported hardware/browser permissions and must be described as pending until tested.

## Implementation

React/TypeScript, Three.js/React Three Fiber and Zustand own UI/rendering/serializable scene data. Native geometry recipes and strict validators are reused by manual, AI and gesture tools. MediaPipe detects up to two hands locally; one-hand movement and two-hand scale/yaw use the existing raycast/preview/command path. Ollama is optional locally; native server-side Gemini powers the hosted planner. Vercel serves static assets and same-origin functions; Upstash supplies existing distributed admission limits. See ARCHITECTURE.md, DEPLOYMENT.md and PERFORMANCE.md.

## Honest limits

Placement and imported/curved walkthrough collision are conservative bounds. Import is static supported glTF, not general CAD/animation. Doors are static panels/open portals, not hinges. Architectural geometry is visual design, not building-code or structural certification. Scene/history/resource budgets are bounded. Native browser speech services differ across devices; typed input remains available. No user-study, community adoption, impact metric or physical compatibility result is fabricated. A future optional evaluation procedure is in USABILITY_TEST_PLAN.md.
