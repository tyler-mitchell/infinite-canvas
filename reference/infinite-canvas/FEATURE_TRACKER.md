# Infinite Canvas Feature Tracker

This document tracks framework capabilities, hardening candidates, and the next
major implementation tranche for `apps/web/src/experiments/infinite-canvas`.

Use it as the active planning surface. The older material under
`apps/web/reference/infinite-canvas` remains useful inspiration, but this file
should describe what the current framework can absorb next.

## Status Legend

- `done`: implemented and covered by focused validation
- `planned`: accepted direction, not yet implemented
- `candidate`: valuable, but sequencing or shape is still open
- `defer`: valuable later, but not on the near path
- `risk`: hardening item that can block quality if ignored

## Current Baseline

- Canonical 2D world model for windows, camera, viewport, rects, and snapping.
- WebGPU/R3F spatial surface with a camera-synchronized grid backdrop and DOM
  window bodies.
- Legend State adapter at the React boundary; core reducers remain pure and
  state-library agnostic.
- Window lifecycle: open, close, focus, minimize, maximize, restore, pin.
- Headless window presence helpers group active, visible, pinned, and minimized
  windows for dock/taskbar/tray overlays.
- Pointer interactions: pan, marquee, trackpad wheel pan, move, resize, visible
  marquee/pan mode controls, continuous pinch zoom, 12% default minimum zoom,
  configurable wheel sensitivity, and configurable cursor policy.
- Canvas-managed window bodies suppress accidental native text selection while
  preserving an opt-in native body mode for editor-like content.
- Explicit selection model with replace/add/toggle/clear/select-all actions,
  including typed scene-object and edge targets.
- Core TanStack Hotkeys command boundary for cancel, select-all, nudge, and
  fit/reset view commands.
- Contextual command descriptors expose enabled actions to overlays and
  scene-layer render contexts without duplicating command logic.
- Canonical camera navigation command that targets windows, selection bounds,
  visible-window bounds, explicit world points, or explicit rects and applies
  center, zoom, or fit framing behavior.
- Selected-window group move with self-excluding snap candidates.
- Selection and visible-window bounds helpers for fit commands and future
  align/distribute/group operations.
- Marquee selection with replace, add, and toggle modes derived from canonical
  screen-to-world projection.
- Snap subsystem: window edges, centers, equal gaps, active-edge resize snapping,
  screen-pixel thresholds, multi-rail equal-size guides, and opt-in
  viewport/safe-area snapping.
- Persistence: versioned layout serialization with transient interaction state
  stripped and storage scoped by document identity when `documentKey` is present.
- Controlled custom DOM frame slots for app-specific window chrome without
  replacing framework-owned move, resize, focus, body, control, or raster
  behavior.
- Read-only R3F scene layer slots with world-space and screen-space projection
  modes. Background scene content uses the canvas camera; DOM-coupled effects
  use projected window screen rects, while core chrome stays host-local.
- Graph visual helper first slice: window connector paths, orthogonal routing,
  world path progress points, and scene transform helpers are available for
  reusable connectors, labels, and future path motion.
- Spatial target resolution first slice: pointer/drop points can resolve to
  empty world, framework windows, window areas, resize handles, or consumer
  targets through ordered resolver phases. Scene-object, overlay, and edge
  resolver factories are available for consumer-owned spatial targets; the
  workflow board demonstrates the durable edge path through clickable connector
  geometry, typed drop validation, and connector labels.
- Typed drop interaction first slice: drag payloads remain consumer-owned and
  typed across desktop props, overlay contexts, scene-layer contexts, target
  validation, and drop commits. Drop state carries valid/invalid/outside target
  status with the resolved target attached.

## Capability Backlog

