# resona roadmap

## Product Direction

resona aims to become a high-performance music system for private libraries, balancing immediate playback, clear library management, and useful audio intelligence without becoming a bloated media platform.

## MVP Outcomes

- Local music libraries can be imported through a folder picker and indexed recursively
- Track metadata is persisted and queryable through SQLite
- Users can search, browse, queue, and play tracks reliably
- Atlas acts as the primary remote storage layer for the indexed library
- Background timbre analysis produces useful track-level insights
- The application remains open source while integrating private user-controlled storage

## Milestone 1: Foundation

- Establish `server/`, `client/`, and `docs/` baseline
- Capture product, architecture, and design decisions
- Confirm Atlas-backed library behavior and open-source constraints
- Define the fusion boundary for the local `timbre` engine

## Milestone 2: Application Skeleton

- Scaffold Tauri desktop application
- Create Rust core crate structure for services and commands
- Create React + Vite client shell
- Establish shared command and event contract between client and server
- Embed the `timbre` integration boundary as a dedicated internal service

## Milestone 3: Library Foundation

- Define SQLite schema for tracks, sources, cache, and analysis
- Implement local folder picker flow through Tauri
- Implement recursive MP3 discovery for selected folders and nested directories
- Link imported files to Atlas-backed identities where available
- Add metadata normalization and pagination queries
- Add search and sort capabilities for the main library view
- Split early `mod.rs` implementations into focused Rust modules once the scan and persistence interfaces stabilize

## Milestone 4: Playback and Queue

- Implement playback state management
- Add queue creation, reorder, and removal flows
- Support local playback and cached playback
- Introduce initial remote buffering path for Atlas tracks

## Milestone 5: Cache and Remote Media

- Implement size-bounded LRU cache management
- Add version-aware invalidation for Atlas assets
- Track warm cache, temporary buffer, and stale states
- Expose cache health and fetch state to the UI
- Support Atlas as the canonical remote store without requiring it for immediate local playback

## Milestone 6: timbre Analysis

- Add asynchronous analysis job scheduling
- Persist BPM, energy, tonal, spectral, and dynamic metrics
- Surface track-level insights in the UI
- Guard playback performance with analysis throttling
- Reuse the fused `timbre` engine instead of duplicating analysis logic

## Deferred Scope

- Gapless playback
- Crossfade
- Equalizer
- Waveform views
- Intelligent queueing driven by timbre
- Offline pinning and advanced cache controls

## Dependencies and Open Questions

- Atlas endpoint contracts need to be specified for object identity, metadata sync, streaming, and version validation
- The local `~/dev/timbre` integration needs a defined module boundary and update workflow
- Audio output path needs validation for the Web Audio based V1 approach
- Library import behavior for malformed tags, missing artwork, permission failures, and non-MP3 files should be documented during implementation
