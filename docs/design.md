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

The working library view is a focused tracks table with an inline search field, header-driven sorting, compact artwork tiles, and a continuous scrollable body. Sidebar navigation should stay small and functional, covering home, tracks, playlists, queue, and settings without secondary content feeds. Import should begin from a clear folder-selection action in settings rather than from a raw path entry field embedded into the main track view. When tags are sparse, the library should still feel polished through filename-cleanup fallbacks, album-artist fallback, parent-folder album fallback, and duration estimates that avoid unnecessary blank rows.

### Playback

Playback controls live in a persistent bottom bar with clear transport actions, current track identity, progress, and source or cache status. Core actions should be available with minimal pointer movement, and the selected track in the library should immediately become the active shell track.

The current app treats the shell as a playback renderer/controller rather than the playback authority. Rust owns the transport snapshot, timing updates, completion state, error labels, local desktop output for native playback, and the queue-handoff boundary used by playlists.

Track loading, play/pause, seek, ended, and playback-error transitions now move through backend commands and come back through named playback events instead of through local React state writes.

This leaves one clear boundary for later slices: deeper output/runtime work can still keep the command/event contract stable because the shell is already no longer the transport source of truth.

That remains the direction for later refinement: keep playback output in Rust while the React shell stays fully responsible for the visible playback UI. Native output should not reduce the product's ability to ship a custom progress bar, queue view, artwork treatment, or transport layout.

### Format Compatibility

The current FLAC support is a compatibility expansion, not a UI redesign. A mixed MP3 + FLAC library should still feel like one coherent local collection:

- the tracks table should not split the library into codec-specific views
- playback controls should behave identically for MP3 and FLAC tracks
- queue, artwork, album, and artist presentation should stay format-agnostic
- missing metadata should still degrade gracefully through the same fallback rules the MP3 path already uses

The product goal is "more local libraries work immediately," not "surface audio-format complexity in the UI."

### Presence and Advisory Metadata

The desktop Rich Presence is a restrained utility feature, not a social redesign. The app should be able to report lightweight playback activity to Discord without compromising the privacy expectations of a local-first music library.

Design rules for the first presence slice:

- presence should reflect currently active playback only
- presence should stay readable and minimal rather than trying to mirror the full playback bar
- the default payload should reveal as little local-library context as possible
- the first implementation should use a maintained Discord RPC client library instead of a custom raw IPC transport

What the first presence UI/contract should not do:

- expose local file names or filesystem structure
- publish album titles, cover art, queue contents, or library-root names
- create user-facing account or friend surfaces inside `resona`
- imply that `resona` is becoming a collaborative or socially networked product

The explicit/advisory tag feature remains a neighboring but separate slice:

- only trust explicit/advisory signals that come from source metadata
- do not try to infer explicitness from lyrics or heuristic text analysis
- degrade gracefully when no advisory signal is available
- keep the UI small, closer to an inline badge than a new filtering mode

Design rules for that advisory slice:

- treat advisory state as optional listening context rather than as a core library-identity field
- preserve trusted source truth when present, even if some files in the library do not carry the same tag
- keep the default UX neutral when advisory metadata is missing instead of pretending missing metadata means clean content
- avoid turning the badge into a dominant visual treatment that competes with title, artist, or playback state

Trusted sources for the first pass:

- embedded local audio tags that explicitly declare advisory/parental-warning content
- future provider imports only when the upstream provider exposes an explicit/advisory field directly

Explicitly rejected fallback ideas:

- no lyric parsing
- no filename or folder-name heuristics
- no genre-based assumptions
- no text-pattern guessing from titles or album names

### Queue

Queue management should be explicit and deterministic. Users should always understand what plays next and why. The current baseline derives next-up behavior from the playback-order snapshot created when playback starts, so searching or filtering the tracks view does not silently redefine the queue. The active queue view should also give the current track enough visual weight to feel like a player, including larger artwork for the now-playing item.

### Playlists

Playlists should feel like a first-class saved listening surface rather than a thin library filter. The playlist route should preserve the same low-glare desktop utility tone as the tracks route while adding just enough structure to support saved ordering, cover artwork, and deliberate playback handoff.

Design rules for the current playlist slice:

- playlist creation should happen in a dialog instead of an always-open in-page editor
- saved order should read like a durable ordered table, not like a temporary queue shadow
- library handoff should feel like an adjacent acquisition surface rather than a separate workflow
- saved-order selection should support keyboard removal and precise playback starting points without overwhelming the layout with heavy editing chrome

