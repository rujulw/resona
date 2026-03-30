# Bug Log

## 2026-03-29 - Avoided invalid Tauri frontend path during desktop boot
- Status: fixed
- Severity: high
- Symptom: `cargo tauri dev` failed before startup because the pre-dev command resolved the frontend package path outside the repo and `npm` could not find `client/package.json`.
- Root cause: the Tauri build config used `../client` for `beforeDevCommand` and `beforeBuildCommand`, but the commands were executed from the repository root rather than from `server/`.
- Fix: updated the Tauri build commands to use the repo-relative `client` path so both dev and build boot flows resolve the frontend correctly.
- Verification: `cargo tauri dev` advanced past the missing-package error, `npm run build` passed in `client/`, and `cargo check` passed in `server/`.
- Files touched:
  - `server/tauri.conf.json`
- Linked commit/PR: pending
- Notes: this was a startup-only failure, but it blocked all local desktop verification until the path contract was corrected.

## 2026-03-29 - Avoided Tauri startup failure from missing icon asset location
- Status: fixed
- Severity: medium
- Symptom: the Rust/Tauri shell failed during `cargo check` because `generate_context!()` expected an icon at `server/icons/icon.png` and could not find one.
- Root cause: the project had an icon asset, but it was placed at `server/icon.png` instead of the generated Tauri icon path the build expected.
- Fix: moved the icon into `server/icons/icon.png` so the Tauri context generator could load the asset from the expected location.
- Verification: `/Users/rujulw/.cargo/bin/cargo check` passed after the icon was placed in the expected directory and the client production build also passed.
- Files touched:
  - `server/icons/icon.png`
- Linked commit/PR: pending
- Notes: this was an integration mismatch between project assets and Tauri defaults rather than a Rust logic bug.

## 2026-03-29 - Avoided broken client bootstrap build from outdated TypeScript module settings
- Status: fixed
- Severity: medium
- Symptom: the client production build failed with missing `Set`, `Buffer`, `node:*`, and Vite module resolution errors even though the app code itself was straightforward.
- Root cause: the scaffold used TypeScript module-resolution settings that did not match the Vite 7 toolchain and was also missing Node type declarations needed by the build config.
- Fix: updated the client TypeScript configuration to use bundler module resolution, added the required Vite and Node types, and installed the missing development dependency.
- Verification: `npm run build` passed in `client` and the desktop shell smoke checks ran successfully with `npm test`.
- Files touched:
  - `client/package.json`
  - `client/package-lock.json`
  - `client/tsconfig.json`
  - `client/tsconfig.node.json`
- Linked commit/PR: pending
- Notes: fixing the toolchain mismatch early kept later desktop-shell commits focused on app behavior instead of build-system churn.

## 2026-03-30 - Avoided deep-page slowdown from offset-based library pagination
- Status: fixed
- Severity: medium
- Symptom: large-library browsing risked getting slower on deeper pages if pagination was implemented with growing SQL offsets or by loading and sorting broad result sets in application memory.
- Root cause: the straightforward implementation path for search and sort was to issue offset-based queries or to hydrate a large result set and paginate after sorting, both of which scale poorly as the library grows.
- Fix: implemented indexed query paths with cursor pagination, stable sort tie-breaks, and a whitelisted sort-key contract so page navigation stays bounded and predictable.
- Verification: Rust tests cover paginated query behavior, `cargo test` passed for the query command, and `cargo check` passed with the indexed query migration applied.
- Files touched:
  - `server/db/migrations/0002_library_query_indexes.sql`
  - `server/src/database/mod.rs`
  - `server/src/database/schema.rs`
  - `server/src/library/mod.rs`
  - `server/src/lib.rs`
- Linked commit/PR: pending
- Notes: this fix is more about long-term performance posture than visible correctness, but it prevents library browsing from regressing as collection size and page depth increase.

## 2026-03-30 - Known ingest gap for MP3 duration when files omit ID3 duration metadata
- Status: open
- Severity: medium
- Symptom: some indexed tracks show `--:--` in the library table even though macOS and other media tools display a valid duration for the same files.
- Root cause: the current scan pipeline reads duration from `id3::Tag::duration()` only, and many MP3 files do not store track length in the ID3 metadata even when the duration can be computed from the audio stream itself.
- Fix: pending; upgrade the ingest path to compute duration from actual audio frame data instead of relying only on ID3 duration fields.
- Verification: local files can display valid duration in system tools while `resona` stores `NULL` for `duration_seconds`; the normalization path currently uses `Tag::read_from_path(...).duration()`.
- Files touched:
  - `server/src/library/normalization.rs`
  - `server/src/pages/TracksPage.tsx`
- Linked commit/PR: pending
- Notes: this is a metadata fidelity gap rather than a UI bug; the frontend is rendering the missing value honestly.

## 2026-03-30 - Known ingest gap for embedded artwork extraction during local scan
- Status: open
- Severity: low
- Symptom: tracks with visible cover art in system media tools still appear without artwork in `resona`.
- Root cause: the current library ingest pipeline does not extract, persist, or expose embedded artwork from MP3 metadata, and `artwork_key` remains unset during track upsert.
- Fix: pending; add artwork extraction and persistence so embedded cover images can be surfaced to the client.
- Verification: the current track write path stores `artwork_key` as `NULL`, and no client route or command currently receives artwork data.
- Files touched:
  - `server/src/library/scanner.rs`
  - `server/src/library/normalization.rs`
- Linked commit/PR: pending
- Notes: this is expected at the current stage of the branch, but it is a real ingest completeness gap worth tracking before playback and richer track presentation land.

## 2026-03-30 - Avoided frontend shell regressions while splitting the client into routed pages and layout modules
- Status: fixed
- Severity: medium
- Symptom: the client shell risked regressing during the `App.tsx` split because routing, bootstrap state, playback chrome, and track loading were all being moved at once.
- Root cause: the original desktop shell had grown into a single top-level file, so structural cleanup could easily break route boot, shell persistence, or the tracks page without an obvious failure until manual testing.
- Fix: added frontend smoke checks for routed app boot, tracks-route shell render, and navigation into settings while keeping the playback shell mounted.
- Verification: `npm test` passes with smoke coverage for app boot and route rendering, and `npm run build` passes for the production Tailwind/Vite client build.
- Files touched:
  - `client/src/App.test.tsx`
  - `client/package.json`
  - `client/package-lock.json`
- Linked commit/PR: pending
- Notes: this branch still leaves real playback for the next branch, but the desktop shell itself now has basic regression protection.

## 2026-03-30 - Avoided drift between selected track state, transport controls, and queue behavior
- Status: fixed
- Severity: medium
- Symptom: once local playback was added, the app risked showing one selected track in the library while the playback bar, transport controls, and queue route reflected a different item or stale next-up state.
- Root cause: active playback identity, transport actions, and queue rendering were all introduced in separate slices, which created a real risk that one surface would update without the others.
- Fix: routed active-track selection, previous/next behavior, queue derivation, and progress synchronization through the same app-shell playback state instead of letting each page own its own interpretation.
- Verification: `npm test` passes with smoke coverage for selection, transport movement, queue derivation, progress sync, and restart-on-previous behavior, and `npm run build` passes for the production client build.
- Files touched:
  - `client/src/hooks/useAppShell.ts`
  - `client/src/components/layout/PlaybackBar.tsx`
  - `client/src/pages/QueuePage.tsx`
  - `client/src/App.test.tsx`
- Linked commit/PR: pending
- Notes: this fix establishes a clean local-playback baseline before remote playback, richer queue editing, and repeat/shuffle logic are layered in.
