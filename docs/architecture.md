# resona architecture

## Overview

resona is a local-first desktop music system optimized for predictable playback latency, low memory pressure, and clear separation between UI concerns and core media logic. The public v1 architecture is intentionally centered on local library import, local playback, and stable desktop shell behavior. Atlas and timbre are future extensions, not part of the current release-critical path.

## Goals

- Keep playback responsive for local tracks in the public v1 release
- Support large libraries without storing the full catalog in the initial React boot payload
- Persist operational state and metadata in SQLite
- Leave clean extension points for future analysis and remote-source work
- Keep the application architecture open source and portable

## System Context

```text
React UI
  -> Tauri commands and events
  -> Rust core services
  -> SQLite metadata store
  -> Local filesystem
```

## Top-Level Components

### client

The desktop UI provides library navigation, playlist management, queue control, playback controls, and lightweight insight views. It should remain table-oriented and intentionally minimal, with event-driven updates instead of global library hydration.

Current frontend structure:

- `components/layout`: persistent shell elements such as the frame, sidebar, route outlet, and playback bar
- `components/ui`: generic state screens and smaller UI-only pieces
- `pages`: route-owned screens such as home, tracks, playlists, queue, and settings
- `hooks/useAppShell.ts`: top-level composition hook for query/bootstrap state plus playback coordination
- `hooks/useShellQueryState.ts` with `hooks/shell/`: bootstrap, scan, track-query, and playlist-query ownership
- `hooks/usePlaybackCoordinator.ts` with `hooks/playback/`: runtime bridge, media runtime, queue sync, selectors, and auto-advance ownership
- `test/appDesktopHarness.tsx` and route/bridge test files: modular frontend smoke coverage
- `types`, `constants`, `utils`: shared client-side contracts and helpers

### server

The Rust side owns media orchestration, metadata ingestion, source resolution, cache policy, playback state, and background analysis scheduling. Tauri exposes narrow command and event boundaries to the UI.

## Rust Module Boundaries

The current Rust structure is organized around service ownership rather than around one large application module.

### `commands`

- Owns the Tauri command boundary and command payload shapes
- Translates UI-facing inputs into calls on library and database-backed services
- Keeps desktop-shell state shaping separate from persistence and indexing logic

### `playback`

- Owns the Rust-side playback contract for the current desktop player
- Defines the command surface that mutates backend playback state
- Defines the event surface that broadcasts playback and queue snapshots back to the frontend shell
- Keeps playback ownership decisions explicit at the shell boundary
- Owns the in-memory playback runtime for loaded-track and play/pause authority
- Owns the current native local-output path, with `symphonia` and `cpal` still planned as the deeper decode/device stack

Current submodules:

- `mod`: playback contract types plus feature-facing exports
- `state`: playback runtime state, snapshot shaping, queue state, and load-track ownership
- `controls`: transport mutations, seek/completion/error handling, and native-output lifecycle control
- `transport`: Tauri playback-event emission and the current native playback worker loop
- `queue`: segmented two-tier queue model, `PlaybackQueueSnapshot` payloads, and queue event emission

### `playlists` (including Concept Albums and Mixtapes)

- Owns the local playlist design contract for the current desktop player, including extended collection types like Concept Albums and Mixtapes
- Defines playlist persistence shape, ordering rules, duplicate-entry behavior, and queue handoff semantics before CRUD/UI work lands
- For Concept Albums: supports editable release-style project states while reusing playlist mutation patterns
- For Mixtapes: implements the conversion contract and locked-state rules that prevent new additions and reordering once a playlist is converted to a mixtape
- Keeps playlist identity separate from playback queue identity so saved playlists and transient playback state do not collapse into one model

Current submodules:

- `mod`: playlist store shell plus public exports
- `contract`: playlist design contract and command guarantees
- `metadata`: playlist CRUD and metadata normalization
- `entries`: ordered-entry mutation, replacement, and queue handoff behavior
- `queries`: shared SQLite reads, validation, id generation, and reorder helpers
- `artwork`: playlist artwork import and cleanup
- `types`: playlist-domain payloads and error types

### `library` (including Albums and Artists)

- Owns local filesystem scan orchestration and normalized track ingestion
- Owns query shaping for search, sort validation, and backend pagination/cursor handling
- Owns album and artist aggregation queries for listing and detail hydration
- Keeps metadata normalization and library-domain models close to the scan/query flows that use them
- Scan pipeline absorbs matching Spotify ghost plays into `play_events` automatically when a new track is inserted, so historical Spotify listens are promoted to real play events as soon as the corresponding local file is discovered

Current submodules:

- `scanner/mod`: scan orchestration, library summary reads, library queries, and playback/artwork source resolution
- `scanner/persistence`: transactional reconciliation, upserts, artwork syncing, and persisted scan summaries
- `normalization/mod`: track normalization flow and normalized-track assembly
- `normalization/helpers`: file discovery, label cleanup, artwork-key generation, and stable identifiers
- `normalization/metadata`: MP3/FLAC metadata parsing, advisory extraction, and duration/artwork decoding
- `query/mod`: count/query helpers, cursor encoding, sort helpers, and query tests
- `query/sql`: SQL generation for search, cursor, and stable ordering clauses
- `models`: library-domain payloads, query inputs, and scan errors

### `analytics`

- Owns play history queries and aggregation logic over `play_events` and `spotify_ghost_plays`
- Exposes source-aware window filtering: 4-week windows restrict to `source = 'local'`; 6-month and all-time windows include Spotify import history
- Aggregates top tracks, top albums, and top artists by splitting multi-artist strings (comma, feat., ft., featuring) before grouping
- Keeps no mutable state; all queries execute against the live SQLite connection

Current submodules:

- `queries`: `get_top_tracks`, `get_top_artists`, `get_track_play_stats` with `AnalyticsWindow` enum and `is_local_only()` guard

### `database`

- Owns SQLite runtime setup, connection policy, and migration application
- Keeps schema constants and persisted-state enums separate from boot/runtime concerns
- Serves as the infrastructure layer consumed by library services rather than by the UI directly
- 14 migrations applied in order; migrations 0013–0014 add `play_events.source`, `play_events.ms_played`, and the `spotify_ghost_plays` table

Current submodules:

- `runtime`: database initialization, connection creation, and migration status reporting
- `migration`: ordered migration declaration and application logic
- `schema`: migration SQL includes, table-name constants, and enum-to-SQL value mapping

## Service Ownership

The backend is intentionally split so each layer has a clear responsibility boundary.

### Tauri Command Layer

- Lives in `commands`
- Responsible for command registration, shell payload shaping, and command argument parsing
- Should not absorb indexing algorithms, SQL construction, or filesystem traversal details

### Library Service Layer

- Lives in `library`
- Responsible for local import, metadata normalization, reconciliation, and read/query behavior
- Owns domain decisions like relative-path identity, cursor semantics, and sort-key validation
- Uses narrower internal modules so metadata parsing, scan persistence, and query-shape work can evolve without reopening one oversized file

### Persistence Infrastructure Layer

- Lives in `database`
- Responsible for SQLite lifecycle, migrations, and schema-level contracts
- Should not take on desktop-shell concerns or library-domain orchestration

### Why This Split Matters

- Tauri command code can change with UI needs without destabilizing the scanner and query pipeline
- Library logic can be tested directly without routing every case through a desktop command wrapper
- Database boot and migration logic can evolve independently from library features
- The structure is closer to production service encapsulation and avoids the early-branch `mod.rs` pileup

### Frontend Shell Ownership

