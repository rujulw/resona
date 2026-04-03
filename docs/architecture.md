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

The desktop UI provides library navigation, search, queue control, playback controls, and lightweight insight views. It should remain table-oriented and intentionally minimal, with event-driven updates instead of global library hydration.

Current frontend structure:

- `components/layout`: persistent shell elements such as sidebar, top bar, and playback bar
- `components/ui`: generic state screens and smaller UI-only pieces
- `pages`: route-owned screens such as home, tracks, queue, and settings
- `hooks`: app boot and shell state orchestration
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

- Owns the Rust-side playback contract for the `v1.1.0` migration
- Defines the command surface that will mutate backend playback state
- Defines the event surface that will broadcast playback and queue snapshots back to the frontend shell
- Keeps playback ownership decisions explicit before the runtime implementation lands
- Now also owns the first in-memory playback runtime for loaded-track and play/pause authority
- Will own the native output stack in `v1.2.0`, with `symphonia` handling decode and `cpal` handling device output

### `library`

- Owns local filesystem scan orchestration and normalized track ingestion
- Owns query shaping for search, sort validation, and backend pagination/cursor handling
- Keeps metadata normalization and library-domain models close to the scan/query flows that use them

Current submodules:

- `scanner`: recursive traversal, reconciliation, and transactional persistence
- `normalization`: file discovery, MP3 filtering, metadata normalization, and stable identifiers
- `query`: SQL shape generation, cursor encoding, sort helpers, and library result mapping
- `models`: library-domain payloads, query inputs, and scan errors

### `database`

- Owns SQLite runtime setup, connection policy, and migration application
- Keeps schema constants and persisted-state enums separate from boot/runtime concerns
- Serves as the infrastructure layer consumed by library services rather than by the UI directly

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

### Playback Ownership Shift

- The shell still hosts the `Audio` element for output in the current `v1.1.0` slice
- The `playback` Rust module is now the source of truth for loaded-track identity, play/pause state, timing updates, completion state, and playback errors
- The frontend dispatches user intent and renders backend snapshots through Tauri commands and `playback://state-changed`
- Queue state is still shell-derived today, but the ownership boundary is now narrow enough to move queue authority into Rust without changing the visible client contract

### Native Output Decision For `v1.2.0`

- Keep the current Tauri playback command and event contract as the public shell boundary
- Replace the frontend-owned `Audio` element output path with a Rust-native output engine
- Use `symphonia` for decode and format parsing of local files
- Use `cpal` for audio device output
- Keep the first native-output milestone local-file only so memory, buffering, and seek behavior can be validated without Atlas/cache complexity layered on top

This is intentionally a backend-engine swap behind an already defined shell contract, not a UI rewrite.

Current implemented boundary:

- Rust owns loaded-track state and play/pause authority through `load_playback_track` and `playback_action`
- Rust also owns timing sync, seek state, completion, and playback-error snapshots through `sync_playback_timing`, `seek_playback`, `complete_playback`, and `report_playback_error`
- The frontend still hosts the webview audio element, but it now behaves as a renderer/controller that reports media lifecycle facts upward instead of inventing local playback truth
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
- Started with a Web Audio-based path in public `v1.0.0` and now uses a hybrid `v1.1.0` model where Rust owns playback state while the shell still renders output

Current `v1.1.0` contract:

- Commands:
  `load_playback_track`, `playback_action`, `seek_playback`, `sync_playback_timing`, `complete_playback`, `report_playback_error`, `replace_playback_queue`, and `get_playback_snapshot`
- Events:
  `playback://state-changed` and `playback://queue-changed`
- Playback authority:
  the Rust runtime becomes the system of record for active track identity, queue order, timing, and source selection
- Frontend role:
  render snapshots, submit user intent, and avoid duplicating backend transport truth in local audio state once the migration is complete

Current implementation slice:

- `load_playback_track` resolves a local indexed track, updates backend playback runtime state, and returns the source path needed by the current frontend audio element
- `playback_action` now flips backend play/pause state for an already loaded track instead of returning a static placeholder payload
- `sync_playback_timing`, `seek_playback`, `complete_playback`, and `report_playback_error` let the frontend audio element report media lifecycle facts back to the backend runtime without reclaiming playback authority
- `playback://state-changed` now keeps the shell aligned to backend-owned playback snapshots instead of relying on local promise timing

Planned `v1.2.0` slice:

- move decode and output into Rust so the frontend no longer hosts active audio execution
- keep playback state snapshots and intent commands stable so the shell remains a customizable renderer/controller
- measure the native-output branch against the webview-output baseline before claiming a lightweight-runtime win

Current frontend playback baseline:

- Track selection in the library route sets the active playback item for the shell
- The client resolves the selected local file into a Tauri asset-backed playback source
- The client resolves persisted local artwork assets through the Tauri bridge for track-list and queue rendering
- Transport controls in the bottom bar drive the same active track state used by the queue route
- Queue order is now held separately from the filtered tracks table so search does not redefine what `next` means
- Progress and duration are synchronized from the active audio element back into shell state

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
3. MP3 files are discovered in the root and nested subfolders
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
4. Route content swaps between home, tracks, queue, and settings without rebuilding the full desktop shell

### Frontend Playback Flow

1. A track row selection marks the active local item in shell state
2. The desktop client resolves that indexed item into a local playback source through the Tauri bridge
3. The client audio element begins playback and emits metadata and time updates
4. The shell playback bar and queue route both read from the same active-track state
5. Previous and next transport actions derive their behavior from the currently loaded local track order

### Planned Rust Playback Flow

1. The frontend requests `load_playback_track` with the active track and queue snapshot
2. Rust resolves the source, updates playback ownership, and returns a `PlaybackSnapshot`
3. The frontend renders the returned state immediately and subscribes to playback events
4. Rust emits `playback://state-changed` on transport, timing, or source transitions
5. Rust emits `playback://queue-changed` whenever queue order or active index changes
6. The queue page and playback bar render the same backend-owned snapshots instead of deriving authority from a local audio element

### Playback Resolution

1. The user selects a track in the library table
2. The client resolves the indexed local file path through the Tauri bridge
3. The active audio element loads the local source and starts playback
4. Queue state and transport controls continue from the playback-order snapshot rather than from the current filtered table

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

- Web Audio may not satisfy all long-term latency and transition goals, which is why Rust-owned playback is planned as a near-term follow-up
- Atlas integration details still need concrete endpoint contracts for object identity, streaming, and version sync
- The integration surface with `~/dev/timbre` needs a clear boundary to avoid code drift
- Recursive directory scanning needs careful filtering so non-audio files and permission failures do not degrade import reliability
- Artwork, metadata edge cases, and corrupted files can complicate indexing behavior

## Implementation Notes

The public v1 implementation should prioritize a dependable local-first player before layering on remote storage, cache policy, and analysis depth. The next key architectural decision after `v1.0.0` is the move from frontend-owned playback into a Rust-owned playback service, followed by the later Atlas and `timbre` integration boundaries.

The current Rust backend now reflects that direction more closely:

- `commands` owns the Tauri-facing application boundary
- `library` owns scan, normalization, and query services
- `database` owns runtime setup, migrations, and schema contracts
- `playback` now defines the backend playback command and event contract for the `v1.1.0` migration

That separation is still early and can deepen further with repositories, playback services, and analysis services, but the code is no longer relying on one catch-all module per subsystem.

The frontend now follows the same direction: a routed shell, separated layout components, route-owned pages, and a dedicated hook for boot/query/scan coordination instead of one monolithic client entry file.

The playback-core branch established a working frontend-owned playback baseline. The current `v1.1.0` implementation now moves loaded-track, play/pause, timing, completion, and error authority behind a backend runtime while keeping the same shell surface. The next step is to move queue progression and final audio output deeper into that same backend boundary without regressing the current shell contract.
