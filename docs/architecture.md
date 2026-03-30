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

- Index local folders
- Reconcile local tracks with Atlas-backed library records
- Expose paginated queries, sorting, and search
- Track version, availability, and analysis readiness

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

1. User selects a library folder
2. Rust indexing service scans metadata
3. Matching Atlas objects are linked or queued for sync metadata refresh
4. Normalized records are stored in SQLite
5. UI refreshes paginated views through Tauri

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
- Artwork, metadata edge cases, and corrupted files can complicate indexing behavior

## Implementation Notes

The initial implementation should scaffold clear interfaces between library, cache, playback, and analysis subsystems before feature depth is added. The first key integration decisions are Atlas object linkage and the boundary used to fuse in `timbre` while keeping resona open source and independently buildable.
