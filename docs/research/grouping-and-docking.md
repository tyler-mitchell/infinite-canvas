# Grouping and Docking Model

> Provenance: adapted 2026-06-10 from the kek-monorepo windowing corpus
> (`03_recommended_hybrid_model.md`, verified 2026-04-23). None of this is
> implemented yet — the framework today has free-floating windows, selection
> groups, and snapping. This is the design for the next major architectural
> tranche. Named precedents (Dockview, AeroSpace, i3, react-mosaic,
> niri/PaperWM) were verified against their docs at authoring time.

## Core recommendation

A hybrid spatial desktop model with two first-class object kinds:

- **floating windows** (exists today)
- **group shells** (unbuilt)

A group shell is a world object that owns its own local layout. It moves and
resizes as one thing on the canvas. Inside, the layout mode may be `split`,
`tabs`, `accordion`, or (later) `columns`.

## Why local groups

A monitor-bound tiling manager uses the monitor as the group boundary; an
infinite canvas has no natural boundary, so the user must be able to create
and move **local layout regions**:

- docked windows are not spread across the whole world by default
- a "work cluster" can be established anywhere and later moved intact
- windows tear out into floating mode without losing identity

Closer to Dockview's group model than a tiling WM's one-monitor root tree.

## Data model: n-ary over binary

Binary BSP is a fine mental reference but too narrow in practice — awkward for
tab groups, panels belonging to one of many siblings, and third-sibling
insertion churn. Validated n-ary precedents: AeroSpace containers,
react-mosaic, Dockview groups.

- topological model: **n-ary container tree**
- split children carry weights
- normalization: flatten single-child containers; avoid redundant
  same-orientation nesting; preserve tab/accordion shells as semantic even
  when momentarily single-child; allow disabling normalization for debugging

## The four user states

1. **Free-floating window** — world rect, z-order, direct move/resize, snaps
   to neighbors, can dock into a group. (Exists.)
2. **Split group** — shell world rect + children with orientation and weights.
   Resizing a child means changing partition allocation inside the shell, not
   mutating DOM widths.
3. **Tab / accordion group** — one shell, one active child; others remain
   members without being fully visible.
4. **Columns group (later)** — scrollable strip layout; appending a child does
   not force existing children to resize (the niri/PaperWM property).

## Floating-to-group context

A floating window optionally retains **context** relative to a nearby group
while staying floating. Practical rule (from AeroSpace): the contextual parent
is the smallest group whose area contains the floating window's center. Gives
smarter directional focus, docking suggestions, and "return to nearby group"
behavior. Persist the floating rect; derive (or soft-persist) the contextual
parent.

## Local vs global snapping

Two systems, deliberately not collapsed into one "snap anywhere" mechanic:

- **local group snapping**: dock into a specific group (left/right/top/bottom
  insert, center merge to tabs/accordion, tab reorder)
- **global world snapping**: align floating windows and shells, named layout
  commands, viewport-safe placement (mostly exists; see
  [snapping.md](snapping.md))

## Layout recipes are core model, not a feature

"Restore a whole arrangement" is a validated core use case (PowerToys
Workspaces, Rectangle Pro, Raycast layouts). A recipe restores shell
positions, internal layouts, tab/accordion membership, preferred body
mount/mode, optional relative placement. It shapes serialization boundaries
and command design — design it with the group model, not after. Details in
[state-focus-and-recipes.md](state-focus-and-recipes.md).

## What not to do

- no single root tiling tree for the whole canvas (monitor semantics don't
  transfer; it destroys free spatial composition)
- no dashboard grid math (GridStack/React-Grid-Layout) as the base model
- docking must resolve in the canonical model first, never from DOM layout
  measurements

## Target shape

```text
world
  contains floating windows and group shells
group shell
  contains its own local container tree
container tree
  split / tabs / accordion / columns semantics
commands + drag/drop
  both compile to the same placement/docking operations
```

## Sequencing (from the corpus build order, phases renumbered to today)

The corpus's phases 0–2 (seams, floating windows, snapping engine) are
complete in the framework. What remains, in recommended order:

1. **Local dock groups with split mode** — shells, insert regions, create
   group from floating windows, tear-out, empty-group cleanup, normalization.
2. **Tabs and accordion** — center-merge, reorder, mode conversion,
   active-child semantics, local keyboard focus.
3. **Keyboard command grammar** — directional focus/move/resize, named
   placements, layout-mode toggles, restore-previous-rect, normalize/balance.
   All compile to the same canonical mutations as drag.
4. **Saved layout recipes** — named recipes, save selection/cluster, reapply
   into a world region.
5. **Columns mode experiment** — only after split/tabs are solid.

Every phase leaves behind: an explicit command surface, serializable state,
acceptance tests (see [acceptance-scenarios.md](acceptance-scenarios.md)), and
no hidden React-only or GPU-only state.
