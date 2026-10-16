> Cleanup update, 16 October 2026: the explicitly authorized original C: HoloBuild directory has now been deleted. D:\Projects\HoloBuild is the only active project. The relocation evidence below is historical; see the final cleanup record at the end.

# HoloBuild relocation to D: — 2026-10-16

The active development checkout is **`D:\Projects\HoloBuild`**. Open that folder in VS Code and use it as the working directory for all future terminals and development. The former `C:\Users\AARYAN DESHPANDE\OneDrive\Desktop\HoloBuild` was retained during relocation verification, then removed after explicit user authorization as recorded below. Milestone 10 development now uses D: exclusively.

## Copy and integrity

The source was clean on branch `master`, checkpoint `096c7aa2631d393e5dd215817cb710a7bf9c9837` (verified Milestone 9.1). There were no incoming uncommitted source changes. D: was NTFS with approximately 204 GiB free and the destination did not exist. No existing destination was overwritten or merged.

Stopped only HoloBuild's frontend and planner before copying. Ollama stayed running. This was the only active Codex chat shown by the app; no project test/compiler/server writer remained. Full source inventories before and after the copy were identical, providing a direct check for concurrent file changes. VS Code windows, browser profiles, Windows settings and unrelated OneDrive files were not changed.

Robocopy used `/E /COPY:DAT /DCOPY:DAT /XJ /SL /R:2 /W:1 /MT:8`. No move, mirror, purge or source-deletion option was used. Exit code 1 reported successful copying: **17,391 files**, **1,492 subdirectories** (1,493 directories including root), **496,247,498 bytes**, zero failures, mismatches or extras. The inventory found no symlinks or junctions.

Independent SHA-256 and size comparison of every file, including `.git`, ignored files, dependencies, configuration, assets and hidden files, found **zero missing, extra or changed files**. Directory and link inventories also matched. The source after copying still matched its pre-copy snapshot. These comparisons were completed before running the app or adding D:-specific configuration/documentation. Subsequent build/test/cache files are expected to regenerate only in D:.

The copied Git root is `D:/Projects/HoloBuild`, its Git directory is `D:/Projects/HoloBuild/.git`, and `git fsck --full` passed. Initial destination branch, commit, refs and clean status matched the source. Neither original nor copy had a configured remote; no branch, remote, push or clone was created during copying. A documentation-only relocation checkpoint may follow the source commit; the full original history remains intact.

Audit inventories, copy log, local-model UI screenshot and smoke results are retained outside either project copy under `C:\Users\AARYAN DESHPANDE\.codex\.chatgpt-projects\g-p-6acb98f2c7c48191bc2f484c5cdff883\relocation-audit`.

## Environment and configuration

Node **v24.20.0** and npm **11.19.0** were verified. The existing copied dependencies work; no `npm install`/`npm ci`, Node reinstall, model download or Ollama reinstall was needed.

No old-project absolute path appeared in runtime source, server/shared/scripts, VS Code settings, package/lockfiles, Vite/TypeScript/Playwright configuration or the refreshed dependency metadata. Historical references in DEVELOPMENT.md are intentionally retained. Existing VS Code settings use a relative TypeScript SDK. No launch/task settings required relocation edits. Vite was started once with `--force` to refresh location-dependent dependency caches.

The original had **no `.env` file**. Created a new ignored D:-only `.env` from the existing example, configuring the already-installed **`qwen3:4b-instruct`** at the existing local Ollama service **`http://127.0.0.1:11434/v1`**, with the supported **120,000 ms** backend timeout cap. Other safe example settings were retained; no API key was added or printed. `.env` remains Git-ignored and is never part of scene exports or the relocation documentation commit.

