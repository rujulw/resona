# resona architecture

## Overview

resona is a local-first desktop music system with Atlas as the primary remote storage layer for the same user-owned library and asynchronous timbre analysis fused into the core stack. The architecture is optimized for predictable playback latency, low memory pressure, and clear separation between UI concerns and core media logic.

## Goals

- Keep playback responsive for local, cached, and remote tracks
- Support large libraries without storing the full catalog in React memory
- Persist operational state and metadata in SQLite
- Isolate analysis work so it never blocks playback
- Treat Atlas as the canonical remote store while preserving direct local playback
- Keep the application architecture open source and portable

## System Context

```text
React UI
  -> Tauri commands and events
  -> Rust core services
  -> Embedded timbre analysis services
  -> SQLite metadata store
  -> Local filesystem
  -> Atlas media endpoints
```

## Top-Level Components

### client

The desktop UI provides library navigation, search, queue control, playback controls, and lightweight insight views. It should remain table-oriented and intentionally minimal, with pagination and event-driven updates instead of global library hydration.

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

### `library`

- Owns local filesystem scan orchestration and normalized track ingestion
- Owns query shaping for pagination, search, sort validation, and cursor handling
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
- The app-shell hook also owns active-track playback state, derived queue state, and audio progress synchronization

### fused timbre engine

The analysis subsystem is expected to be fused in from the local `~/dev/timbre` project rather than rebuilt from scratch. resona should wrap that code behind a dedicated internal service boundary so upgrades from the upstream timbre codebase stay manageable.

## Core Services

### Library Engine

- Open a directory picker through Tauri so users never type raw local paths into the app
- Index selected local folders recursively for MP3 files
- Reconcile local tracks with Atlas-backed library records
- Expose paginated queries, sorting, and search
- Track version, availability, and analysis readiness

Current ingest limitation:
- The MVP scanner currently reads title, artist, album, and optional duration from ID3 metadata, but it does not yet compute duration from the audio stream itself and does not yet extract embedded artwork. System media tools may therefore show richer data than the current `resona` ingest path.

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
- Cursor pagination avoids the linear row-skip cost that deep offset pagination accumulates over time.
- Indexed query paths let SQLite perform ordered reads close to the stored data instead of forcing the application to load and sort the full library in memory.

### Source Providers

- `LocalSource` resolves filesystem-backed tracks
- `AtlasSource` resolves remote track metadata and streaming access from the primary remote library store
- Shared interface supports metadata lookup, version validation, and fetch operations

### Cache Manager

- Maintains temporary streaming buffers and reusable local cache
- Applies size-bounded LRU eviction
- Promotes successful Atlas playback into reusable cache entries
- Invalidates stale entries when Atlas versions change

### Playback Engine

- Resolves playback path in priority order: local, cached, remote
- Owns queue state, transport controls, buffering state, and transitions
- Starts with a Web Audio-based path in V1 and leaves room for a native Rust path in V2

Current frontend playback baseline:

- Track selection in the library route sets the active playback item for the shell
- The client resolves the selected local file into a Tauri asset-backed playback source
- Transport controls in the bottom bar drive the same active track state used by the queue route
- Progress and duration are synchronized from the active audio element back into shell state

### Analysis Engine

- Runs timbre extraction jobs asynchronously through the fused local `timbre` engine
- Stores analysis outputs in SQLite
- Uses throttled scheduling to avoid CPU spikes
- Produces track-level insight fields for UI display and later intelligent playback features

### Database Layer

- Uses SQLite for metadata, cache state, source references, and analysis outputs
- Avoids large in-memory application state by serving paginated queries
- Stores operational state needed for deterministic recovery and indexing

### Query Layer Design

Library browsing is handled as a database query problem rather than as an in-memory sorting problem in the UI or Rust service layer.

- Sort keys are validated against a fixed whitelist
- Search runs against normalized title, artist, and album fields
- Ordering uses stable secondary tie-breaks on `id`
- Pagination uses cursors instead of raw offsets

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
4. Metadata is parsed and matching Atlas objects are linked or queued for sync refresh
5. Normalized records are stored in SQLite
6. UI refreshes paginated views through Tauri

### Library Query Flow

1. UI requests a page with search text, sort key, direction, and optional cursor
2. Rust validates the sort path against a fixed whitelist
3. SQLite executes the search and sort using the available indexes
4. Results are returned with a stable next-cursor token for the following page
5. The client renders only the requested page instead of hydrating the full library

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

### Playback Resolution

1. Playback request enters the Rust engine
2. Engine checks local availability for the requested library item
3. If not local, it checks ready cache
4. If needed, Atlas fetch begins into a temporary buffer from the linked remote object
5. Playback starts when the minimum safe buffer is available
6. Background write continues and may promote the asset into warm cache

### Analysis

1. Newly indexed or newly fetched tracks are queued for analysis
2. The fused `timbre` service processes tracks opportunistically
3. Results are persisted without mutating playback-critical state
4. UI surfaces insights when available

## Performance Constraints

- No full-library React state
- No continuous rescanning loops
- Minimal GPU-heavy effects or transparency stacks
- Event-driven updates over polling where possible
- Background analysis must be throttled and interruptible
- The fused `timbre` integration must not force resona into a closed or tightly coupled release model

## Risks

- Web Audio may not satisfy all long-term latency and transition goals
- Atlas integration details still need concrete endpoint contracts for object identity, streaming, and version sync
- The integration surface with `~/dev/timbre` needs a clear boundary to avoid code drift
- Recursive directory scanning needs careful filtering so non-audio files and permission failures do not degrade import reliability
- Artwork, metadata edge cases, and corrupted files can complicate indexing behavior

## Implementation Notes

The initial implementation should scaffold clear interfaces between library, cache, playback, and analysis subsystems before feature depth is added. The first key integration decisions are Atlas object linkage and the boundary used to fuse in `timbre` while keeping resona open source and independently buildable.

The current Rust backend now reflects that direction more closely:

- `commands` owns the Tauri-facing application boundary
- `library` owns scan, normalization, and query services
- `database` owns runtime setup, migrations, and schema contracts

That separation is still early and can deepen further with repositories, playback services, and analysis services, but the code is no longer relying on one catch-all module per subsystem.

The frontend now follows the same direction: a routed shell, separated layout components, route-owned pages, and a dedicated hook for boot/query/scan coordination instead of one monolithic client entry file.

The playback-core branch extends that pattern by keeping active-track selection, transport actions, queue derivation, and audio progress updates behind the same client-side shell boundary instead of scattering those responsibilities across unrelated pages.