Design rules for the current drag-reorder slice:

- drag reorder should preview one explicit drop target at a time rather than implying a fuzzy freeform move zone
- each saved-order row should resolve drag intent into a before-or-after drop target based on which half of the row the pointer occupies
- drag initiation should belong only to the reorder handle on the right so row selection and playback actions stay predictable
- persisted playlist order should change only on drop, never during hover, drag enter, or transient visual preview
- reorder commits should replace the full saved entry order in one explicit payload so backend state stays dense and deterministic
- playlist reorder should not silently mutate an already handed-off playback queue after playback has started
- visual drop affordances should use an explicit insertion line instead of a full-row highlight that can read like selection state

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
- Local library onboarding should expand to recursive MP3 + FLAC discovery without changing the visible library workflow
- Earlier builds used a Web Audio path for faster delivery, while the current app reflects the Rust-owned playback authority and local desktop output model
- Further native-output refinement can deepen the Rust-local stack around `symphonia` decode and `cpal` device output while preserving the existing shell-facing playback contract
- Playback-critical source resolution and library persistence flows are owned by Rust to reduce frontend complexity
- Format support should remain additive: new local codecs should fit the same normalization, query, and playback shell contracts instead of creating format-specific app modes
- The app remains open source even when used with private Atlas-backed media libraries
- The desktop client should use a persistent routed shell so home, tracks, playlists, queue, and settings share the same navigation and playback frame
- The playback bar and queue route should both read from the same active-track state so transport and next-up behavior cannot drift apart
- The playback contract moves command authority to Rust through a narrow Tauri contract and pushes playback snapshots back to the shell through named events
- The shell should consume backend playback snapshots through `playback://state-changed` rather than inventing separate client-only transport truth
- The shell should remain a renderer/controller rather than reclaiming playback state locally
- The frontend shell should expose three ownership layers: shell chrome state, route-owned screen state, and intent handlers grouped by the route or chrome surface that consumes them
- Route-owned transient UI state should stay inside page components unless another route or persistent shell surface truly depends on it
- The app-level shell hook should keep shared queries, refresh paths, playback coordination, and backend subscriptions, but it should stop serving as the home for page-only dialog drafts, search boxes, or drag-preview state
- The tracks route should feel like one uninterrupted library surface, even if the backend continues to use paged query primitives under the hood
- Public v1 release readiness should be enforced by automated frontend and backend CI rather than manual spot checks alone

## Frontend Shell Ownership Boundaries

The current shell structure preserves the visible desktop UX while making ownership legible in code.

### Shell chrome

Persistent shell chrome owns only persistent frame concerns:

- sidebar navigation labels and playlist shortcuts
- playback bar rendering and transport intents
- chrome-wide runtime labels or app identity

Chrome should consume already-derived state. It should not decide which route is active, fetch route data, or hold route-local drafts.

### Route composition

Route composition owns page selection and the mapping from app-shell state into route-facing contracts.

- `App.tsx` builds grouped route props from the shell hook
- `AppShell` owns shared frame wiring and playback chrome while `AppShellRoutes` owns the routed page map
- route composition may reuse the same underlying shell state across pages, but it should present that state in route-shaped slices

### Route-owned state

Each page owns its local interaction state and any transient UI that only matters within that route.

- `PlaylistsPage` owns dialog drafts, optimistic reorder preview, selected entry, and library-within-playlist filtering
- `TracksPage` owns presentation of the current query results, while shared query execution lives in focused shell hooks
- `SettingsPage` owns library import controls and reads shell-provided scan status without owning playback or playlist logic
- `HomePage` and `QueuePage` stay mostly render-only and should not accumulate shell orchestration work

### Shared shell hooks

The app-shell hook remains responsible for cross-route coordination:

- bootstrapping app payload and initial shell queries
- refreshing shared library and playlist data from the bridge
- playback subscription wiring, queue derivation, and transport coordination
- exposing route-grouped actions that route composition can hand to pages
- delegating bootstrap/query work to `useShellQueryState` and playback work to `usePlaybackCoordinator`, each with smaller focused helper hooks beneath them

The result should be a simple rule: if state must survive route changes or feeds more than one persistent shell surface, keep it in shell hooks; if it only exists to complete one screen workflow, keep it in that page.

## Non-Goals

- Recommendation feed design
- Social interaction design
- Mobile-first adaptation
- Visualizer-first playback experience
- Atlas sync in the first public release
- timbre-driven insight surfaces in the first public release

## Overrides

No active design overrides are recorded.