For local model requests, use **Ask HoloBuild → AI Settings → Timeout (seconds): 120** when needed. The application still starts with its existing 30-second UI timeout; no application defaults or planner logic were changed. An initial live request failed; a tiny direct Ollama completion then succeeded, and a UI retry exceeded the old 30-second budget. With the supported extended timeout, the real browser UI obtained a validated Qwen plan, previewed it without changing the scene, confirmed one floor component as one history action, and Undo restored the exact original scene. The successful UI smoke completed in **26.502 seconds**, with zero page errors. This verifies one real model request, not all prompt/model-output quality or performance.

## Running from D:

```powershell
Set-Location 'D:\Projects\HoloBuild'
npm.cmd run planner
# In another terminal, also in D:\Projects\HoloBuild:
npm.cmd run dev -- --port 5175 --strictPort
```

- Frontend: **http://127.0.0.1:5175/**
- Planner: **http://127.0.0.1:5180/** (service endpoints are `/api/planner/status`, `/api/planner/connection`, `/api/planner/plan`; `/` is not an HTML page)
- Ollama: **http://127.0.0.1:11434/**

The frontend deliberately retains the same origin as before. Browser Local Storage and IndexedDB are stored in browser profiles, not in the repository; they were not moved or cleared. Keep the same browser profile, hostname and port to access existing browser-stored projects. Assets stored inside the project were all copied and hash-verified; portable assets/scene persistence are also covered by regression tests. No claim is made that a user's private browser profile was physically inspected.

## Validation and cleanup

Run the repository's unchanged `typecheck`, `lint`, `test`, `test:server`, `test:e2e` and `build` scripts from D:. Final results are recorded in DEVELOPMENT.md. Production output retains the same asset hashes as the C: build, apart from expected regenerated build metadata; the existing non-blocking Zod annotation/large-bundle warnings remain.

Automated gesture/browser checks and synthetic video do not establish physical webcam or microphone verification. No application logic, recognition thresholds, gesture debounce, geometry/commands, materials, AI adapter or scene format was modified for relocation.

**Do not delete the original C: folder without explicit user approval.** After approval, recheck both absolute paths and the healthy D: copy, then remove only the exact original HoloBuild directory. No source cleanup has been performed by this relocation task.

### Final results

- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd test`: 178 passed in 20 files.
- `npm.cmd run test:server`: eight passed.
- `npm.cmd run test:e2e` with serial Edge on the original localhost URL: **89 passed in 11.5 minutes**.
- `npm.cmd run build`: passed; all 15 regenerated production files match the C: build's SHA-256 and sizes.
- Real local Qwen preview → confirm → Undo: passed separately, one component/one history entry, zero page errors; tested with the existing 120-second UI setting.

The active frontend and planner remain running from D:. No application or test code was changed. At the end of relocation verification, original C: cleanup was pending explicit approval. That approval and subsequent cleanup are recorded in the following section.
## Authorized cleanup completed — 16 October 2026

The user explicitly authorized removal of **only** `C:\Users\AARYAN DESHPANDE\OneDrive\Desktop\HoloBuild`. Before deletion, verified the D: working tree was clean on master at `61a74a1`, required package/source/server/Git/private environment files existed, and `git fsck --full` passed. The old source remained clean at its original `096c7aa` checkpoint. Inspected active processes: frontend/esbuild were using D:, with no old C: project process found. Both project roots were ordinary, distinct directories with no junction/symlink target; recursively checked the old project for actual directory links. The Desktop ancestor carries OneDrive cloud reparse metadata (tag `0x9000601a`), not a junction or symbolic-link target; neither project root is linked.

Used native PowerShell `Remove-Item -LiteralPath` against the exact authorized old directory after resolving/checking both absolute paths. No parent directory, unrelated project, Codex configuration, Ollama installation/model, or browser storage was removed. Verified old directory absent and D: project/Git/private environment intact, with clean checkpoint `61a74a1` immediately afterward.

Removed **496,247,498 logical bytes** (about **473 MiB**). C: free space increased by **528,445,440 bytes** (about **504 MiB**) during the operation; allocation and concurrent filesystem activity can differ from logical file sizes. All subsequent Milestone 10 development and validation use D: exclusively.
