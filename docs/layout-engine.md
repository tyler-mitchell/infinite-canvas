# Layout engine design

Basis: `docs/research/layout-engine.md`, section "Recommendation". This document fixes the model and the
code shape in `packages/infinite-canvas/next`. The group model, `next/layout.ts` and `next/groups.ts`
are replaced. `packages/math` uses the pure `react-grid-layout/core` collision functions.

Current shared contracts:

```ts
import { columnOptions, columnItem, placeGridItems, placeLanes } from "@hyphened/math/cpu";

const options = columnOptions.merge({ type: "'board'" });
const item = columnItem;
```

`columnOptions` and `columnItem` are ArkType schemas. Their inferred types also govern the calculations.
Grid placement accepts target cells separately from authored items. Lane moves use nearest centers
in the original packed layout; resize preserves order. Runtime behavior remains unobserved.

## The governing rule

The engine is a small, general contract. It is not a list of layouts. A consumer must be able to build
niri's behaviours, a docking editor, a dashboard grid, the portfolio board, and layouts nobody here has
thought of, each in a few lines and without private access.

- Every built-in layout is written against the same public contract that a consumer gets. If a built-in
  needs something the contract does not give, the contract is wrong and it changes.
- The niri checklist in the research document is an acceptance check of the contract: for each row, "can a
  consumer express this with public parts". It is not a list of features to hard-code.
- Behaviour is configured by data (kinds, options, policies with named values). A callback is the extension
  point only where data cannot state the behaviour: a custom `measure` and `arrange`, a placement predicate.

## Proof obligations

The claim "one system" is held to these checks. Each is a test or a guard in the suite.

1. No layout name appears outside the file that defines that layout. The state, tree edits, React layer and
   visit read traits that a layout declares, never names. **Violated today**: `tree.ts`, `dockDrop`,
   `containerChild` and `focusWindow` name `split`, `tabs` and `accordion`.
2. Each built-in, written again from public exports only and registered under another name, gives identical
   rectangles on a corpus. Done for `lanes`; not for `split`, `tabs`, `accordion`, `grid`.
3. One conformance suite, exported for consumers, that every layout passes: minimum <= size <= maximum;
   `arrange` reports the size that `size` promised; pure and deterministic; hidden items take no space.
4. Preview equals commit for every layout and operation. Proven for the sash only.
5. Every window action runs on a container window; the schema has one entity kind for layout participants.
6. The hard cases are executable tests on public API only. Present: strip, master and stack, card as board.

## Why the group model goes

Today the document has a `windows` map and a `groups` map. A group holds its own tree of nodes in a second
id space (`window:<id>`, `root`, container ids). Which group a window is in is found by a scan of every
group, in four places. A group repeats what a window already has: a rectangle, a title, selection, a
stacking key, a move drag, a resize drag, alignment, workspace membership. It cannot do what a window can:
maximise, minimise, pin, close. A leaf is always a window and a window can never hold a layout, so the
portfolio's "widget that is also a board, at any depth" cannot be stated. i3 had this design ("multiple
lists ... and a table for each workspace") and left it for one tree because it was "complicated to use,
understand and implement".

## The model

One node kind: the **window**. A window hosts content, or arranges child windows, or both.

```ts
type WindowState = {
  id: string;
  title: string;
  rect: Rect;
  kind?: string;
  data?: unknown;
  layout?: { type: string } & Record<string, unknown>;
  children?: string[];
  item?: Record<string, unknown>;
  // mode, isPinned, capabilities, minSize, maxSize, aspectRatio, heightMode: as today
};
```

- `children` is the ordered list of child window ids. It is the only stored relation. The parent of each
  window is one derived map. A window listed by no parent floats on the plane and uses its own `rect`. A
  docked window keeps its `rect`; it is the size it returns to when it floats again.
- `layout` holds the **container properties**: the kind and that kind's options. `item` holds the **item
  properties** that the parent's layout reads: `factor`, `priority`, grid column, row and spans, `hidden`.
  This is the CSS division, and it keeps `children` a plain list of ids.
