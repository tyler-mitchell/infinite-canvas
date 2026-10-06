# Grouping and docking model

> Provenance: This document adapts `03_recommended_hybrid_model.md` from the kek-monorepo windowing corpus.
> A review examined the source on 2026-04-23. The adaptation occurred on 2026-06-10.
> Status: Target. The framework has free-floating windows, selection groups, and snapping.
> The source review covered Dockview, AeroSpace, i3, react-mosaic, and niri/PaperWM.

## Core recommendation

The model has two types:

- **Floating windows.** Implemented.
- **Group shells.** Target.

A group shell is a world object with local layout, movement, and resize.

The layout supports `split`, `tabs`, `accordion`, and later `columns`.

## Why local groups

A monitor fixes the tiling boundary. An infinite canvas has no fixed boundary.

Local regions have these properties:

- Docked windows remain in the selected region.
- A "work cluster" can exist anywhere and can move as one object.
- A window can leave the group without a new identity.

This model is close to the Dockview group model. It does not use one monitor-root tree.

## Data model: n-ary over binary

Use an n-ary container tree. Binary BSP requires extra nesting for tab groups, multiple siblings, and insertion of a third sibling.

AeroSpace containers, react-mosaic, and Dockview groups provide n-ary precedents.

- The topological model is an n-ary container tree.
- Split children have weights.
- Normalization flattens one-child split containers and redundant splits with the same orientation.
- Normalization keeps one-child tab and accordion containers because they contain semantic state.
- A debug configuration can disable normalization.

## The four user states

1. A **free-floating window** has a world rectangle, z-order, direct movement, resize behavior, and neighbor snapping. It can dock into a group.
2. A **split group** has a shell rectangle, an orientation, children, and weights. A child resize changes its share inside the shell. It does not change DOM widths.
3. A **tab or accordion group** has one shell and one active child. Other children remain members but can stay hidden.
4. A later **columns group** has a scrollable strip. A new child does not resize existing children.

The fourth state uses the niri/PaperWM behavior.

## Floating-to-group context

A floating window can keep a nearby-group context link while it remains floating.

The AeroSpace rule selects the smallest group whose area contains the center of the floating window.

The link supports directional focus, docking suggestions, and "return to nearby group" behavior.

Persist the floating rectangle. Derive the context parent, or persist it as non-authoritative data.

## Local vs global snapping

Two systems remain separate from one "snap anywhere" mechanic:

- **Local group snapping:** This system places a window at a group edge, merges at the center, or reorders a tab.
- **Global world snapping:** This system aligns floating windows and shells, applies named layouts, or places objects inside the viewport.

Most world snapping exists. See [snapping.md](snapping.md).

## Layout recipes

PowerToys Workspaces, Rectangle Pro, and Raycast layouts support "Restore a whole arrangement". A recipe restores shell
positions, internal layouts, tab/accordion membership, preferred body
mount/mode, and optional relative placement.

The recipe model determines serialization boundaries and command design. Define it with the group model.

See [state-focus-and-recipes.md](state-focus-and-recipes.md).

## Rejected models

- A single root tree applies monitor semantics to the canvas and removes free spatial composition.
- Dashboard grid math from GridStack or React-Grid-Layout does not own the base model.
- DOM layout measurements do not determine canonical docking state.

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

## Build order

The corpus phases 0 through 2 cover seams, floating windows, and the snapping engine. These parts exist in the framework.

Build the remaining parts in this order:

1. **Local dock groups with split mode.** Add shells, insertion regions, creation from floating windows, tear-out, empty-group cleanup, and normalization.
2. **Tabs and accordion.** Add center merge, reorder, mode conversion, active-child state, and local keyboard focus.
3. **Keyboard command grammar.** Add directional focus, movement, resize, named placements, layout changes, rectangle restore, normalization, and balance.
4. **Saved layout recipes.** Add named recipes, selection or cluster capture, and placement in a world region.
5. **Columns mode experiment.** After split and tabs are stable, add this mode.

Drag actions and commands must use the same canonical mutations.

Each phase must include an explicit command interface, serializable state, and acceptance tests. See [acceptance-scenarios.md](acceptance-scenarios.md).

No state can exist only in React or the GPU.