- Route orchestration owns page selection and keeps navigation shallow
- Layout components own persistent desktop chrome such as sidebar, top bar, and playback bar
- Page components own route-local content instead of burying the whole client in one top-level file
- The app-shell hook owns bootstrap, query refresh, and scan-trigger state coordination
- The app-shell hook owns derived queue state, bridge subscriptions, and audio-element control flow, but no longer owns playback truth
- The tracks page owns a full-width search field and a scrollable table, while the hook stitches backend query pages into one continuous client view

Current boundary definition:

- `App.tsx` is the route-composition layer that converts shell-hook output into grouped `chrome`, `routes`, `actions`, and playback contracts
- `AppShell` owns the persistent frame, shared layout wiring, and playback chrome, but not the route table itself
- `AppShellRoutes` owns the routed page map and consumes grouped route state plus grouped route actions
- route-level state is grouped by screen (`home`, `tracks`, `playlists`, `queue`, `settings`) so later extractions can move one route at a time
- playback chrome actions stay separate from route actions because the playback bar is persistent shell UI rather than page UI
- route-local transient state such as playlist edit drafts, reorder previews, and in-page filters stays inside page components unless another shell surface needs it
- the older large-hook responsibilities have now been split across focused `hooks/shell/` and `hooks/playback/` modules without changing the visible desktop shell

### Playback Ownership Shift

- The `playback` Rust module is now the source of truth for loaded-track identity, play/pause state, timing updates, completion state, playback errors, and output ownership
- Local desktop playback output now runs through the Rust playback runtime instead of a frontend-owned `Audio` element
- The frontend dispatches user intent and renders backend snapshots through Tauri commands and `playback://state-changed`
- Queue authority now lives fully in Rust through a segmented two-tier model: a `VecDeque<TrackId>` for explicit user-queued tracks (O(1) `push_front` for play-next, O(1) `push_back` for add-to-queue) and a zero-copy cursor over the active playlist or album context window; `resolve_next()` drains the user queue first, advances the context cursor second, and falls through to lazy auto-continue only when both tiers are exhausted
- Auto-continue resolves by walking the last-played artist's discography in release order, filtering already-played tracks with an O(1) `HashSet` lookup, and falling back to a recency-weighted library shuffle when the artist catalogue is exhausted

### Frontend Bridge Layout

- `client/src/desktop.ts` is a stable compatibility surface for callers and tests
- `client/src/desktop/types.ts` contains shared request/response and contract types
- `client/src/desktop/runtime.ts` contains runtime detection, typed invoke helpers, and shared payload normalization
- `client/src/desktop/shell.ts` contains bootstrap and shell-state bridge calls
- `client/src/desktop/playback.ts` contains playback commands, playback event subscription, and playback contract helpers
- `client/src/desktop/playlists.ts` contains playlist CRUD, entry reorder/replacement, and queue handoff helpers
- `client/src/desktop/library.ts` contains library query/scan calls, artwork/playback source resolution, and native file picker helpers
- `client/src/desktop/artists.ts` contains artist profile image directory get/set/pick helpers
- `client/src/desktop/analytics.ts` contains Spotify import commands and Spotify export folder picker

This keeps the public bridge surface stable while letting feature code depend on narrower modules internally.

### Planned Playlist Boundary

- SQLite should store playlist metadata in `playlists` and ordered membership in `playlist_entries`
- Playlist entry identity should be separate from track identity so the same track can appear more than once when the user or a later importer intends it
- Ordering should be determined only by a dense zero-based `position` field within each playlist
- Queue handoff should copy playlist order into the backend playback queue as a snapshot, not create a live mirrored binding between the playlist and active queue
- The first local-only milestone can cascade deleted local tracks out of playlist entries; unmatched import states belong to the later Spotify-import branch instead of this foundation slice

Current playlist implementation:

- playlist summaries and ordered entries persist in SQLite
- playlist artwork is stored alongside other app-local artwork assets
- queue handoff copies playlist order into backend playback state at a moment in time rather than creating a live mirrored binding
- the frontend playlist page supports dialog-driven creation, handle-only drag reorder with explicit drop markers, saved-order playback starts, keyboard removal, and library-to-playlist add flows
- drag reorder commits one explicit full-order replacement payload and later playlist edits do not mutate an already handed-off queue snapshot

### Privacy-Safe Presence Boundary

- Rich Presence should sit downstream of the existing playback snapshot boundary rather than creating a second source of playback truth
- the Rust/runtime contract should decide what playback identity is externally publishable
- the first presence payload should stay intentionally narrow: app identity, trusted artist metadata, and coarse playback session timing only
- presence should use a maintained Discord RPC client library instead of custom raw IPC framing
- presence should never read directly from filesystem paths, library roots, artwork storage, or queue snapshots
- explicit/advisory metadata is a separate follow-up concern and should not be inferred inside the presence path

### Native Output Decision

- Keep the current Tauri playback command and event contract as the public shell boundary
- Use a Rust-native output engine for local desktop playback
- Keep `symphonia` and `cpal` as the intended lower-level decode/output stack for future refinement
- Keep the first native-output milestone local-file only so memory, buffering, and seek behavior can be validated without Atlas/cache complexity layered on top

This is intentionally a backend-engine swap behind an already defined shell contract, not a UI rewrite.

Current implemented boundary:

- Rust owns loaded-track state and play/pause authority through `load_playback_track` and `playback_action`
- Rust also owns timing sync, seek state, completion, playback-error snapshots, and local output execution through `sync_playback_timing`, `seek_playback`, `complete_playback`, and `report_playback_error`
- The shell reflects backend snapshots for active track identity, transport mode, timing, completion, and error state through the playback event stream

### future timbre engine

The analysis subsystem is expected to be fused in from the local `~/dev/timbre` project rather than rebuilt from scratch, but that integration is intentionally deferred until after the public v1 release. resona should wrap that code behind a dedicated internal service boundary so upgrades from the upstream timbre codebase stay manageable.

## Core Services

### Library Engine

- Open a directory picker through Tauri so users never type raw local paths into the app
- Index selected local folders recursively for MP3 files
- Expose searchable and sortable library queries
- Track local library state cleanly enough that future remote and analysis layers can attach without breaking the v1 surface

Current ingest baseline:
- The scanner reads title, artist, album, and other tag metadata from ID3 when present
- Duration falls back to MP3 frame parsing when the ID3 tag does not provide track length
- If frame timing is incomplete, duration can still fall back to bitrate-and-file-size estimation so rows are less likely to show empty timing
- Embedded artwork is extracted from ID3 pictures and persisted into app-local artwork storage
- Sparse tags fall back more gracefully through cleaned filename titles, album-artist fallback, and parent-folder album fallback
- System media tools may still show richer metadata over time, but the current `resona` ingest path now closes the biggest duration and artwork gaps from the earlier MVP scanner

Implemented FLAC compatibility slice:
- expand discovery from MP3-only scanning to mixed MP3 + FLAC local libraries
- keep the normalized track shape unchanged so query, queue, and shell code do not branch on format
- preserve `relative_path` identity and explicit `extension` metadata so later duplicate-resolution work can distinguish MP3 and FLAC variants cleanly
- treat embedded artwork, title, artist, album, and duration as the baseline ingest contract for both formats

Implemented advisory-metadata slice:
- treat explicit/advisory state as optional normalized metadata rather than as a required library identity field
- trust source tags and imported provider metadata when present
- keep absence of an advisory flag neutral instead of guessing from lyrics or filenames
- surface the value as small shell-facing metadata, not as a new source-provider or analysis subsystem
- preserve a three-state model in practice: advisory, non-advisory when explicitly declared, or unknown when metadata is absent
- keep advisory parsing inside metadata normalization rather than inside playback, presence, or query-side heuristics

