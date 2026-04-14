# resona roadmap

## Product Direction

resona aims to become a high-performance music system for private libraries, balancing immediate playback, clear library management, and useful audio intelligence without becoming a bloated media platform.

## MVP Outcomes

- Local music libraries can be imported through a folder picker and indexed recursively
- Track metadata is persisted and queryable through SQLite
- Users can search, browse, queue, and play tracks reliably
- Users can manage first-class local playlists with persisted ordering and playback handoff
- The first public release stays local-first and open source
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
- Split the client into routed pages, reusable layout components, and shell hooks once the first desktop shell stabilizes

## Milestone 3: Library Foundation

- Define SQLite schema for tracks, sources, cache, and analysis
- Implement local folder picker flow through Tauri
- Implement recursive MP3 discovery for selected folders and nested directories
- Add metadata normalization and pagination queries
- Add search and sort capabilities for the main library view with indexed query paths and cursor-backed browsing
- Split early `mod.rs` implementations into focused Rust modules once the scan and persistence interfaces stabilize
- Add frontend smoke coverage for route boot, shell render, and production build stability

Current milestone progress:
- The `tracks` route now exposes inline search, header-driven sort cycling, and a continuous scrollable library view backed by cursor-based query stitching
- Local ingest now includes duration/artwork fallback improvements and cleaner sparse-tag row metadata
- Public v1 now has a planned GitHub Actions gate for frontend smoke/build checks and backend Rust test/check coverage
- Release polish now includes desktop packaging metadata and icon-aware shell controls

## Milestone 4: Playback and Queue

- Implement playback state management for active local track selection and shell sync
- Add queue creation, reorder, and removal flows
- Support local playback and cached playback
- Introduce initial remote buffering path for Atlas tracks

Current milestone progress:

- Active local track selection now drives the persistent playback bar
- Local indexed MP3 playback is now working in the desktop client
- Previous, next, pause, restart, seek, and progress sync now operate against the active track
- The queue route now reflects stable next-up behavior from playback order rather than from the filtered tracks table
- Embedded artwork now renders in the tracks view, queue view, and playback bar
- Release-hardening fixes now guard against stale playback-source and overlapping library-query races
- `v1.3.0` now has an explicit Rust-side playback command and event contract
- Rust now owns local playback output for indexed desktop files behind the existing playback runtime
- The shell now renders playback progress and completion from backend-driven state changes instead of frontend-owned media lifecycle callbacks
- Native playback smoke coverage now exercises launch, play, seek, pause, and completion through backend and shell tests
- Privacy-safe desktop presence now ships with a managed Discord RPC client and explicit/advisory metadata remains source-trusted rather than heuristically inferred
- `v1.3.0` now adds first-class local playlists with persisted ordering and backend queue handoff
- Playlist foundations now define storage and ordering contracts that Spotify import and smart playlists can reuse later
- Playlist reordering now uses a handle-only drag interaction with explicit drop markers and queue-snapshot stability after handoff

Current release status:

- `v1.3.0` now ships the local-first playback baseline, FLAC compatibility, privacy-safe Rich Presence, trusted advisory metadata, and first-class playlists in one coherent desktop release
- The next release work should build on that baseline with Spotify import, artist/album pages, richer queue ownership, and timbre-driven insight surfaces

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
- Rich presence payloads that expose album titles, artwork, queue contents, or filesystem-derived identity
- Explicit-content inference from lyrics or heuristic text analysis

## Dependencies and Open Questions

- Atlas endpoint contracts need to be specified for object identity, metadata sync, streaming, and version validation
- The local `~/dev/timbre` integration needs a defined module boundary and update workflow
- Native output still needs dedicated validation for memory, CPU, and device-compatibility behavior
- Library import behavior for malformed tags, missing artwork, permission failures, and non-MP3 files should be documented during implementation
- Atlas sync and timbre analysis should stay explicitly deferred until the public v1 local-first release is stable
- Queue ownership is still more shell-derived than the long-term Rust-first playback model
- Tagged macOS release builds still need an explicit artifact-upload step so DMG output is downloadable from GitHub Actions

## Release Gate

- Frontend CI should run `npm test` and `npm run build` on every push and pull request
- Backend CI should run `cargo test` and `cargo check` before the public v1 tag is cut
- Release tagging should happen only after the local-first import, playback, queue, and shell flows are covered by passing automation
