# resona

resona is a lightweight, local-first desktop music system built for fast playback and large private libraries. It combines a React user interface, a Tauri desktop shell, a Rust core, and SQLite-backed metadata to keep local playback responsive while the app stays compact and utility-focused.

## Product Goal

Build a private, performance-first music player that feels closer to a system utility than a streaming platform. The public v1 focus is dependable local playback, folder-based library import, deterministic queueing, and a dense desktop shell. Atlas and timbre remain follow-up releases rather than part of the first public tag.

## MVP Scope

- Select a local music folder through the desktop app instead of entering raw filesystem paths
- Recursively discover MP3 files in the selected folder and nested subfolders
- Index FLAC alongside MP3 in the same local-first library flow
- Persist track metadata in SQLite
- Browse large libraries in a scrollable tracks table with search and header-driven sorting
- Search tracks quickly without loading the full library into React state as one giant boot payload
- Play indexed local tracks with persistent transport controls and progress sync
- Manage queue, play/pause, previous, next, and restart-on-previous behavior
- Render embedded artwork across the library table, queue page, and playback bar
- Surface trusted advisory metadata and privacy-safe Discord Rich Presence
- Create, artwork, reorder, and play back first-class local playlists with persisted ordering
- Keep playback queue behavior stable even when the tracks route is filtered by search

## Non-Goals

- Feed-based discovery or recommendation interfaces
- Social features, sharing, or collaborative playlists
- Gapless playback, crossfade, or equalizer support in V1
- Heavy visualizations or animation-driven UI
- Full streaming-service style cloud product behavior

## User Segments

- Listeners with large local libraries who want a fast desktop player
- Technical users who want local control without streaming-platform clutter
- Builders interested in a clean open-source desktop music stack

## Core Principles

- Local-first
- Predictable performance at 10k+ tracks
- Minimal React state and rendering overhead
- Clear, utility-first interface over entertainment-platform patterns
- Open-source core with private user-controlled media storage
- Defer non-essential complexity until the local-first playback workflow is solid

## Planned Architecture

```text
[ React UI ]
     ↓
[ Tauri Bridge ]
     ↓
[ Rust Core ]
 ├── Library Engine
 ├── Source Providers
 ├── Cache Manager
 ├── Playback Engine
 ├── Analysis Engine (timbre)
 └── Database Layer
```

## Repository Layout

```text
.
├── client/              # React + Vite desktop UI
├── server/              # Rust core, Tauri integration, data services
├── docs/
│   ├── architecture.md
│   ├── roadmap.md
│   ├── design.md
│   └── bug-log.md
├── .gitignore
└── README.md
```

## Technical Direction

- Frontend: React with TypeScript and Vite
- Desktop shell: Tauri
- Core engine: Rust
- Database: SQLite
- Audio path: Rust-owned playback state and native local output, with the React shell acting as renderer/controller for transport and queue surfaces
- Remote storage: Atlas integration deferred until a later release
- Analysis engine: `timbre` integration deferred until a later release

## Frontend Foundation

- The desktop client uses `react-router-dom` for a persistent shell with `home`, `tracks`, `playlists`, `queue`, and `settings` routes
- The left sidebar and bottom playback bar stay mounted across route changes
- `App.tsx` now acts as route composition, building grouped `chrome`, `routes`, `actions`, and playback props for `AppShell` and `AppShellRoutes`
- `useAppShell` is now a thin composition hook over `useShellQueryState` and `usePlaybackCoordinator` instead of one growing all-purpose shell hook
- Query/bootstrap responsibilities are split into `hooks/shell/` modules and playback responsibilities are split into `hooks/playback/` modules
- Release polish includes app-owned desktop chrome plus Lucide-based navigation and transport icons
- The `tracks` route uses an inline search field, header-driven sorting, and a scrollable library table inside the persistent shell

## Current Playback Baseline

- Selecting a track from the library now drives the active playback state in the persistent bottom bar
- Local indexed MP3 files now play through a Rust-native output path behind the existing playback runtime
- Transport controls now handle play, pause, previous, next, restart-on-previous, seek, and backend-driven progress updates
- The queue route reflects a stable next-up flow derived from playback order rather than the currently filtered tracks table

