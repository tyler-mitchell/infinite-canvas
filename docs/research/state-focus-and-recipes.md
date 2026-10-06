# State boundaries, focus, and layout recipes

> Provenance: This document adapts `05_state_focus_and_persistence.md`.
> A review examined the source on 2026-04-23. The adaptation occurred on 2026-06-10.
> The framework implements three state tiers. Group focus and recipes remain open until grouping exists.
> The source review covered Dockview serialization and constraints, AeroSpace and i3 commands, and the tldraw record and render split.

## Three state tiers (implemented)

1. Persistent document state contains window identity, titles, metadata pointers, world rectangles, z-order, camera state, and selection.
   Grouping adds shells, container trees, tab and accordion membership, split weights, and recipes.
   It also adds optional last-floating-rectangle and last-dock-path history.
2. Runtime session state contains interaction snapshots, hover, operations, snap results, docking previews, and contextual-group hints.
   It also contains the focused window or group.
   The framework can discard and recalculate this state.
3. Render caches contain projected screen rectangles, snapshot textures, DOM measurements, spatial indexes, and visibility state.

Persistence omits runtime session state and the raster cache.
Viewport-visibility minimums, snap dead zones at viewport edges, drag bounds, and keep-titlebar-reachable rules depend on the viewport and zoom.
These constraints remain outside serialized state.

## Focus model (open)

- Within a group, directional focus uses split neighbors or tab and accordion order.
- With no local target, it searches nearby floating windows and group shells.
- A floating window uses the smallest group that contains its center as its contextual parent.
  This common keyboard model mitigates the "focus model fragments" risk.

## Command grammar (partially implemented)

The typed layer contains cancel, select-all, nudge, fit-all, fit-selection, reset-zoom, and lifecycle commands.
Grouping adds these commands:

- Focus, move, or resize in one direction
- Set split, tabs, accordion, or columns mode
- Dock left, right, top, bottom, or center
- Toggle floating state
- Balance, normalize, or flatten a group
- Apply a recipe
- Restore the previous floating rectangle
- Send the selection to a new group shell.

Each layout interaction must produce canonical mutations:

- Move or resize a window
- Create a group
- Put a child in a group, reorder a child, or remove a child
- Change a layout mode
- Tear a child out of a group
- Remove an empty group
- Apply a recipe.

Drag and keyboard actions use this mutation set.
The common format supports undo, persistence, and multiplayer through the current command descriptors.

## Persistence layers

| Layer                   | Status      | Content                                                                                                                                                               |
| ----------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Live layout document | Implemented | Current windows and positions in a versioned, validated, document-scoped value.                                                                                       |
| B. Named layout recipes | Open        | Reusable relative placements, group topology, and layout modes. Optional values include absolute shell rectangles, content-type matching hints, and post-apply focus. |
| C. Per-window history   | Open        | The last floating rectangle, last dock target, and recent group membership.                                                                                           |

Recipes apply to the full canvas or a selected region and exclude concrete runtime window instances.
Window history supports tear-out and the "restore previous rect" command.

Recipes constrain serialization and commands before grouping ships.
PowerToys Workspaces, Rectangle Pro, and Raycast layouts provide evidence for this need.