Planned trusted-source rules:
- local MP3/FLAC ingest should only persist advisory state when the source metadata explicitly provides it
- future remote/provider import should map advisory state only from provider-native explicit fields, not from transformed prose descriptions
- conflicting sources should prefer the track source currently chosen as canonical library metadata rather than trying to merge guesses across files

Planned fallback rules:
- missing advisory metadata should remain unset
- unset advisory metadata should not be converted into a false clean value
- advisory state should never be synthesized from lyrics, filenames, folder names, queue context, or presence payloads

### Scan Pipeline Design

The local import path is deliberately structured as a pipeline rather than a single filesystem pass:

1. Traverse the selected root directory with an explicit stack
2. Filter and collect MP3 files only
3. Normalize metadata into stable internal records
4. Diff discovered tracks against persisted tracks by relative path
5. Upsert changed records and delete stale records in one transaction

That shape matters for both performance and clarity. The traversal is effectively linear in the number of visited filesystem nodes, while the reconciliation step avoids quadratic behavior by using hash-based lookup for existing records.

### Algorithmic Rationale

- Explicit stack + visited-set:
  avoids duplicate traversal work and gives tight control over recursive directory scanning.
- Relative-path hash map for persisted tracks:
  reduces rescan reconciliation from repeated pairwise comparison toward `O(n + m)` lookup behavior, where `n` is discovered files and `m` is persisted files for the root.
- Deterministic ordering:
  sorting discovered paths before normalization makes tests, debugging, and persistence behavior stable across runs.
- Transactional persistence:
  groups track, source, cache, and analysis-row updates into one write boundary so the database never observes a half-applied scan.
- Segmented queue with `VecDeque`:
  the user-explicit queue uses `VecDeque<TrackId>` so play-next (`push_front`) and add-to-queue (`push_back`) are both O(1); a plain `Vec` would pay O(n) shifting on every dequeue. The active playlist context is a zero-copy cursor over an ordered slice rather than a second allocated collection. Auto-continue uses a `HashSet<TrackId>` for O(1) already-played membership checks during the artist-discography walk.

## Growth Characteristics

- Directory traversal grows with the number of visited directories and files rather than with the square of the library size.
- Reconciliation cost is bounded by one pass over discovered files plus one pass over persisted rows for the selected library root.
- The chosen schema stores `relative_path` under a library root instead of using raw absolute paths as the primary identity, which keeps comparison keys compact and UI-safe.
- Cursor pagination remains the backend query primitive, which avoids the linear row-skip cost that deep offset pagination accumulates over time, even though the public v1 UI presents the result as one continuous library surface.
- Indexed query paths let SQLite perform ordered reads close to the stored data instead of forcing the application to load and sort the full library in memory.

### Source Providers

- `LocalSource` resolves filesystem-backed tracks
- `AtlasSource` is reserved for future remote track metadata and streaming access after the local-first v1 release
- Shared interface supports metadata lookup, version validation, and fetch operations

### Cache Manager

- Maintains temporary streaming buffers and reusable local cache
- Planned later: size-bounded LRU eviction
- Planned later: promotion of successful Atlas playback into reusable cache entries
- Planned later: invalidation of stale entries when Atlas versions change

### Playback Engine

- Today resolves the local indexed playback path, with room to expand to cached and remote sources later
- Owns queue state, transport controls, buffering state, and transitions
- Started with a Web Audio-based path and now uses a Rust-owned playback/runtime model for local desktop output while the shell renders output

Current compatibility rules:
- FLAC should enter through the same indexed local source-resolution path as MP3
- playback snapshots, transport commands, seek, completion, and queue behavior should remain codec-agnostic at the shell boundary
- format support should not widen the source-provider model yet; FLAC is still just a local file in this slice
- remote FLAC, transcoding, ReplayGain, and gapless-album features remain out of scope

Current contract:

- Commands:
  `load_playback_track`, `playback_action`, `seek_playback`, `sync_playback_timing`, `complete_playback`, `report_playback_error`, `query_library`, `list_playlists`, and `handoff_playlist_to_queue`