| Priority | Capability                        | Status    | Why It Matters                                                                                                                              | First Durable Slice                                                                                                                                                                                                              |
| -------- | --------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Selection model                   | done      | Selection is the bridge between pointer gestures, commands, grouping, arrange tools, and future agent control.                              | Add `selection` state, pure selection actions, and tests for replace/add/toggle/clear.                                                                                                                                           |
| P0       | Keyboard command layer            | done      | Keyboard behavior should compile to the same canonical mutations as pointer behavior, not a parallel shortcut pile.                         | Add command registry, binding resolver, focus guard, and command execution tests.                                                                                                                                                |
| P1       | Marquee selection                 | done      | Multi-select needs a spatial gesture before group operations feel real.                                                                     | Add world-space marquee interaction and DOM overlay; keep render adapter swappable.                                                                                                                                              |
| P1       | Group move and resize             | done      | Selected windows should move as one unit before richer grouping/docking exists.                                                             | Group move is implemented; resize remains deferred until selection bounds are stable.                                                                                                                                            |
| P1       | Undo/redo transactions            | candidate | Any professional layout tool needs reversible experiments.                                                                                  | Coalesce drag/resize into single transactions after command layer exists.                                                                                                                                                        |
| P1       | Snap hysteresis                   | risk      | Without acquire/release locks, guides can flicker near dense geometry.                                                                      | Store per-axis snap lock in the interaction snapshot.                                                                                                                                                                            |
| P2       | Pan/zoom input polish             | done      | Trackpad, keyboard, spacebar-pan, and zoom-to-selection are high-feel interactions.                                                         | Two-finger wheel pan, fit-all, and fit-selection are implemented; zoom animation is later.                                                                                                                                       |
| P2       | Spatial index                     | candidate | Snapping, marquee hit tests, culling, and large layouts need fast nearby-rect queries.                                                      | Add an index boundary after selection/marquee tests define query semantics.                                                                                                                                                      |
| P2       | Window proxy spine                | partial   | R3F visibility, overlays, minimaps, decorations, and raster policy need one derived geometry mirror instead of ad hoc registries.           | Pure proxy selector and scene-layer context are in place; diagnostics-only proxy renderer remains next.                                                                                                                          |
| P2       | Scene extension slots             | done      | Consumers need to render custom 3D content, drop affordances, and diagnostics without bypassing camera/window ownership.                    | Expose read-only scene-layer slots with world/screen projection, proxy, selection, and command context.                                                                                                                          |
| P2       | Host-local chrome hardening       | done      | Core frames must share the DOM body host so drag, resize, and zoom cannot create cross-layer drift.                                         | Keep chrome in the transformed window host; reserve scene layers for decorations.                                                                                                                                                |
| P1       | Spatial target resolution         | partial   | Serious interactions need one answer to "what is under this pointer/drop point?" across windows, world, overlays, scene objects, and edges. | Window, empty-world, scene-object, edge, overlay, and custom resolver targets exist; the Workflow Board route demonstrates them through typed drops and clickable connector targets.                                             |
| P1       | Typed drag/drop contracts         | partial   | App overlays and external files need typed payloads, valid/invalid targets, previews, and commits without framework domain knowledge.       | Payload generics now flow through desktop, overlay, scene-layer, validation, and commit contexts; Workflow Board demonstrates connector/window/canvas commits, while Drop Tray demonstrates the conventional asset-palette flow. |
| P1       | Graph visual primitives           | partial   | Graph-heavy workspaces need connectors, rails, labels, badges, route paths, and path motion as reusable scene helpers.                      | Connector paths, orthogonal routing, labels, path progress, scene transforms, and a moving path token are visible in the Workflow Board and Scene Layers routes.                                                                 |
| P1       | Selection beyond windows          | partial   | Graph objects and edges must eventually participate in selection, commands, hover, and drag without becoming windows.                       | Typed scene-object/edge targets now live in selection state, commands, persistence, and workflow-board connector/region selection.                                                                                               |
| P1       | Contextual command model          | partial   | Consumers need to render available actions for selection, hover, drag, active window, or canvas state in their own UI.                      | Command availability queries now flow into overlay and scene-layer contexts; Workflow Board renders state-aware fit, clear, dock, and frame actions.                                                                             |
| P1       | Workspace/session boundaries      | partial   | Distinct documents must not leak stale persisted windows, layout, focus, or selection across contexts.                                      | `documentKey` now scopes persisted storage keys in addition to remounting the provider; Workflow Board exposes two document-scoped layouts.                                                                                      |
| P2       | Dock/taskbar/tray                 | partial   | Minimized windows, pinned tools, and background panels need a first-class surface beyond free-floating windows.                             | Headless window-presence helpers are exported and Workflow Board renders a practical pinned/minimized restore/focus dock.                                                                                                        |
| P1       | Programmatic camera behaviors     | partial   | Consumers and agents need to jump to objects, fit regions, preserve intent, and keep camera movement on one framework path.                 | `navigateToWindow`, `navigateToPoint`, `navigateToRect`, `navigateView`, fit selection, and fit all share the canonical camera reducer; Workflow Board exposes fit board/region/connector actions.                               |
| P2       | External drag/drop bridge         | partial   | App overlays and external files need a generic way to project drag state into canvas space and optional R3F dropzones.                      | Generalize the drop tray first slice into reusable overlay and native-file drag adapters.                                                                                                                                        |
| P2       | Custom frame renderers            | done      | Apps need custom window chrome without replacing framework-owned move, resize, focus, body projection, or raster policy.                    | Add a DOM `renderFrame` slot with the built-in frame as the default implementation.                                                                                                                                              |
| P2       | Scene decorations adapter         | planned   | Apps may need shader halos, 3D shells, or scene-native effects around windows without replacing DOM body interactivity.                     | Build reusable decoration helpers on top of read-only window proxies after real use.                                                                                                                                             |
| P2       | Accessibility and focus hardening | risk      | Keyboard commands must not break inputs, text selection, IME, or window body interaction.                                                   | Add focus guards and tests before broad shortcut bindings.                                                                                                                                                                       |
| P0       | Rasterization and LOD pipeline    | planned   | Far zoom readability is a foundational canvas quality; it needs semantic LOD, live DOM scaling, and snapshot lanes.                         | Start with LOD contracts and a lab-backed scaling adapter, then add snapshot caching.                                                                                                                                            |
| P3       | Shader marquee sheen              | defer     | A polished marquee can make the canvas feel premium without changing model semantics.                                                       | Keep marquee rendering behind an adapter so a shader overlay can replace the DOM version.                                                                                                                                        |

