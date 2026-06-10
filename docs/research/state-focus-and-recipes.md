# State Boundaries, Focus Model, and Layout Recipes

> Provenance: adapted 2026-06-10 from the kek-monorepo windowing corpus
> (`05_state_focus_and_persistence.md`, verified 2026-04-23). The three-tier
> state boundary is implemented in the framework; the group-aware focus model
> and recipes are unbuilt and will matter as soon as grouping lands.
> Precedents verified at authoring time: Dockview's serialization/constraint
> split, AeroSpace/i3 command grammars, tldraw's record/render split.

## The three-tier boundary — implemented; protect it

1. **Persistent document/layout state** — what the layout _is_: window
   identity, titles/metadata pointers, floating world rects, z-order, camera,
   selection. With grouping: group shells, container trees, tab/accordion
   membership, split weights, saved recipes, optional last-floating-rect /
   last-dock-path history.
2. **Runtime session state** — what the user is _doing_: interaction
   snapshots, hover, drag/resize operations, snap result, docking preview,
   focused window/group, contextual-group hints. Discardable, recomputable.
3. **Render/runtime caches** — how to _draw it_: projected screen rects,
   snapshot textures, DOM measurement caches, spatial indexes, visibility
   status.

The framework already strips tier 2 from persistence and keeps the raster
cache outside serialized state. Rule to preserve: **runtime constraints stay
runtime-only** (viewport-visibility minimums, snap deadzones at viewport
edges, drag bounds, keep-titlebar-reachable rules) — they depend on viewport/
zoom and must never serialize.

## Focus model — open (designed for the grouping tranche)

- **Group-local focus first**: inside a group, directional focus resolves
  within the group's layout semantics (split = directional neighbors,
  tabs/accordion = local ordering).
- **Global fallback**: no valid local target → global directional focus among
  nearby floating windows and group shells.
- **Floating windows participate** via the contextual parent (smallest group
  containing the window's center) so floating windows don't need a separate
  keyboard model. This is the direct mitigation for the "focus model
  fragments" risk.

## Command grammar — partially exists, grows with grouping

Today: cancel, select-all, nudge, fit-all/fit-selection, reset zoom, lifecycle
commands — all through the typed command layer. The grammar to grow into:
directional focus, directional move/resize, layout-mode set
(split/tabs/accordion/columns), dock left/right/top/bottom/center, float
toggle, balance/normalize/flatten, apply recipe, restore previous floating
rect, send to new group shell.

**The invariant that matters:** every layout-changing interaction — drag or
keyboard — compiles to a small set of canonical mutations (move, resize,
create group, insert child, reorder child, change layout mode, tear out,
remove empty group, apply recipe). One mutation language is what keeps
undo/redo, persistence, and multiplayer tractable. The framework's
command-descriptor layer is already shaped for this.

## Persistence layers — A exists, B/C open

- **A. Live layout document** — current windows/positions (implemented:
  versioned, validated, document-scoped).
- **B. Named layout recipes** — reusable arrangements applied to the current
  canvas or a selected region. A recipe expresses: relative placements, group
  shell topologies, internal layout modes, optional absolute shell rects,
  optional content-type matching hints, optional post-apply focus. Keep
  recipes independent from concrete runtime window instances.
- **C. Per-window history** — last floating rect, last dock target, recent
  group membership (enables good tear-out and "restore previous rect").

Recipes are core architecture, not a late feature: they force serialization
boundaries and command design to stay honest, and they're a validated user
need (PowerToys Workspaces, Rectangle Pro, Raycast layouts).