- Events:
  `playback://state-changed` and `playback://queue-changed`
- Playback authority:
  the Rust runtime becomes the system of record for active track identity, queue order, timing, and source selection
- Frontend role:
  render snapshots, submit user intent, and avoid duplicating backend transport truth in local audio state once the migration is complete

Current implementation slice:

- `load_playback_track` resolves a local indexed track and updates backend playback runtime state
- `playback_action` now flips backend play/pause state for an already loaded track instead of returning a static placeholder payload
- `sync_playback_timing`, `seek_playback`, `complete_playback`, and `report_playback_error` update backend playback state without reclaiming playback authority in the shell
- `playback://state-changed` now keeps the shell aligned to backend-owned playback snapshots instead of relying on local promise timing

Current validation slice:

- keep playback state snapshots and intent commands stable so the shell remains a customizable renderer/controller
- validate native output behavior and performance separately before claiming a lightweight-runtime win
- keep future presence integration downstream of playback snapshots so desktop presence updates cannot distort playback authority

Current frontend playback baseline:

- Track selection in the library route sets the active playback item for the shell
- The client resolves persisted local artwork assets through the Tauri bridge for track-list and queue rendering
- Transport controls in the bottom bar drive the same active track state used by the queue route
- Queue order is now held separately from the filtered tracks table so search does not redefine what `next` means
- Progress and duration are rendered from backend playback snapshots

### Analysis Engine

- Deferred until `v2.0.0`: timbre extraction jobs, persisted analysis outputs, and insight surfaces

### Database Layer

- Uses SQLite for metadata, source references, and later analysis outputs
- Avoids large in-memory boot payloads by serving paginated queries that the client can stitch into a continuous browsing view
- Stores operational state needed for deterministic recovery and indexing

### Query Layer Design

Library browsing is handled as a database query problem rather than as an in-memory sorting problem in the UI or Rust service layer.

- Sort keys are validated against a fixed whitelist
- Search runs against normalized title, artist, and album fields
- Ordering uses stable secondary tie-breaks on `id`
- Pagination uses cursors instead of raw offsets, even though the current desktop client presents the result as one continuous scrollable library view

This is the right tradeoff for `resona` because SQLite already provides ordered access through indexes. The application gains more by shaping the query path well than by re-implementing its own tree-based sort layer on top of persisted rows.

## Data Model Direction

### Track

- Stable internal ID
- Display metadata such as title, artist, album, duration, and artwork references
- Source descriptor for local path or Atlas object ID
- Local-to-Atlas identity linkage for mirrored library items
- Version or hash for cache validation
- Analysis status and timestamps

### Cache Entry

- Track ID
- Cache state: none, partial, ready, stale
- Local path references when materialized
- Size, last-accessed time, and version linkage

### Analysis Result

- BPM
- Energy and intensity
- Spectral profile
- Tonal profile
- Dynamic range and flow metrics

## Operational Flows

### Local Import

1. User selects a library folder through a desktop directory picker
2. Rust indexing service walks the selected directory recursively
3. Supported local audio files are discovered in the root and nested subfolders
4. Metadata is parsed and normalized for the local-first library
5. Normalized records are stored in SQLite
6. UI refreshes the scrollable tracks view through Tauri-backed queries

### Library Query Flow

1. UI requests query slices with search text, sort key, direction, and optional cursor
2. Rust validates the sort path against a fixed whitelist
3. SQLite executes the search and sort using the available indexes
4. Results are returned with a stable next-cursor token for the following page
5. The client renders only the requested page instead of hydrating the full library

The current `tracks` route now exposes that contract directly through client-side search, sort, and cursor controls instead of treating the first query page as a static load.

### Frontend Boot Flow