## Current Playlist Baseline

- Local playlists are now persisted in SQLite instead of being treated like a temporary saved filter
- Playlist entry identity is separate from track identity, so duplicate tracks can be intentionally preserved as distinct saved-order rows
- Playlist pages now support dialog-based creation, custom cover artwork, handle-only drag reorder, entry removal, and queue handoff from either the full playlist or a chosen row
- Saved-order rows now support selection, keyboard removal, double-click playback from the playlist's own ordering context, and explicit before-or-after drop markers while reordering
- Queue handoff stays snapshot-based: changing saved playlist order later does not silently rewrite an already active playback queue

## Current Albums and Artists Baseline

- Added first-class album and artist browse and detail flows so the library can surface grouped releases and performer views beyond track lists.
- Implemented backend aggregation queries and command wiring to shape album and artist metadata consistently.
- Wired album and artist interactions into the existing shell navigation and playback flows, keeping the broader desktop experience unchanged.

## Current Concept Albums Baseline

- Added first-class concept album flows to support editable release-style projects alongside locked albums and freeform playlists.
- Implemented concept album storage, detail hydration, and ordered-entry shaping by reusing proven playlist mutation patterns and album-style presentation contracts.
- Wired concept album creation, editing, reordering, and playback handoff behavior through the existing shell and queue flows.

## Current Mixtapes Baseline

- Introduced a "Turn to mixtape" flow that allows users to permanently lock a playlist's contents and sequence.
- Extended the existing playlist model to support a locked mixtape state, reusing the established playlist UI and backend primitives.
- Updated the frontend to disable adding new tracks, reordering, or editing once a playlist is converted into a mixtape.
- Replaced individual track artwork placeholders in the mixtape view with the mixtape's cover image for a unified aesthetic.

## Current Queue Baseline

- Queue authority has moved fully into Rust through a segmented two-tier model: an explicit user queue backed by a `VecDeque<TrackId>` and a zero-copy cursor over the active playlist or album context window.
- `resolve_next()` is the single dispatch point: it drains the user queue first (O(1) `pop_front`), advances the context cursor second (O(1) index increment), and only falls through to auto-continue when both tiers are exhausted.
- "Play next" maps to `push_front` and "add to queue" maps to `push_back` on the `VecDeque`, both O(1) without the shifting cost of a plain `Vec`.
- Auto-continue resolves by walking the last-played artist's discography in release order, filtering already-played tracks with an O(1) `HashSet` lookup, then falling back to a recency-weighted library shuffle when the artist catalogue is exhausted.
- The `playback://queue-changed` event contract and `PlaybackQueueSnapshot` payload shape remain stable; only the internal resolution strategy changed.

## Current Collection UI Baseline

- All collection detail views (Playlists, Mixtapes, Albums, Concept Albums) are unified under a premium, edge-to-edge AMOLED black aesthetic.
- Headers use consistent typography scaling, larger artwork dimensions, and a seamless gradient fade `from-white/[0.07] to-transparent`.
- Tracklist sequences are borderless, using a shared grid layout with hover-state interactions (e.g., track numbers swapping to play buttons, drag handles appearing on hover) to minimize visual noise.
- Explicit/advisory metadata badges are standardized into a minimalist, borderless square design.

## Current Playback Contract

The playback boundary is implemented in code rather than only described as a roadmap note.

- Rust now owns the playback runtime for loaded-track identity, transport state, progress, seek, completion, and output ownership
- The command surface centers on `load_playback_track`, `playback_action`, `seek_playback`, `sync_playback_timing`, `complete_playback`, and `report_playback_error`
- The event surface centers on `playback://state-changed` and `playback://queue-changed`
- The frontend shell now acts as a renderer/controller for playback state rather than the system of record

Current frontend bridge layout:

- `client/src/desktop.ts` is a compatibility barrel that re-exports the bridge surface
- `client/src/desktop/types.ts` holds shared payload and contract types
- `client/src/desktop/runtime.ts` holds runtime detection, invoke helpers, and payload normalizers
- `client/src/desktop/shell.ts` owns bootstrap and shell-state bridge calls
- `client/src/desktop/playback.ts` owns playback commands, playback event subscription, and playback contract helpers
- `client/src/desktop/playlists.ts` owns playlist CRUD, entry ordering, and playlist-to-queue handoff
- `client/src/desktop/library.ts` owns library query/scan calls, asset resolution, and native picker helpers

Current frontend shell layout:

- `client/src/App.tsx` maps shell state into route-facing and chrome-facing view models
- `client/src/components/layout/AppShell.tsx` owns the persistent frame and playback chrome wiring
- `client/src/components/layout/AppShellRoutes.tsx` owns the route table for `home`, `tracks`, `playlists`, `queue`, and `settings`
- `client/src/hooks/useAppShell.ts` composes query/bootstrap state with playback coordination
- `client/src/hooks/useShellQueryState.ts` owns bootstrap, shell refresh, library scan, track queries, and playlist queries
- `client/src/hooks/usePlaybackCoordinator.ts` composes the playback runtime bridge, media runtime, queue sync, and auto-advance helpers
- `client/src/hooks/shell/` and `client/src/hooks/playback/` hold the focused units extracted from the earlier larger hooks

Current implementation status:

- Rust owns local-file playback output for desktop playback and emits playback snapshots back into the shell
- `get_shell_state` reflects backend playback snapshots instead of only hard-coded idle defaults
- The shell renders transport, timing, and completion state from backend snapshots and events rather than frontend media lifecycle callbacks
- Frontend coverage is split across bridge tests, page tests, and the app desktop harness rather than one oversized `App.test.tsx`
- Native playback smoke coverage exercises launch, play, seek, pause, and completion across backend and shell tests

## Native Output Direction

Native output moved into Rust without changing the visible shell contract.

Chosen stack:

- `rodio` for the current local native output path behind the playback runtime
- `symphonia` and `cpal` remain the intended lower-level stack for a deeper dedicated output layer
- a runtime-owned output path in Rust rather than a browser `Audio` element

Why this direction:

- the current Tauri command/event contract stays stable while the output engine behind it changes
- keeping playback authority in Rust makes desktop behavior more deterministic and keeps future native clients closer to the same playback core
- local-file-first scope keeps the migration focused before Atlas/cache complexity is layered on top

Constraints recorded up front:

- scope native output to local-file playback first; do not mix remote streaming into the output milestone
- preserve the React playback UI so custom transport, progress, queue, and artwork surfaces stay fully app-defined
- keep queue and playback-state authority in Rust; the shell should only render snapshots and dispatch intent
- benchmark memory and playback behavior separately instead of assuming native output is automatically lighter
- defer gapless playback, EQ, DSP, and advanced output-device UX until after native output is stable

Current result:

- the shell no longer owns active audio execution for local desktop playback
- playback lifecycle behavior is more deterministic on desktop because timing, seek, completion, and error state now round-trip through the backend contract
- future native clients should be able to reuse more playback behavior without moving authority back into the UI

## MVP Subsystems

### Library Engine

Indexes local files from a user-selected directory, scans nested folders for supported audio content, normalizes track records, and exposes searchable/sortable library queries.

The current ingest baseline now goes beyond tag-only metadata:
- Track duration falls back to MP3 frame parsing when ID3 duration is missing
- If frame-based timing is incomplete, duration can still fall back to bitrate-and-size estimation for rough but usable timing
- Embedded album art is extracted during scan and persisted into local app data for later UI use
- Track rows also fall back more gracefully when tags are sparse by cleaning file-stem titles and using album-artist / parent-folder metadata when available
- The tracks table now renders artwork tiles for indexed items, and the queue view now shows larger cover art for the active track

### FLAC Compatibility

The current release includes mixed MP3 + FLAC local-library support without widening product scope beyond local desktop playback.

