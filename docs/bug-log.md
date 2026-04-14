# Bug Log

## 2026-04-13 - Fixed playlist drag reorder snapping back and starting from the wrong surface
- Status: fixed
- Severity: high
- Symptom: playlist drag reorder looked partly active in the UI, but dropping could snap the entry back to its old position, and dragging could start from the entire saved-order row instead of only from the reorder grip.
- Root cause: the first drag implementation leaned on row-level HTML drag behavior and non-optimistic shell updates, which made reorder commits feel flaky and blurred row-selection intent with reorder intent.
- Fix: moved reorder initiation onto the dedicated handle, switched the saved-order interaction to a handle-owned pointer drag flow with explicit insertion markers, added optimistic saved-order updates in the playlist view, and expanded smoke coverage for reorder persistence plus queue-snapshot stability after handoff.
- Verification: `npm test -- --run src/App.test.tsx` passed with 32 frontend tests and `cargo test playlist_reorder_does_not_mutate_an_existing_handoff_queue_snapshot` passed.
- Files touched:
  - `client/src/pages/PlaylistsPage.tsx`
  - `client/src/App.test.tsx`
  - `server/src/commands.rs`
  - `README.md`
  - `docs/design.md`
  - `docs/architecture.md`
  - `docs/roadmap.md`
  - `release-smoke-checklist.md`
- Linked commit/PR: pending
- Notes: this closed both the UX bug and the contract gap by making reordering explicit at the handle level while keeping handed-off playback queues snapshot-based.

## 2026-04-03 - Added smoke coverage for backend-owned playback sync in `v1.3.0`
- Status: fixed
- Severity: medium
- Symptom: after shifting playback authority into Rust, the repo still lacked a tight smoke-check layer proving the backend timing/seek/completion/error path and the frontend playback-bar rendering path stayed aligned.
- Root cause: the migration had implementation coverage for individual pieces, but not enough end-to-end smoke coverage around the new backend-owned playback synchronization contract.
- Fix: added backend runtime and command smoke tests for timing, seek, completion, and error transitions, plus frontend shell smoke coverage that verifies backend-owned pause and ended snapshots drive the playback UI.
- Verification: `cargo test` passes with 37 backend tests and `npm test` passes with 32 frontend tests.
- Files touched:
  - `server/src/commands.rs`
  - `server/src/playback/mod.rs`
  - `client/src/App.test.tsx`
- Linked commit/PR: pending
- Notes: this closes a release-readiness gap for `v1.3.0` by checking the current backend-owned playback model at both the Rust and shell layers.

## 2026-04-11 - Closed playlist release-readiness gaps before the `v1.3.0` push
- Status: fixed
- Severity: medium
- Symptom: the repo had first-class playlist persistence and queue handoff, but the release surface still lacked aligned version metadata, playlist smoke coverage for the current shell, and release-check documentation that matched the actual product.
- Root cause: playlist implementation outpaced the repository metadata and release docs, leaving `v1.2.x` references and older smoke expectations in place even after the playlist route matured.
- Fix: updated repository metadata to `1.3.0`, added playlist-route smoke coverage for saved-order and dialog creation flows, and refreshed release documentation to treat playlists as part of the current baseline instead of future scope.
- Verification: `npx vitest run src/App.test.tsx` passed with the playlist smoke suite and `npm run build` passed for the `v1.3.0` client bundle.
- Files touched:
  - `client/src/App.test.tsx`
  - `client/src/desktop.ts`
  - `client/package.json`
  - `client/package-lock.json`
  - `server/Cargo.toml`
  - `server/tauri.conf.json`
  - `README.md`
  - `docs/architecture.md`
  - `docs/design.md`
  - `docs/roadmap.md`
  - `release-smoke-checklist.md`
- Linked commit/PR: pending
- Notes: this ties the release narrative to the actual shipped playlist feature set instead of leaving playlists described as “next up.”

## 2026-04-03 - Avoided split playback authority between React and the backend runtime
- Status: fixed
- Severity: high
- Symptom: after backend track loading and play/pause landed, the shell still directly owned progress, ended, restart, and playback-error state, which meant UI state could diverge from the Rust runtime during real audio lifecycle events.
- Root cause: the frontend hook still mutated playback status locally from audio callbacks and transport handlers, so the backend event stream was only part of the playback truth instead of the single authority.
- Fix: route timing sync, seeks, completion, and playback errors through backend commands, keep `playback://state-changed` as the only playback snapshot ingress into the shell, and reduce the audio element to a renderer/controller that follows backend state.
- Verification: `cargo test` passes with the expanded playback command surface, and `npm test` passes with bridge and shell coverage for timing sync, restart seeking, and backend-owned playback updates.
- Files touched:
  - `server/src/commands.rs`
  - `server/src/lib.rs`
  - `client/src/desktop.ts`
  - `client/src/desktop.test.ts`
  - `client/src/hooks/useAppShell.ts`
  - `client/src/App.test.tsx`
  - `docs/design.md`
- Linked commit/PR: pending
- Notes: React no longer decides playback truth on its own, even though the shell still renders the playback chrome and dispatches user intent.

## 2026-04-03 - Avoided shell playback drift by emitting backend playback snapshots through Tauri events
- Status: fixed
- Severity: high
- Symptom: after playback ownership started moving into Rust, the shell still risked drifting because track-load and transport UI updates depended on local promise timing and ad hoc frontend state merges rather than on one backend-owned playback stream.
- Root cause: the backend runtime could load tracks and flip play/pause state, but it did not yet broadcast committed playback snapshots back to the client, so React still had to infer state transitions from command responses and local audio behavior.
- Fix: emit `playback://state-changed` from Tauri whenever backend playback state changes and subscribe to that event in the client shell so backend-owned playback snapshots can flow into React state directly.
- Verification: `cargo test` passes with the playback runtime and command layer changes, and `npm test` passes with desktop bridge and shell coverage for backend playback event subscription.
- Files touched:
  - `server/src/playback/mod.rs`
  - `server/src/commands.rs`
  - `client/src/desktop.ts`
  - `client/src/desktop.test.ts`
  - `client/src/hooks/useAppShell.ts`
  - `client/src/App.test.tsx`
  - `docs/design.md`
