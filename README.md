# resona

resona is a lightweight, local-first desktop music system built for fast playback, large private libraries, and integrated audio intelligence. It combines a React user interface, a Tauri desktop shell, a Rust core, and SQLite-backed metadata to keep playback responsive while analysis runs in the background.

## Product Goal

Build a private, performance-first music player that feels closer to a system utility than a streaming platform. The MVP focuses on dependable local playback, Atlas-backed storage and sync for the same library, deterministic queueing, and non-blocking timbre analysis for track-level insights.

## MVP Scope

- Select a local music folder through the desktop app instead of entering raw filesystem paths
- Recursively discover MP3 files in the selected folder and nested subfolders
- Persist track metadata in SQLite
- Browse large libraries with paginated queries
- Search tracks quickly without loading the full library into UI state
- Play local, cached, and remotely fetched Atlas tracks
- Manage queue, play/pause, seek, shuffle, and repeat
- Cache remote tracks with size-bounded LRU eviction
- Run background timbre analysis without interrupting playback
- Surface track-level insights such as BPM, energy, tonal profile, and flow metrics

## Non-Goals

- Feed-based discovery or recommendation interfaces
- Social features, sharing, or collaborative playlists
- Gapless playback, crossfade, or equalizer support in V1
- Heavy visualizations or animation-driven UI
- Full streaming-service style cloud product behavior

## User Segments

- Listeners with large local libraries who want a fast desktop player
- Users storing their library in Atlas and needing seamless local caching
- Builders interested in audio analysis without sacrificing playback performance

## Core Principles

- Local-first, Atlas-backed
- Predictable performance at 10k+ tracks
- Minimal React state and rendering overhead
- Analysis enhances playback and never blocks it
- Clear, utility-first interface over entertainment-platform patterns
- Open-source core with private user-controlled media storage

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
- Audio path: Web Audio in V1, native Rust playback path in V2
- Remote storage: Atlas as the primary remote store for the indexed library
- Analysis engine: fused from the local `timbre` codebase and integrated into the Rust core

## MVP Subsystems

### Library Engine

Indexes local files from a user-selected directory, scans nested folders for MP3 content, syncs Atlas-backed library metadata, normalizes track records, and exposes paginated library queries.

## Engineering Notes

The local-library scanner is one of the main systems-oriented pieces in the MVP. It is intentionally designed to show more than basic CRUD work:

- Recursive traversal uses an explicit stack and visited-set rather than naive recursive calls, which keeps control flow predictable and avoids duplicate directory work.
- Track reconciliation uses a hash map keyed by relative path, so rescan diffing runs in near-linear time instead of degenerating into repeated nested comparisons.
- Scan results are sorted deterministically before normalization and persistence, which keeps output stable for testing and debugging.
- SQLite writes run inside a transaction so insert, update, cache-state initialization, and analysis-state initialization happen as one consistent batch.

In portfolio terms, the flex is not just "it scans folders." The interesting part is the combination of traversal strategy, normalization, stable ID generation, diff-based persistence, and bounded growth characteristics when the library gets large.

### Source Providers

Supports `LocalSource` for filesystem access and `AtlasSource` for the primary remote library store and retrieval path.

### Cache Manager

Maintains warm cache, temporary buffers, and promotion from streamed content into ready local cache with version-aware invalidation.

### Playback Engine

Chooses the fastest viable path for playback:

1. Local file
2. Cached file
3. Remote fetch to temporary buffer, then playback

### Analysis Engine

Runs asynchronous timbre profiling through an integrated `timbre` engine to extract BPM, energy, spectral, tonal, dynamic, and custom flow features while keeping CPU use constrained.

## Performance Targets

| State | RAM | CPU |
| --- | --- | --- |
| Idle | 30-80 MB | ~0% |
| Playing local track | Minimal increase | 1-3% |
| Streaming remote track | Slight increase | 2-5% |

## Open Source Position

resona is intended to remain open source as an application and systems project. Atlas integration is a storage adapter for user-controlled media, not a closed platform dependency, and the embedded `timbre` analysis layer should be integrated in a way that preserves a clear open-source development model.

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