Compatibility goals:
- allow recursive scan and indexing of `.flac` files alongside `.mp3`
- preserve the current track model, query contract, queue behavior, and playback shell
- treat FLAC as another local source format, not as a new source-provider type
- keep the shell format-agnostic so track rows, queue state, and playback controls do not branch on codec-specific UI

Metadata and ingest rules:
- continue using the current normalization shape so MP3 and FLAC tracks land in the same library/query surfaces
- keep title, artist, album, duration, artwork, relative path, and extension as the minimum compatibility baseline
- prefer embedded metadata and artwork when present, while keeping filename and folder fallbacks for sparse tags
- record the real file extension so later mixed-format duplicate handling remains possible

Playback rules:
- native desktop playback should accept FLAC anywhere the runtime already accepts indexed local MP3 tracks
- source resolution should remain `local -> cache -> remote`, with FLAC entering only through the local path
- transport, seek, completion, queue progression, and snapshot events should behave the same regardless of MP3 or FLAC source format

Out of scope:
- remote FLAC streaming
- format-specific transcoding
- ReplayGain, cue sheets, gapless-album logic, or audiophile device UX
- duplicate-resolution UI between MP3 and FLAC copies of the same release

### Privacy-Safe Presence

The current release includes a privacy-safe desktop Discord Rich Presence slice without turning `resona` into a social product or leaking library details from a private local-first app.

Presence goals:
- publish lightweight now-playing state to Discord while desktop playback is active
- keep the playback runtime as the only source of truth for externally published playback identity
- use a maintained Discord RPC client library rather than hand-rolled IPC framing and socket lifecycle code
- keep the first presence slice desktop-only and playback-only rather than a general account or social integration

Allowed payload shape:
- a generic app-facing activity line such as `Playing with resona`
- artist metadata from trusted track tags
- coarse playback session timing when needed to make the presence feel alive

Explicitly out of bounds for the first presence slice:
- local file paths
- folder names
- album titles
- artwork keys or local artwork assets
- library-root names
- queue contents or upcoming tracks
- lyrics, analysis output, or other secondary metadata
- Discord user-id-specific logic, account linking, or OAuth flows

Local setup for the first desktop presence pass:
- set `RESONA_DISCORD_CLIENT_ID` in a local `.env` or launch shell before starting the Tauri app
- keep Discord desktop running with activity status enabled
- use a track that already has trusted artist metadata, because artist is the only listening identity exposed in the first slice
- do not use a Discord client secret; the first presence pass only needs the public application client id

### Trusted Advisory Metadata

The current release includes explicit/advisory metadata as a narrow metadata-normalization feature, not as a new recommendation, lyrics, or content-analysis subsystem.

Trusted sources for the first advisory slice:
- local source tags that explicitly mark a track as advisory or parental-warning content
- imported provider metadata later, when that provider already exposes an explicit/advisory field directly
- normalized truth should prefer source-declared advisory values over UI guesses or inferred text patterns

Fallback rules:
- if a trusted source marks the track advisory, preserve and surface that value
- if trusted metadata is absent, keep the advisory state unknown/empty rather than defaulting to clean or explicit
- do not infer explicitness from lyrics, filenames, folder names, genres, or punctuation heuristics
- do not let advisory metadata participate in track identity, duplicate resolution, or playback routing

UI contract for the first slice:
- advisory state should surface as a small badge near track identity, not as a new primary navigation mode
- absence of an advisory badge should mean metadata was unavailable or neutral, not that `resona` proved the track is clean

Out of scope:
- lyric scanning or text classification
- moderation-style content scoring
- parental-control policy engines
- advisory-driven auto-skip, mute, or queue filtering rules

## Engineering Notes

The local-library scanner is one of the main systems-oriented pieces in the MVP. It is intentionally designed to show more than basic CRUD work:

- Recursive traversal uses an explicit stack and visited-set rather than naive recursive calls, which keeps control flow predictable and avoids duplicate directory work.
- Track reconciliation uses a hash map keyed by relative path, so rescan diffing runs in near-linear time instead of degenerating into repeated nested comparisons.
- Scan results are sorted deterministically before normalization and persistence, which keeps output stable for testing and debugging.
- SQLite writes run inside a transaction so insert, update, cache-state initialization, and analysis-state initialization happen as one consistent batch.
- Library browsing uses indexed sort paths, while the client stitches backend query pages together into one continuous scrollable library view.

In portfolio terms, the flex is not just "it scans folders." The interesting part is the combination of traversal strategy, normalization, stable ID generation, diff-based persistence, and bounded growth characteristics when the library gets large.

### Source Providers

Supports `LocalSource` for filesystem access today and leaves room for a future `AtlasSource` retrieval path in a later release.

### Cache Manager

Planned for later: warm cache, temporary buffers, and promotion from streamed content into ready local cache with version-aware invalidation.

### Playback Engine

Current v1 playback chooses the local indexed file path. Later branches can extend that path priority to:

1. Local file
2. Cached file
3. Remote fetch to temporary buffer, then playback

The current implementation baseline supports direct local playback for indexed MP3 files through the desktop client, with the next-up queue derived from the currently active library selection.

The next patch-release compatibility target is mixed-format local playback:

- MP3 remains the baseline path
- FLAC should enter through the same local indexed source-resolution flow
- queue and playback snapshots should remain format-agnostic at the shell boundary

The current playback contract narrows the migration boundary further:

- Rust becomes the owner of transport, progress snapshots, completion state, output ownership, and source authority
- Tauri commands mutate playback state while Tauri events broadcast committed playback snapshots back to the shell
- The source order stays `local -> cache -> remote`, so future cache and Atlas work can reuse the same command/event boundary

Current implementation slice:

- `load_playback_track` resolves an indexed local track into backend playback state and hands local playback off to the Rust runtime
- `playback_action` toggles backend play/pause state instead of returning a fixed placeholder message
- `seek_playback`, completion updates, and playback snapshots keep the shell aligned to backend-owned transport state

### Analysis Engine

Planned for later: asynchronous timbre profiling through an integrated `timbre` engine to extract BPM, energy, spectral, tonal, dynamic, and custom flow features while keeping CPU use constrained.

## Performance Targets

| State | RAM | CPU |
| --- | --- | --- |
| Idle | 30-80 MB | ~0% |
| Playing local track | Minimal increase | 1-3% |
| Streaming remote track | Slight increase | 2-5% |

## Open Source Position

resona is intended to remain open source as an application and systems project. Future Atlas integration is a storage adapter for user-controlled media, not a closed platform dependency, and future `timbre` analysis work should be integrated in a way that preserves a clear open-source development model.

## Initial Development Slices

1. Establish architecture docs and fixed repository layout
2. Scaffold the Tauri, Rust, and React application shells
3. Implement SQLite schema, indexing pipeline, and library queries
4. Add playback controls, queue management, and cache lifecycle
5. Introduce background timbre analysis and track insight surfaces

## Verification Expectations

Each implementation slice should include:

- Updated docs when scope or architecture changes
- Build, lint, type, and test checks relevant to the slice
- A short risk summary and the exact verification commands used
- GitHub Actions coverage for the release-critical frontend and backend paths

Current frontend verification includes:

- `npm test` for client bridge and route/shell smoke checks
- `npm run build` for Vite production build validation including Tailwind integration

Current release CI includes:

- GitHub Actions frontend checks on Ubuntu for `npm test` and `npm run build`
- GitHub Actions backend checks on macOS for `cargo test` and `cargo check`
- GitHub Actions tag builds for unsigned macOS `.dmg` artifacts via `.github/workflows/release-macos-dmg.yml`

Current playback smoke coverage includes:

- backend tests for load, play, seek, pause, and completion against the Rust playback runtime
- frontend shell smoke checks that render backend-owned playback snapshots and transport transitions

Current packaging baseline includes:

- Tauri bundle metadata for app name, description, category, and icon paths
- Release-oriented desktop packaging configuration enabled in `server/tauri.conf.json`