- Linked commit/PR: pending
- Notes: this was the event-driven handoff that made the later native local-output path possible without changing the shell contract.

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

## 2026-03-30 - Avoided missing MP3 duration values when files omit ID3 duration metadata
- Status: fixed
- Severity: medium
- Symptom: some indexed tracks show `--:--` in the library table even though macOS and other media tools display a valid duration for the same files.
- Root cause: the original scan pipeline read duration from `id3::Tag::duration()` only, and many MP3 files do not store track length in the ID3 metadata even when the duration can be computed from the audio stream itself.
- Fix: added MP3 frame parsing as a fallback duration path so indexed tracks can still store `duration_seconds` when the ID3 tag omits track length.
- Verification: `cargo test` now covers normalization with fake MP3 frame data, and `cargo check` passes with the upgraded ingest path compiled into the scanner.
- Files touched:
  - `server/src/library/normalization.rs`
  - `server/src/library/tests.rs`
- Linked commit/PR: pending
- Notes: this keeps duration fidelity closer to what system media tools already show without requiring a heavyweight decoder stack in the first local-ingest release.

## 2026-03-30 - Avoided missing embedded artwork during local scan
- Status: fixed
- Severity: low
- Symptom: tracks with visible cover art in system media tools still appear without artwork in `resona`.
- Root cause: the original library ingest pipeline did not extract or persist embedded artwork from MP3 metadata, so `artwork_key` stayed unset during track upsert.
- Fix: added embedded artwork extraction from ID3 picture frames, persisted artwork assets into app-local storage, and carried `artwork_key` through the normalized track write path.
- Verification: `cargo test` now covers artwork extraction and persisted artwork files, and `cargo check` passes with artwork-sync logic in the scan pipeline.
- Files touched:
  - `server/src/library/scanner.rs`
  - `server/src/library/normalization.rs`
  - `server/src/library/models.rs`
  - `server/src/library/query.rs`
  - `server/src/library/tests.rs`
- Linked commit/PR: pending
- Notes: the client still needs a follow-up slice to render artwork in the tracks and playback UI, but the ingest and persistence side is no longer the blocker.

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

## 2026-03-30 - Avoided silent folder-picker failure from missing dialog capability wiring
- Status: fixed
- Severity: medium
- Symptom: the `choose folder` action appeared dead in settings because the Tauri dialog plugin was registered, but the main window did not have the capability permission needed to open the native directory picker.
- Root cause: the frontend picker call was valid, but the app had no explicit `dialog:allow-open` capability bound to the active window label, and the client also swallowed picker errors in a way that made the failure look like a no-op.
- Fix: added a default Tauri capability for the `main` window with `dialog:allow-open`, aligned the window label in the Tauri config, and stopped suppressing picker errors silently.
- Verification: `npm test`, `npm run build`, and `cargo check` all pass after the capability and client error-handling changes, and the directory picker can be retried through the settings route after a full desktop restart.
- Files touched:
  - `server/capabilities/default.json`
  - `server/tauri.conf.json`
  - `client/src/desktop.ts`
  - `client/src/hooks/useAppShell.ts`
- Linked commit/PR: pending
- Notes: canceling the picker is now treated as a quiet no-op rather than as a noisy status update, which better matches desktop utility expectations.

## 2026-03-30 - Avoided stale playback and library-view races from overlapping async client requests
- Status: fixed
- Severity: high
- Symptom: quickly changing tracks or firing multiple search/sort refreshes could let an older async response overwrite the newest UI state, leading to the wrong track source loading or stale query results replacing the latest library view.
- Root cause: the client accepted `resolveTrackPlaybackSource` and `fetchAllTracks` responses without guarding them against newer requests that had started afterward.
- Fix: added request-id guards for both playback source resolution and library refreshes so only the latest in-flight response can mutate shell playback state or the visible tracks view.
- Verification: `npm test` covers rapid track selection and overlapping search refreshes, and `npm run build` passes with the guarded hook logic compiled.
- Files touched:
  - `client/src/hooks/useAppShell.ts`
  - `client/src/App.test.tsx`
- Linked commit/PR: pending
- Notes: this is the kind of release-quality bug that often hides behind “works on my machine” manual testing until people click faster than the happy path assumed.

## 2026-03-30 - Avoided queue drift when search changed the visible tracks table during playback
- Status: fixed
- Severity: high
- Symptom: after playback started, filtering the tracks route through search could mutate the queue view while transport navigation still relied on the changing visible list, causing `next` behavior to feel wrong or inconsistent with what the queue suggested.
- Root cause: queue derivation and `previous`/`next` navigation were coupled to `tracksState.items`, which is the filtered route dataset rather than a stable playback-order snapshot.
- Fix: separated playback queue ownership from the visible tracks table by snapshotting queue order at track selection time, keeping a track catalog by id, and deriving queue/transport behavior from that stable playback order instead of the filtered route state.
- Verification: `npm test` now covers queue stability after search filtering, and `npm run build` passes with the queue-state refactor in place.
- Files touched:
  - `client/src/hooks/useAppShell.ts`
  - `client/src/App.test.tsx`
- Linked commit/PR: pending
- Notes: the tracks route can now keep behaving like a searchable library surface without mutating what the player means by “next up” mid-session.
