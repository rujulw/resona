# resona

resona is a lightweight, local-first desktop music system built for fast playback, large private libraries, and integrated audio intelligence. It combines a React user interface, a Tauri desktop shell, a Rust core, and SQLite-backed metadata to keep playback responsive while analysis runs in the background.

## Product Goal

Build a private, performance-first music player that feels closer to a system utility than a streaming platform. The MVP focuses on dependable local playback, optional Atlas-backed media access, deterministic queueing, and non-blocking timbre analysis for track-level insights.

## MVP Scope

- Import and index local music folders
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
- Users storing music in Atlas and needing seamless local caching
- Builders interested in audio analysis without sacrificing playback performance

## Core Principles

- Local-first, cloud-augmented
- Predictable performance at 10k+ tracks
- Minimal React state and rendering overhead
- Analysis enhances playback and never blocks it
- Clear, utility-first interface over entertainment-platform patterns

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
- Remote storage: Atlas private media backend

## MVP Subsystems

### Library Engine

Indexes local files, syncs Atlas metadata, normalizes track records, and exposes paginated library queries.

### Source Providers

Supports `LocalSource` for filesystem access and `AtlasSource` for remote private storage retrieval.

### Cache Manager

Maintains warm cache, temporary buffers, and promotion from streamed content into ready local cache with version-aware invalidation.

### Playback Engine

Chooses the fastest viable path for playback:

1. Local file
2. Cached file
3. Remote fetch to temporary buffer, then playback

### Analysis Engine

Runs asynchronous timbre profiling to extract BPM, energy, spectral, tonal, dynamic, and custom flow features while keeping CPU use constrained.

## Performance Targets

| State | RAM | CPU |
| --- | --- | --- |
| Idle | 30-80 MB | ~0% |
| Playing local track | Minimal increase | 1-3% |
| Streaming remote track | Slight increase | 2-5% |

## Current Status

The repository is in project bootstrap mode. Planning artifacts are in `docs/`, and implementation will proceed in reviewable slices after the initial repository scaffold commit.

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
