# resona

resona is a lightweight, local-first desktop music system built for fast playback, large private libraries, and integrated audio intelligence. It combines a React user interface, a Tauri desktop shell, a Rust core, and SQLite-backed metadata to keep playback responsive while analysis runs in the background.

## Product Goal

Build a private, performance-first music player that feels closer to a system utility than a streaming platform. The current v1 focus is dependable local playback, folder-based library import, deterministic queueing, and a dense desktop shell that can grow into Atlas-backed storage and timbre-powered insight work later.

## MVP Scope

- Select a local music folder through the desktop app instead of entering raw filesystem paths
- Recursively discover MP3 files in the selected folder and nested subfolders
- Persist track metadata in SQLite
- Browse large libraries in a scrollable tracks table with search and header-driven sorting
- Search tracks quickly without loading the full library into React state as one giant boot payload
- Play indexed local tracks with persistent transport controls and progress sync
- Manage queue, play/pause, previous, next, and restart-on-previous behavior

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

- Local-first
- Predictable performance at 10k+ tracks
- Minimal React state and rendering overhead
- Analysis should enhance playback and never block it
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

## Frontend Foundation

- The desktop client now uses `react-router-dom` for a persistent shell with `home`, `tracks`, `queue`, and `settings` routes
- The left sidebar and bottom playback bar stay mounted across route changes
- The top window area is moving toward an app-owned desktop chrome instead of relying fully on the native title text
- The client code is now split into `components/`, `pages/`, `hooks/`, `types/`, `constants/`, and `utils/` rather than keeping the shell in one `App.tsx`
- The `tracks` route now uses a full-width inline search field, header-driven sorting, and a scrollable library table inside the persistent desktop shell

## Current Playback Baseline

- Selecting a track from the library now drives the active playback state in the persistent bottom bar
- Local indexed MP3 files can now be played directly through the desktop client using Tauri asset-backed file access
- Transport controls now handle play, pause, previous, next, restart-on-previous, and live progress updates
- The queue route now reflects a derived next-up flow from the active local selection instead of placeholder shell copy

## MVP Subsystems

### Library Engine

Indexes local files from a user-selected directory, scans nested folders for MP3 content, normalizes track records, and exposes searchable/sortable library queries.

The current ingest baseline now goes beyond tag-only metadata:
- Track duration falls back to MP3 frame parsing when ID3 duration is missing
- Embedded album art is extracted during scan and persisted into local app data for later UI use
- The tracks table now renders artwork tiles for indexed items, and the queue view now shows larger cover art for the active track

## Engineering Notes

The local-library scanner is one of the main systems-oriented pieces in the MVP. It is intentionally designed to show more than basic CRUD work:

- Recursive traversal uses an explicit stack and visited-set rather than naive recursive calls, which keeps control flow predictable and avoids duplicate directory work.
- Track reconciliation uses a hash map keyed by relative path, so rescan diffing runs in near-linear time instead of degenerating into repeated nested comparisons.
- Scan results are sorted deterministically before normalization and persistence, which keeps output stable for testing and debugging.
- SQLite writes run inside a transaction so insert, update, cache-state initialization, and analysis-state initialization happen as one consistent batch.
- Library browsing uses indexed sort paths, while the client stitches backend query pages together into one continuous scrollable library view.

In portfolio terms, the flex is not just "it scans folders." The interesting part is the combination of traversal strategy, normalization, stable ID generation, diff-based persistence, and bounded growth characteristics when the library gets large.

### Source Providers

Supports `LocalSource` for filesystem access today and leaves room for a future `AtlasSource` retrieval path.

### Cache Manager

Planned for later: warm cache, temporary buffers, and promotion from streamed content into ready local cache with version-aware invalidation.

### Playback Engine

Current v1 playback chooses the local indexed file path. Later branches can extend that path priority to:

1. Local file
2. Cached file
3. Remote fetch to temporary buffer, then playback

The current implementation baseline already supports direct local playback for indexed MP3 files through the desktop client, with the next-up queue derived from the currently active library selection.

### Analysis Engine

Planned for later: asynchronous timbre profiling through an integrated `timbre` engine to extract BPM, energy, spectral, tonal, dynamic, and custom flow features while keeping CPU use constrained.

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

Current frontend verification includes:

- `npm test` for client bridge and route/shell smoke checks
- `npm run build` for Vite production build validation including Tailwind integration