- Each layout kind declares an ArkType schema for its options and for its item properties. The document
  schema validates `layout` and `item` through the registered kind, as window `data` is validated through
  the component schema today.
- `kind` is optional when `layout` is present. A window with both is a card that unfolds into a board.
- The input schema also accepts nested authoring, `children: [{ kind: "note", ... }]`, and flattens it, as
  it fills ids from keys today. A consumer writes a tree by hand; the state holds the flat map.
- View state keeps the active child of a tab or accordion window per view, keyed by window id. Selection
  targets stay generic (`type:id`); the `group` target type goes away, and stacking holds top-level windows.
- Workspaces stay a named filter over top-level windows (the tag model of dwm and river). A workspace lists
  top-level windows only; descendants follow their ancestor.

## The layout contract

```ts
type Layout<Options, Item> = {
  options: Type<Options>;
  item: Type<Item>;
  size(input: {
    options: Options;
    items: LayoutItem<Item>[];
    proposal: { width?: number; height?: number };
  }): Size;
  arrange(input: {
    options: Options;
    items: LayoutItem<Item>[];
    rect: Rect;
    active?: string;
    operation?: Operation;
  }): { size: Size; children: Placement[]; controls: Control[]; changes?: Changes };
};
type LayoutItem<Item> = { id: string; item: Item; size(proposal): Size };
```

- `size` is the one size query (SwiftUI `sizeThatFits`, Compose intrinsics). A proposal of 0 asks for the
  minimum, `Infinity` for the maximum, `undefined` for the ideal, and a number asks "what size at this
  width or height". Each item carries the same query, so a height that depends on a width works through
  any depth: a card that is a board reports its board's height at the cell width the outer board gives it.
  A first version returned a fixed minimum and maximum; it could not state that, and it was replaced.
- A leaf answers from its limits, its floating size as the ideal, and the content height the DOM measured at
  that width (`limitedSize`). A synchronous text measurer can answer exactly later; the contract does not
  change.
