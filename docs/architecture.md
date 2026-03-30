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

### server

The Rust side owns media orchestration, metadata ingestion, source resolution, cache policy, playback state, and background analysis scheduling. Tauri exposes narrow command and event boundaries to the UI.

### fused timbre engine

The analysis subsystem is expected to be fused in from the local `~/dev/timbre` project rather than rebuilt from scratch. resona should wrap that code behind a dedicated internal service boundary so upgrades from the upstream timbre codebase stay manageable.

## Core Services

### Library Engine

- Open a directory picker through Tauri so users never type raw local paths into the app
- Index selected local folders recursively for MP3 files
- Reconcile local tracks with Atlas-backed library records
- Expose paginated queries, sorting, and search
- Track version, availability, and analysis readiness

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

The current Rust implementation keeps some early branch work concentrated in `mod.rs` files to move quickly while the shape is still changing. That is acceptable for a short-lived scaffold phase, but it is not the intended long-term structure. As the library branch matures, the code should be split into focused modules such as scanning, normalization, repositories, models, and commands, which is closer to the same encapsulation goals often taught in Java package design.
