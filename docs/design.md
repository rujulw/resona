# resona design

## Product Summary

resona is designed to feel immediate, controlled, and quiet. The interface should resemble a desktop utility for music playback rather than a feed-based entertainment product.

## UX Principles

- Favor table-based browsing over card-heavy discovery layouts
- Keep navigation shallow and predictable
- Make playback state legible at a glance
- Avoid animation that competes with the music workflow
- Surface analysis as supporting context, not the main event

## Primary Users

- People with curated local music libraries
- Technical users who value control, speed, and clarity
- Open-source contributors working on playback, storage, and analysis systems

## MVP Experience

### Library

The working library view is a focused tracks table with an inline search field, header-driven sorting, compact artwork tiles, and a continuous scrollable body. Sidebar navigation should stay small and functional, covering home, tracks, queue, and settings without secondary content feeds. Import should begin from a clear folder-selection action in settings rather than from a raw path entry field embedded into the main track view. When tags are sparse, the library should still feel polished through filename-cleanup fallbacks, album-artist fallback, parent-folder album fallback, and duration estimates that avoid unnecessary blank rows.

### Playback

Playback controls live in a persistent bottom bar with clear transport actions, current track identity, progress, and source or cache status. Core actions should be available with minimal pointer movement, and the selected track in the library should immediately become the active shell track.

The current v1 shell still renders playback from a frontend-owned audio path, but the `v1.1.0` direction is now explicit: Rust should own the transport truth and the shell should react to backend playback snapshots rather than inventing a parallel client-only playback model.

The first implementation slice of that change is now in place: track loading and play/pause state can already come from the backend runtime, while the current audio element still handles output and timing until the next playback migration slice lands.

The next implementation step is event-driven shell sync. Once the backend mutates playback state, the shell should hear about it through named Tauri playback events instead of assuming that local promise timing is the same thing as playback truth.

### Queue

Queue management should be explicit and deterministic. Users should always understand what plays next and why. The current baseline derives next-up behavior from the playback-order snapshot created when playback starts, so searching or filtering the tracks view does not silently redefine the queue. The active queue view should also give the current track enough visual weight to feel like a player, including larger artwork for the now-playing item.

### Insights

Track insights from timbre should appear in secondary detail surfaces such as a side panel or detail drawer. Insight availability should never interrupt the core listening flow.

## Visual Direction

- Dark or low-glare desktop palette is acceptable, but contrast must remain high
- Typography should feel utilitarian and compact
- Dense information display is preferred over oversized spacing
- Artwork is present but secondary to library and playback data
- Persistent shell chrome should feel like a desktop player, with a left navigation rail and a fixed playback bar
- Navigation and transport affordances should use restrained iconography rather than placeholder text glyphs once the app moves into release polish

## Interaction Constraints

- No feed-style infinite-scroll patterns
- No animated backgrounds or persistent decorative motion
- No large global state containers for the full library dataset
- No blocking UI during indexing, remote fetch, or analysis

## Technical Design Decisions

- The app name remains lowercase as `resona` across README and docs by repository convention
- Atlas integration is deferred until a later release and should not distort the public v1 local-first UX
- The analysis subsystem is planned to be fused from the local `~/dev/timbre` project behind an internal service boundary after v1 ships
- Local library onboarding should use a desktop directory picker and recursive MP3 discovery instead of asking the user to paste filesystem paths
- Public `v1.0.0` uses a Web Audio path for faster delivery, while native Rust playback is the planned `v1.1.0` upgrade path
- Playback-critical source resolution and library persistence flows are owned by Rust to reduce frontend complexity
- The app remains open source even when used with private Atlas-backed media libraries
- The desktop client should use a persistent routed shell so home, tracks, queue, and settings share the same navigation and playback frame
- The playback bar and queue route should both read from the same active-track state so transport and next-up behavior cannot drift apart
- The `v1.1.0` playback migration should move command authority to Rust through a narrow Tauri contract and push playback snapshots back to the shell through named events
- The shell should consume backend playback snapshots through `playback://state-changed` rather than inventing separate client-only transport truth
- The tracks route should feel like one uninterrupted library surface, even if the backend continues to use paged query primitives under the hood
- Public v1 release readiness should be enforced by automated frontend and backend CI rather than manual spot checks alone

## Non-Goals

- Recommendation feed design
- Social interaction design
- Mobile-first adaptation
- Visualizer-first playback experience
- Atlas sync in the first public release
- timbre-driven insight surfaces in the first public release

## Overrides

No active design overrides are recorded.