- The visit places each child in its slot by the item property `align` (`stretch | start | center | end` per
  axis). A child that does not stretch keeps its ideal size (Hyprland's pseudo-tiling; CSS `align-self`).
- `arrange` runs top-down. Constraints go down, sizes go up, the parent sets position.
- A size the content decides (`heightMode: "content"`, or a grid whose rows follow its items) is an
  indefinite preferred size. `arrange` returns the `size` it used, and the parent reads it.
- An `Operation` is the gesture in progress: `move`, `resize`, or `sash`. It is an input of `arrange`, so the
  preview and the commit are one computation. `changes` is what the commit writes to `layout` and `item`.
- `controls` are the interactive parts a layout needs drawn: sashes, a tab strip, accordion headers.
- `configuration.layouts` registers kinds. Built-in kinds register the same way.
- Rectangles round to device pixels once, when the result is emitted.
- One computed per top-level window lays out its whole subtree. The observable graph does the incremental
  work. A from-scratch call is the test oracle.

## Built-in kinds, in the order they are built

1. `split` (explicit `axis`, `gap`; item `factor`), `tabs`, `accordion`. Limits propagate up. The sash drag
   is the cascade from the sizes at drag start; VS Code applies no priority during a drag, so none exists.
2. `grid`: CSS Grid auto-placement, `dense` or `sparse`; a definite position for an item the user placed;
   column count by container width; row span from measured content; optional gap closing (`compact`); an
   optional placement predicate.
3. `lanes`: CSS Grid 3 placement over the same columns; content-driven heights; no rows.
4. `strip`: columns that never resize when one is added, with a camera follow policy. Not built.

The free plane (vacancy search by maximal rectangles, overlap adjustment by separation constraints, the
rectangle index) is a separate module after these. It does not depend on the window tree.

## Modules

| File                       | Owns                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| `packages/math/src/tracks.ts` | Flexible lengths and cascade resize. |
| `packages/math/src/grid.ts` | Grid auto-placement, collision displacement, and compaction. |
| `next/layout/kinds.ts`     | The contract types and `split`, `tabs`, `accordion`.                                               |
| `next/layout/columns.ts`   | Column count by width, cell width, span scaling; shared by `grid` and `lanes`.                     |
| `next/layout/grid.ts`      | `grid`, and `createGrid({ rules })` for a consumer's placement rules.                              |
| `next/layout/lanes.ts`     | `placeLanes` (Grid 3 §4.4) and the `lanes` kind.                                                   |
| `next/layout/dock.ts`      | The dock preview arrangement, shared by the computed state and the insertion query.                |
| `next/layout/tree.ts`      | Tree edits on the window map: dock at an edge, undock with settling, reorder.                      |
| `next/layout/arrange.ts`   | `bindLayout` (validates options and items, erases kind types), `measureWindows`, `arrangeWindows`. |

## What is deleted

`next/layout.ts`, `next/groups.ts`, `next/react/group.tsx` as a separate view, the `groups` map, `GroupState`,
`GroupNode`, `GroupChild`, `GroupMember`, `GroupDrag`, `GutterDrag`, the `group:` target key, group selection,
focus, drag and resize actions, `gutterWeights`, `groupRect`, `groupInput`, `groupMemberships` and its three
repeats, `getWorkspaceWindowIds`, `reconcileWorkspaces`, `renderGroup`, and `react-grid-layout` in the package,
the pack configuration and the workspace catalog.

## Grounding, by algorithm

Each algorithm is graded by what can disagree with it. An "own rule" is product behaviour with no external
reference; it must never be described as exact or grounded.

| Algorithm                                                                                                                   | Reference                                              | Oracle in the suite                                                             | Grade                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Space sharing (`resolveTracks`)                                                                                             | CSS Flexbox 9.7                                        | Chromium's flexbox, 400 random cases, within 1/64 px (`tracks.browser.test.ts`) | executing reference; one stated deviation: factors sum below one still fill                     |
| Divider drag (`resizeTracks`)                                                                                               | VS Code `splitview.ts` `resize`, main, lines 1279–1326 | a transcription of those lines, 500 random cases                                | transcribed reference                                                                           |
| Gap closing (`compact`)                                                                                                     | react-grid-layout 2.2.4 `verticalCompactor`            | the library's own function, 300 random cases                                    | executing reference, kept only while the library is installed                                   |
| Grid auto-placement (`placeGridItems`)                                                                                      | CSS Grid 2 §8.5                                        | hand-written cases only                                                         | read reference, unproven against a browser grid                                                 |
| Lanes placement (`placeLanes`)                                                                                              | CSS Grid 3 §4.4 (Working Draft, captured verbatim)     | a transcription of lines 3–30 without dense backfill, 500 random cases          | transcribed reference; the test browser has no lanes layout (canary in `lanes.browser.test.ts`) |
| Mover wins, displaced items keep their column, entering items take the span of their width, lanes order from pointer height | none                                                   | hand-written cases                                                              | own rules                                                                                       |
| Dock, undock, dissolve, dock preview                                                                                        | none (i3 is the model, not a reference)                | hand-written cases                                                              | own rules                                                                                       |

## The lanes kind: shapes considered

The portfolio board and every dashboard consumer need columns that stack content-driven cards. Three shapes:

1. A `flow: "lanes"` option on `grid`. Rejected: row height, row spans and definite rows have no meaning in
   lanes, so half the grid's options would become inert under one flag. Wrong ontology.
2. A built-in `lanes` kind sharing the column arithmetic with `grid` (`columns.ts`). Chosen: it is the
   spec's own division (Grid Level 2 auto-placement versus Grid Level 3 lanes), and the board is the priority
   consumer.
3. No built-in; the consumer writes it from the public exports. Not chosen as the shipped shape, but it is
   the right proof: obligation 2 is discharged for this kind in `parity.test.ts`, where a `board` kind written
   from the public entry alone gives the built-in's rectangles on 200 random boards.

Lane reordering uses closest-center targeting over the original packed rectangles.
`placeLanes` owns packing; child order remains a canvas concern.

## State of the work

The model swap is done: one window map, containers are windows, the portfolio board runs on a `grid`
container, the group code is deleted. 133 unit tests and 3 browser tests pass; the grades above say what
that proves. Not built: `strip`, the consumer-written lanes parity, the guard for obligation 1, the exported
conformance suite, per-kind default overrides, `snap`, container `padding` for chrome, the free plane.
`react-grid-layout/core` supplies collision displacement and compaction in `packages/math`.

Decisions made while building, which differ from a first reading of the sources:

- Split factors are proportions. The CSS rule that leaves space empty when factors sum to less than one is
  not applied, because a split must always fill its rectangle.
- A definite grid position that is taken or out of range falls back to automatic placement in the same
  column. CSS lets definite items overlap; a board must not.
- Grid moves act on the settled layout. Collision displacement does not restart auto-placement.
- A grid is at least as tall as its rows. A taller rectangle is kept, so a resize can add room below
  the rows (2026-09-21; before, the stored height was not used and a grid could not be resized).
- A container with its own content (`kind`) is never dissolved when its children leave. A split with one
  child and no content dissolves into that child; a tab stack with one child stays.
- Known limits of the contract, stated to the owner on 2026-09-17: no relations between items of different
  containers (a solver's domain); no item alignment inside its slot (CSS `align-self`, Hyprland
  pseudo-tiling), to be added as an item property; no floating layer inside a container (a `free` kind would
  give it); no clip or scroll offset for a container inside a container; one parent per window; whole-root
  recomputation, which suits hundreds of windows and not thousands.
- Not built yet from the contract: `snap` (hide a pane at half its minimum), container `padding` for window
  chrome, per-kind default overrides in the canvas options.

## The model swap, in order

A scratch copy of `next/` from before the swap is in the session scratchpad (`next-before-swap`); `next/` is
not tracked by git.

1. **Types and schema.** `WindowState` gains `layout`, `children`, `item`, `maxSize`; `kind` becomes optional
   (a window needs `kind` or `layout`). `Content.groups`, the group and masonry schemas, `GroupMetrics` and
   `View.groupViews` go; `View.activeChildren: Record<windowId, childId>` comes. Content validation: children
   are live windows, one parent each, no cycles. Layout options and item properties are validated and
   normalised through the registered kinds where window `data` is decoded today. Options gain `layouts`
   (custom kinds); the built-in four are always registered.
2. **Computed.** One `parents` map; `windowRoot`; `topLevelWindows`; `arrangement[rootId]` from
   `arrangeWindows` with the session's operations; `windowRect` = drag rectangle, else arrangement, else the
   window's own rectangle; `windowVisible`; z-index from the root; `dockDrop` (target window and edge under
   the pointer) replaces `groupDrop`.
3. **Session.** Drag kinds: `move` and `resize` for any top-level window, container or not (this replaces
   group move and group resize; the minimum size comes from `measureWindows`); member `move` and `resize`
   become the container's operation; `sash` replaces `gutter`; the tab drag stays.
4. **Actions and commands.** `groupWindows`, `ungroupWindow`, `dockWindow`, `undockWindow`,
   `setWindowLayout`, `setWindowItem`, `reorderChild`, `activateChild`. All group actions go.
5. **React.** A window with a layout draws its controls (tab strip, accordion headers, sashes) from
   `arrangement.controls[id]` inside `WindowView`. `GroupView`, `renderGroup` and `GroupDragHandle` go.
6. **Consumers and tests.** Playground routes, the portfolio board (`masonry` becomes `grid`; storage key
   changes), `tools.ts`, `components.ts`, and the group tests rewritten on the new model. Then
   `react-grid-layout` leaves the package, the pack configuration and the workspace catalog.

## Tests

Each algorithm has a test that states the specification's own rules. Each incremental path is checked
against the from-scratch result. Each test is proved by breaking the behaviour it protects.