1. The client boots the routed shell and requests bootstrap metadata
2. Shell state and the first tracks page are loaded in parallel
3. The persistent sidebar, top bar, and playback bar render once and remain mounted across route changes
4. Route content swaps between home, tracks, playlists, queue, and settings without rebuilding the full desktop shell

### Frontend Playback Flow

1. A track row selection marks the active local item in shell state
2. The frontend requests `load_playback_track` through `client/src/desktop/playback.ts`
3. Rust resolves the source, updates playback ownership, and starts local output inside the playback runtime
4. Rust emits `playback://state-changed` on transport, timing, and completion transitions
5. The shell playback bar and queue route render the same backend-owned snapshots
6. Previous and next transport actions derive their behavior from the currently loaded local track order

### Playback Resolution

1. The user selects a track in the library table
2. Rust resolves the indexed local file path through the Tauri bridge and playback runtime
3. The native playback runtime starts local output and emits updated playback snapshots
4. Queue state and transport controls continue from the playback-order snapshot rather than from the current filtered table

### Spotify Import Flow

1. User selects a Spotify GDPR export folder through a native directory picker
2. The importer discovers all `Streaming_History_Audio_*.json` files in the selected folder
3. Each file is parsed with a streaming `BufReader` to avoid loading the full export into memory
4. Each play entry is matched to a local library track by normalized title and artist (parenthetical removal, feat. splitting, lowercased)
5. Matched plays are written directly into `play_events` with `source = 'spotify-import'` and the Spotify-provided `ms_played` value
6. Unmatched plays are stored as ghost plays in `spotify_ghost_plays` keyed by FNV-1a 64-bit hash of normalized title + artist + played_at
7. When the library scanner later inserts a new track, `absorb_ghost_plays` is called inside the same transaction; matching ghosts are promoted to `play_events` and removed from `spotify_ghost_plays`

### Future Analysis

1. Newly indexed or newly fetched tracks can be queued for analysis
2. The fused `timbre` service can process tracks opportunistically
3. Results should be persisted without mutating playback-critical state
4. UI surfaces can opt into insights when available

## Performance Constraints

- No full-library React state
- No continuous rescanning loops
- Minimal GPU-heavy effects or transparency stacks
- Event-driven updates over polling where possible
- Background analysis must be throttled and interruptible
- The fused `timbre` integration must not force resona into a closed or tightly coupled release model

## Risks

- Native output behavior still needs dedicated performance and device-compatibility validation before stronger claims are made
- Atlas integration details still need concrete endpoint contracts for object identity, streaming, and version sync
- The integration surface with `~/dev/timbre` needs a clear boundary to avoid code drift
- Recursive directory scanning needs careful filtering so non-audio files and permission failures do not degrade import reliability
- Artwork, metadata edge cases, and corrupted files can complicate indexing behavior

## Implementation Notes

The public v1 implementation should prioritize a dependable local-first player before layering on remote storage, cache policy, and analysis depth. The key architectural decision after the earliest frontend-owned playback slice was the move into a Rust-owned playback service, followed by the later Atlas and `timbre` integration boundaries.

The current Rust backend now reflects that direction more closely:

- `commands` owns the Tauri-facing application boundary
- `library` owns scan, normalization, and query services
- `database` owns runtime setup, migrations, and schema contracts
- `playback` now defines the backend playback command and event contract for the shipped desktop player
- backend subsystem tests now live in focused `tests/` directories when the coverage surface grows past a single `tests.rs`

That separation is still early and can deepen further with repositories, playback services, and analysis services, but the code is no longer relying on one catch-all module per subsystem.

The frontend now follows the same direction: a routed shell, separated layout components, route-owned pages, and a dedicated hook for boot/query/scan coordination instead of one monolithic client entry file.

The playback-core branch established a working frontend-owned playback baseline. The current implementation now moves loaded-track, play/pause, timing, completion, and local output authority behind a backend runtime while keeping the same shell surface. The next step is to harden queue authority and native-output validation without regressing the current shell contract.