## Next Major Tranche

The current high-value tranche is **Framework Extension Foundations**. The
selection and command layer are now the stable interaction base; the next
framework-level gap is making the WebGPU scene extensible without leaking
window internals, raw Legend State, or game-specific assumptions into consumer
apps.

Detailed planning, runtime-library notes, and phase acceptance criteria live in
[`SELECTION_AND_KEYBOARD_PLAN.md`](./SELECTION_AND_KEYBOARD_PLAN.md). The new
rasterization track lives in [`RASTERIZATION_PLAN.md`](./RASTERIZATION_PLAN.md).
R3F v10 source-led capability notes live in
[`R3F_V10_CAPABILITY_IDEAS.md`](./R3F_V10_CAPABILITY_IDEAS.md).

Completed slice:

1. Add explicit selection state and pure reducer actions.
2. Add a typed command registry and TanStack Hotkeys core registration boundary.
3. Wire safe commands first: cancel/clear, select all, nudge, reset zoom.
4. Add restrained selected-window visuals and click-selection semantics.
5. Add selected-window group move.
6. Add marquee selection with replace/add/toggle modes.

Next slice:

1. Define a read-only scene extension contract for background, decorations,
   interaction, and diagnostics layers.
2. Add the window proxy spine as the shared geometry mirror for scene features,
   visibility, raster policy, and future overview/minimap work.
3. Keep undo/redo transaction boundaries and selection-bounds operations as
   near-term editor hardening after the extension seam is stable.
4. Expand custom DOM frame rendering only after real consumers need more slots;
   WebGPU decorations should remain a lab until the proxy spine is stable.
5. Evaluate external drag/drop through a lab before exposing broad public APIs.
