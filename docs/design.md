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
- Users syncing private collections through Atlas as their remote library store
- Technical users who value control, speed, and clarity
- Open-source contributors working on playback, storage, and analysis systems

## MVP Experience

### Library

The default view is a focused track library with search, sort, and pagination. Sidebar navigation should stay small and functional, covering library views, queue access, and settings without secondary content feeds.

### Playback

Playback controls live in a persistent bottom bar with clear transport actions, current track identity, progress, and source or cache status. Core actions should be available with minimal pointer movement.

### Queue

Queue management should be explicit and deterministic. Users should always understand what plays next and why. V1 should avoid hidden automation beyond user-selected shuffle and repeat modes.

### Insights

Track insights from timbre should appear in secondary detail surfaces such as a side panel or detail drawer. Insight availability should never interrupt the core listening flow.

## Visual Direction

- Dark or low-glare desktop palette is acceptable, but contrast must remain high
- Typography should feel utilitarian and compact
- Dense information display is preferred over oversized spacing
- Artwork is present but secondary to library and playback data

## Interaction Constraints

- No infinite-scroll feed patterns
- No animated backgrounds or persistent decorative motion
- No large global state containers for the full library dataset
- No blocking UI during indexing, remote fetch, or analysis

## Technical Design Decisions

- The app name remains lowercase as `resona` across README and docs by repository convention
- Atlas is the primary remote storage layer for the same user-owned library that can also be played directly from disk
- The analysis subsystem is fused from the local `~/dev/timbre` project behind an internal service boundary
- V1 uses a Web Audio path for faster delivery, while native Rust playback remains a future upgrade path
- Playback-critical flows are owned by Rust to reduce frontend complexity
- The app remains open source even when used with private Atlas-backed media libraries

## Non-Goals

- Recommendation feed design
- Social interaction design
- Mobile-first adaptation
- Visualizer-first playback experience

## Overrides

No active design overrides are recorded.
