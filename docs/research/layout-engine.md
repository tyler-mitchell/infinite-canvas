# Layout engine: ontology and research basis

Started 2026-09-17. Status: research complete against the criteria below; see "Recommendation". Every
finding cites what was read and how much of it. The coverage map is the first plan; the survey table and
the findings show what was read.

## Objective

Choose the ontology, data model and algorithms for a ground-up layout and group engine in
`packages/infinite-canvas/next`. It replaces `next/layout.ts`, `next/groups.ts` and the group parts of
`next/state.computed.ts`. `react-grid-layout` leaves.

## Fixed constraints (owner directives)

- Pure function of data: numbers in, rectangles out. No DOM reads. A WebGPU driver must be able to run on the
  same data when HTML-in-canvas ships and DOM content becomes a texture.
- Flat, typed data is preferred over object graphs.
- Highly configurable and headless, with exceptional consumer ergonomics.
- Lowest code footprint that meets the requirements. No hand-made machinery where a maintained tool exists.
- Grounded in established terms and in current research, read at the source, not recalled.
- No dependency is added without the owner's consent.

## Questions

1. **Ontology.** What are the established names and definitions for: a container that arranges children, a
   leaf, a constraint passed down, a size passed up, a placement, a track, a gutter, a dock, a tab stack, a
   split? Which vocabulary is the most widely shared (CSS, Flutter, tiling window managers, docking
   libraries, constraint-layout research)?
2. **Protocol.** Which layout protocol fits: single-pass constraints-down/sizes-up, multi-pass measure and
   arrange, or a constraint solver? What does each cost, and what do current engines use?
3. **Container algorithms.** What are the defined algorithms for split, stack, tabs, grid, flex and masonry?
   Which have formal specifications we can implement to the letter?
4. **Free placement.** What research covers packing, vacancy search, overlap removal, alignment and snapping
   on an unbounded plane?
5. **Interaction.** How do engines turn a drag into a layout change so that preview and commit are the same
   computation (docking, reorder, resize of tracks)?
6. **Incremental and parallel evaluation.** What is known about incremental relayout and about GPU or
   data-parallel layout? What data layout does that work assume?
7. **Spatial index.** Which rectangle index fits hit testing, marquee, snap candidates and culling?
8. **Configurability and ergonomics.** How do the best engines expose configuration without leaking
   mechanism?

## Completion criteria

Each question has an answer with sources, or is marked unresolved with the missing evidence named. The
document ends with one recommended ontology, one protocol, a data layout, and a list of algorithms with their
specifications, plus what we would build and what we would take from a library.

## Coverage map (provisional, nothing read yet)

| Area                     | Candidate sources                                                                             | State                |
| ------------------------ | --------------------------------------------------------------------------------------------- | -------------------- |
| Box-constraint protocol  | Flutter layout docs and `RenderBox` contract                                                  | not read             |
| CSS formal algorithms    | CSS Flexbox L1, CSS Grid L2, CSS Grid L3 (masonry), CSS Box Sizing L3/L4                      | not read             |
| Engines                  | Yoga, Taffy (Rust), Clay, Morphorm                                                            | not read             |
| Constraint solving       | Cassowary (Badros, Borning, Stuckey 2001), Kiwi, ORC Layout (Jiang et al., CHI 2019/2020)     | not read             |
| Tiling and docking       | i3 / sway tree, bspwm, Hyprland dwindle; Dockview, FlexLayout, Lumino, rc-dock                | not read             |
| Packing                  | MaxRects and Skyline (Jylänki 2010), squarified treemaps, overlap removal (PRISM, VPSC)       | not read             |
| Parallel and incremental | Meyerovich and Bodik 2010 (parallel CSS layout), Servo layout, incremental attribute grammars | not read             |
| Rectangle index          | R-tree (Guttman 1984), RBush, flatbush, uniform grid, BVH                                     | not read             |
| Substrate                | thi.ng/umbrella, mathcat — see memory note `thing-umbrella-evaluation`                        | evaluated secondhand |

## Literature survey (secondhand, 2026-09-17)

A Sonnet sub-agent opened each page below and reported what it contributes. These are **leads with verified
URLs, not findings**. A source moves to "Findings" only after it is read here.

| Area                            | Source                                                                                                                                                                                                                        | URL                                                                    | Read here?                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------- |
| Incremental relayout            | Kirisame, Wang, Panchekha, "Spineless Traversal for Layout Invalidation", PLDI 2025                                                                                                                                           | arxiv.org/abs/2411.10659                                               | yes                         |
| Parallel layout                 | Meyerovich and Bodik, "Fast and Parallel Webpage Layout", WWW 2010                                                                                                                                                            | dl.acm.org/doi/10.1145/1772690.1772763                                 | no                          |
| Parallel layout in practice     | Anderson et al., Servo experience report, ICSE-SEIP 2016                                                                                                                                                                      | arxiv.org/pdf/1505.07383                                               | no                          |
| Incremental computation         | Hammer et al., Adapton, PLDI 2014                                                                                                                                                                                             | dl.acm.org/doi/10.1145/2594291.2594324                                 | no                          |
| Constraint solving              | Badros, Borning, Stuckey, Cassowary, TOCHI 2001                                                                                                                                                                               | constraints.cs.washington.edu/solvers/cassowary-tochi.pdf              | no                          |
| Grid and flow unified           | Jiang et al., ORC Layout, CHI 2019; ORCSolver, CHI 2020                                                                                                                                                                       | arxiv.org/pdf/1912.07827                                               | ORC 2019 yes; ORCSolver no  |
| Grid generation by optimisation | Dayama et al., GRIDS, CHI 2020                                                                                                                                                                                                | arxiv.org/abs/2001.02921                                               | no                          |
| Packing                         | Jylänki, "A Thousand Ways to Pack the Bin", 2010                                                                                                                                                                              | github.com/juj/RectangleBinPack (PDF)                                  | yes                         |
| Stable packing                  | Bederson et al., Ordered and Quantum Treemaps, TOG 2002; Bruls et al., Squarified Treemaps, 2000                                                                                                                              | cs.umd.edu/~ben/papers/Bederson2002Ordered.pdf                         | no                          |
| Overlap removal                 | Gansner and Hu, PRISM, JGAA 2010; Dwyer, Marriott, Stuckey, VPSC, GD 2005                                                                                                                                                     | people.eng.unimelb.edu.au/pstuckey/papers/gd2005b.pdf                  | no                          |
| Snapping                        | Bier and Stone, Snap-Dragging, SIGGRAPH 1986                                                                                                                                                                                  | www2.eecs.berkeley.edu/Pubs/TechRpts/1988/CSD-88-416.pdf               | no                          |
| Intrinsic size terms            | CSS Box Sizing L3 and L4                                                                                                                                                                                                      | w3.org/TR/css-sizing-3                                                 | L3 sections 2, 3.1          |
| Relative placement              | CSS Anchor Positioning L1                                                                                                                                                                                                     | w3.org/TR/css-anchor-position-1                                        | no                          |
| Flex algorithm                  | CSS Flexbox L1, section 9.7                                                                                                                                                                                                   | w3.org/TR/css-flexbox-1                                                | 9.7 yes                     |
| Tiling trees                    | bspwm (binary tree, split ratio), Hyprland dwindle (split direction from live aspect ratio), river (layout generator as an external pure function), Zellij (swap layouts by pane count), niri and PaperWM (scrollable tiling) | see findings                                                           | yes, except Hyprland master |
| Docking models                  | Dockview, Lumino DockPanel, golden-layout, rc-dock, VS Code `gridview`/`splitview`                                                                                                                                            | github.com/microsoft/vscode/tree/main/src/vs/base/browser/ui/splitview | FlexLayout, VS Code         |
| Rectangle indexes               | Guttman R-tree 1984; R*-tree 1990; Hilbert R-tree 1994; RBush; loose quadtree (Ulrich 2000)                                                                                                                                   | see survey                                                             | Flatbush only               |

Two gaps the survey states plainly, to be treated as unproven until checked: it found **no credible work on
general box or grid layout running in GPU compute shaders** (nearest: Superconductor, a 2013 workshop paper
on visualisation; GraphWaGu, force-directed graphs on WebGPU), and **no formal specification of drag-to-dock
semantics**; every docking library defines its own.

## Current system (what is replaced)

Read in full on 2026-09-17: `next/layout.ts` (627 lines), `next/groups.ts` (145), group computeds in
`next/state.computed.ts`.

- A group is `{ id, title, rect, rootId, nodes }`; a node is a window leaf or a container with
  `layout: split | tabs | accordion | masonry`, an `axis`, and weighted children.
- Layout is one recursive pass from the group rect down. Split divides by weight. Tabs and accordion show one
  child. Masonry delegates to `react-grid-layout` for compaction, move and resize.
- Floating windows are outside any layout; placement uses `getVacantRect`, a fixed ring search.
- Gestures feed the same layout function as "operations", so preview equals commit. This property must stay.
- Known defects: no size constraints flow from children to containers except a global `minPaneSize`; masonry
  was broken by an in-place mutation and is patched with a clone; membership lookups are repeated in four
  places in `state.ts`.

## Findings

### Q2 Protocol — Flutter box constraints (read in full)

Source: "Understanding constraints", docs.flutter.dev/ui/layout/constraints, Flutter 3.47.2, page updated
2026-07-31, read 2026-09-17.

- The rule: **"Constraints go down. Sizes go up. Parent sets position."**
- A **constraint** is four numbers: minimum and maximum width, minimum and maximum height. A parent may give
  each child a different constraint. The child answers with one size inside it. The parent then positions the
  child and reports its own size upward.
- It is designed as **one pass**. The stated costs: a box cannot choose any size it wants, does not know its
  own position, and its final geometry depends on the whole tree.
- Vocabulary worth adopting: **tight** (min equals max: one exact size), **loose** (min is zero),
  **unbounded** (max is infinite), **intrinsic** size (a box's natural size, for example text).
- Three box behaviours: as big as possible, same size as the children, a particular size.
- **Flex** (Row, Column): with a bounded main axis it takes all space; with an unbounded main axis it
  shrink-wraps and flexible children are an error. The cross axis must be bounded. A flexible child's own
  preferred size is ignored; space is shared by `flex` factor. Proportional-to-content sharing is stated as
  impossible in this model.
- Fit for us: a group container gets a tight constraint (its rect). A split pane shares the main axis by
  weight exactly as flex factors do. A content-height window is a leaf with an intrinsic height under a tight
  width. An unbounded axis maps to a masonry column that grows. The open point is min-size propagation
  upward, which this page does not cover (Flutter handles it with separate intrinsic-dimension queries).

### Q2 Protocol — Taffy (README read; architecture docs not yet)

Source: github.com/DioxusLabs/taffy README on `main`, read 2026-09-17.

- A Rust library that implements CSS **Block**, **Flexbox** and **Grid** "faithfully" to the specifications.
  It powers Servo, Bevy, Zed (GPUI), Slint, Blitz and Floem, so it is the current reference engine outside
  the browsers.
- Model: a tree of nodes addressed by id, each with a `Style`; `compute_layout(root, available_space)` fills
  a per-node `Layout` (size and location). Available space can be a definite length, `MIN_CONTENT` or
  `MAX_CONTENT`.
- Measured cost, layout only, M1 Pro: about 0.33 ms for 1,000 nodes, 4 ms for 10,000, 39–250 ms for 100,000.
  At canvas scale (tens to hundreds of nodes) a full CPU relayout costs well under a frame. This weakens any
  case for GPU layout on performance grounds alone.
- WASM bindings are work in progress (PR 394), so it is not a drop-in dependency for us today.
- **Architecture** (docs.rs/taffy crate page, read 2026-09-17). Each node has a `Style` (input) and a
  `Layout` of position and size (output), optional children, and an optional user "context" used by a
  **measure function** that sizes leaves Taffy cannot size itself (text, images).
- **Two APIs.** The high-level `TaffyTree` owns storage, caching and dispatch. The low-level API is a set of
  traits (`LayoutPartialTree`, `TraversePartialTree`, `CacheTree`, `RoundTree`) plus **one free function per
  algorithm that lays out a single node**: `compute_flexbox_layout`, `compute_grid_layout`,
  `compute_block_layout`, `compute_leaf_layout`, `compute_hidden_layout`, `compute_root_layout`,
  `compute_cached_layout`, `round_layout`. The host owns the tree, the cache, and the choice of algorithm per
  node. The docs recommend this form for a framework that already has its own tree.
- The documented examples store the tree as a `Vec` arena with node ids as indexes: flat storage is the
  supported shape, not a special case.
- Pixel rounding is a separate final pass over unrounded float layouts.
- Lesson for us: the engine is a set of pure per-container functions behind a small tree interface; the
  canvas document already is the tree, so we implement the interface over it and never copy into a second
  tree. Our current `layouts` record in `next/layout.ts` already has this shape in miniature.
- **The interface** (docs.rs `taffy::tree::traits`, `LayoutInput`, `LayoutOutput`, read 2026-09-17). Two
  small traits are enough to run every algorithm:
  - `TraversePartialTree`: `child_ids(node)`, `child_count(node)`, `get_child_id(node, index)`. Only the
    node and its direct children are needed.
  - `LayoutPartialTree`: `get_style(node)`, `set_unrounded_layout(node, layout)`, `get_cache_mut(node)`,
    `compute_child_layout(node, input) -> output`. The last one is the recursion point: a container's
    algorithm calls it for each child and the host dispatches to the right algorithm for that child.
- **What goes down** (`LayoutInput`): `run_mode` (size only, or full layout), `sizing_mode` (honour the
  node's own size styles or not), `axis` (which axis is asked for), `known_dimensions` (width and/or height
  fixed by the parent — the question "what is your height if your width is W"; both set means "this is your
  exact size, lay out your children"), `parent_size` (for percentages), and `available_space` per axis, which
  is a definite length, min-content or max-content and acts as a soft constraint for wrapping.
- **What comes up** (`LayoutOutput`): `size`, plus the scrollable overflow rectangle, baselines and block
  margin data. For us only `size` and the content extent matter.
- This is the same down/up contract as Flutter, with one addition that answers the open point above: a
  **size-only run mode** with one known dimension is how a parent learns a child's content-driven size
  before it commits space. Our content-height windows and masonry rows need exactly that query.
- Caching is per node, keyed by the input; `compute_cached_layout` wraps any algorithm.

### Q2, Q8 Custom-layout contract — SwiftUI `Layout` protocol (protocol page read in full)

Source: developer.apple.com/documentation/swiftui/layout, iOS 16+ and later, read 2026-09-17.

- A custom container is a value with **two required functions**: `sizeThatFits(proposal, subviews, cache)`
  returns the container's size, and `placeSubviews(in bounds, proposal, subviews, cache)` assigns each
  child a position. The same down/up contract again; the parent **proposes** a size (`ProposedViewSize`,
  each axis may be nil for "your ideal size") rather than a min/max box.
- The container never touches children directly. It gets **subview proxies** it can _measure before
  placing_ (`sizeThatFits` on a proxy), then `place(at:anchor:proposal:)`.
- **Layout parameters are the container's own fields** with defaults (`var alignment = .center`).
  **Per-child inputs** are _layout values_ read from the proxy: a built-in `priority`, plus custom
  `LayoutValueKey`s. That is the clean split between container configuration and child configuration.
- Optional members: a typed **cache** created by `makeCache` and refreshed by `updateCache`, preferred
  `spacing`, alignment guides, and `layoutProperties` (the stack axis).
- Layouts conform to `Animatable`: layout parameters interpolate, so a change of layout animates.
- Ergonomic lesson for us: a container layout is one small value `{ measure, place }` plus typed options; a
  consumer can register its own container layout the same way it registers a window kind. Our `layouts`
  record keyed by container kind is the natural registration point.

### Q2 Single measurement plus intrinsics — Jetpack Compose (page read in full)

Source: developer.android.com/develop/ui/compose/layouts/intrinsic-measurements, updated 2026-09-11, read
2026-09-17.

- Rule: **a child is measured exactly once**; measuring twice throws. This keeps layout linear in tree size.
- When a parent needs information first, it asks an **intrinsic** query, which is separate from measuring:
  `minIntrinsicWidth(height)`, `maxIntrinsicWidth(height)`, `minIntrinsicHeight(width)`,
  `maxIntrinsicHeight(width)`. Each takes the other axis as its input. A row's minimum intrinsic height is
  the maximum of its children's.
- A custom container is a `MeasurePolicy` with one required `measure(measurables, constraints)` and four
  optional intrinsic functions that have approximate defaults.
- Three engines now agree (Flutter intrinsics, Taffy's size-only run mode, Compose intrinsics): the protocol
  is **one measuring pass plus a pure intrinsic-size query on the cross axis**. For us the only intrinsic
  leaf is a content-height window: `minIntrinsicHeight(width)` is its measured content height at that
  width, which `input.contentSizes` already records.

### Q3 Masonry — CSS Grid Layout Level 3, "grid lanes" (read in full)

Source: drafts.csswg.org/css-grid-3, editor's draft, changes listed since the 21 January 2026 Working Draft,
read 2026-09-17. It is a draft: the orientation property is still "TBD" and several issues are open.

- The standard name is now **grid lanes layout** (`display: grid-lanes`); "masonry" and "waterfall" are the
  informal names. Terms: **grid axis** (the axis with tracks), **stacking axis** (the axis items flow in),
  **running position** (per track, how full it is), **auto-placement cursor**, **tie threshold**
  (`flow-tolerance`), **stacking range**, **dense** packing.
- **The placement algorithm (section 4.4), complete:** keep a running position of zero for each track and a
  cursor at the first line. For each item in order: if it has a definite track position use it; otherwise,
  for every line where its span fits, take the largest running position among the spanned tracks
  (`max_pos`); keep the line with the smallest `max_pos` and every line within the tie threshold of it;
  choose the first of those at or after the cursor, else the first; move the cursor to the item's last
  line. Place the item at the maximum running position of its tracks, lay it out, then set those tracks to
  `max_pos + outer size + gap` (size floored at zero, so a running position never decreases). With `dense`,
  an item may backfill an earlier hole only if the hole's tracks have the same total size, so the item is
  never laid out twice.
- **Track sizing (3.4)** is ordinary grid track sizing, except that every auto-placed item contributes to
  every track it could land in. This removes the dependency cycle between placement and sizing; the stated
  cost is that tracks can be larger than needed.
- **Tie threshold:** default `1em`; it exists so nearly equal columns still fill in reading order.
  `infinite` fills strictly in order.
- **Container size (5):** in the stacking axis, the content size is the stacking range: from the first
  item's start edge to the last item's end edge over all tracks.
- **Gaps (6.1):** a gap sits before every item except the first in each track; gaps of a spanning item do
  not join across tracks.
- **Accessibility (2.1):** mixed spans plus mixed heights cause visual backtracking against reading order;
  the spec advises against that combination.
- This gives us a specified, one-pass, O(items × tracks) algorithm with named terms. It replaces the
  `react-grid-layout` dependency, which is a different model (fixed row height, integer row spans, collision
  compaction). Our current `masonry` container is in fact a grid with compaction, not masonry; the two
  should become separate, correctly named layouts.

### Q3 Track sizing — CSS Grid Layout Level 2, section 12 (read in full)

Source: drafts.csswg.org/css-grid-2, section 12 "Grid Layout Algorithm", read 2026-09-17.

- **One track model covers every one-axis division of space.** A **track** has a **min track sizing
  function** and a **max track sizing function**; each is **fixed** (a length), **intrinsic**
  (`min-content`, `max-content`, `auto`, `fit-content()`) or **flexible** (`fr`). A **gutter** is "an empty
  fixed-size track".
- Each track carries a **base size** that only grows and a **growth limit**. Five steps: initialize track
  sizes; resolve intrinsic track sizes; maximize tracks (share free space equally, freezing tracks at their
  growth limit); expand flexible tracks; stretch `auto` tracks.
- **Find the size of an `fr`** (12.7.1): leftover space is the space to fill minus the base sizes of
  non-flexible tracks; divide by the flex-factor sum (floored at 1); if a flexible track would end up below
  its base size, treat it as inflexible and restart. This is the exact rule for weights with minimum sizes.
- Columns are sized first, then rows, then columns once more if row sizes changed an item's minimum
  contribution ("once only"). The second pass exists for items whose width depends on their height, for
  example an aspect ratio.
- Spanning items distribute extra space through a **planned increase** per track so the result does not
  depend on item order.
- The spec says plainly that intrinsic sizing with spanning items is a set of heuristics, not a unique
  solution.
- Fit for us: a **split** container is a one-axis track list whose tracks are `minmax(child minimum, weight
fr)` with gutters as fixed tracks. `Find the size of an fr` replaces our `getGutterWeights` floors and the
  global `minPaneSize`, and it propagates real child minimums upward. Tabs and accordion are track lists
  too (a fixed strip track plus one flexible track). A grid container uses the same function on both axes.
  One track-sizing function would serve split, tabs, accordion, grid, and the grid axis of grid lanes.

### Q7 Rectangle index — Flatbush (README read in full)

Source: github.com/mourner/flatbush README on `main`, read 2026-09-17.

- A **static** index for 2D points and rectangles: a **packed Hilbert R-tree** stored in **one
  `ArrayBuffer`**, which can be a `SharedArrayBuffer` and can be transferred between threads.
- API: `new Flatbush(count, nodeSize?, ArrayType?)`, `add(minX, minY, maxX, maxY)` returns the item index,
  `finish()`, `search(minX, minY, maxX, maxY, filter?)` returns indexes of rectangles that intersect or
  touch the box, `neighbors(x, y, maxResults?, maxDistance?, filter?)` returns nearest-first.
- Measured: indexes 1,000,000 rectangles in 109 ms; 10,000 small searches in 31–150 ms (M1 Pro).
- Static means rebuild on change. At canvas scale a rebuild is microseconds, so "rebuild when the layout
  result changes" is simpler than a dynamic tree. The author's dynamic alternative is RBush (not read).
- It answers exactly the queries thi.ng's `geom-accel` cannot: marquee and culling are `search`; hit testing
  is a zero-area `search` plus a z-order pick; snap candidates are a `search` of the dragged rectangle grown
  by the threshold; nearest window is `neighbors`. Its buffer layout is the flat, GPU-readable form the
  owner asked for.
- It would be a new dependency and needs the owner's consent. It stores `min/max` corners, not
  `x, y, width, height`.

### Q1, Q5 Tiling ontology — i3 (chapter 3 "Tree" read in full; the command list is from excerpts)

Source: i3wm.org/docs/userguide.html, fetched 2026-09-17. Chapter 3 was read in full from the page text. The
command names below came from an earlier summarising fetch that returned direct quotations.

- The reason for one tree, in the authors' words: "In previous versions of i3 we had multiple lists (of
  outputs, workspaces) and a table for each workspace. That approach turned out to be complicated to use
  (snapping), understand and implement." Our `windows` map plus `groups` map plus membership by scan is
  the same mistake.
- "There is no limit on how deep your hierarchy of splits can be", and "split anything": any container,
  leaf or branch, can be wrapped in a new split container.

- One tree holds everything: root, outputs, a content container, **workspaces**, then windows. "The
  building blocks of our tree are so-called **Containers**. A Container can host a window ... Alternatively,
  it could contain one or more Containers." A leaf and a branch are the same kind of node.
- A container has a **layout**: `splith`, `splitv`, `stacking` (one visible child, a vertical title list),
  `tabbed` (one visible child, a single title row). Orientation follows from the layout.
- Named operations on the tree: `split` (wrap the focused container in a new split container), `layout`
  (change a container's layout), `focus parent` / `focus child` (move the selection up and down the tree),
  `move` (re-parent; "In some cases, i3 needs to implicitly create a container to fulfill your command"),
  `swap` (two containers exchange position and geometry; not allowed between ancestor and descendant),
  `resize grow|shrink ... px|ppt` (tiled sizes are stored as percentage points of the parent),
  `floating enable|disable|toggle`, `sticky`, `fullscreen`, `mark`.
- **Floating** is a per-container state, not a separate kind of object: the same container leaves the tiled
  tree and is drawn above it, with `floating_minimum_size` and `floating_maximum_size` limits.
- Mapping to our model: our `GroupState.nodes` tree is this tree. Our `tabs` equals `tabbed`; our
  `accordion` is close to `stacking`; `split` plus `axis` equals `splith` / `splitv`. Two differences worth
  adopting: leaf and branch are one node kind, and **selection can sit on any container** (`focus parent`),
  which would replace our separate "window target" and "group target" selection types. A floating window and
  a docked window being the same entity in two states matches our dock and undock actions.

### Q1, Q5, Q8 Docking model — FlexLayout (README read in full)

Source: github.com/caplin/FlexLayout README on `master` (v0.11 demos), read 2026-09-17.

- The model is a JSON tree of three node types: **`row`** (children are tabsets and rows; **a child row runs
  in the opposite orientation to its parent**, so no axis is stored), **`tabset`** (tabs plus the selected
  index), **`tab`** (the leaf: component name plus display text). Extra top-level parts: `global` options,
  up to four **`border`** tabsets on the frame edges, and `subLayouts` for popouts and floating panels.
- **Size is a `weight`**: "The absolute values do not matter, only their proportions."
- **Every change is an action applied to the model** (`model.doAction(Actions.addTab(json, targetId,
DockLocation.CENTER, index))`); GUI gestures emit the same actions and `onAction` can intercept them.
  **`DockLocation`** (center and the four edges) is the docking vocabulary, the same five values our
  `DockEdge` already uses.
- Tabsets are created when a tab is docked to an edge and **deleted when their last tab leaves**, unless
  `enableDeleteWhenEmpty` is false. This is the normalisation rule our `getGroupWithoutWindow` applies.
- **Configuration inherits:** a node attribute defaults to the global attribute of the same name prefixed by
  the node type (`tabEnableClose` → `enableClose`). One place sets a policy for all nodes; a node overrides.
- Undo records one snapshot per gesture, and ignores selection-only actions.
- Rendering is imperative: a tab's geometry is applied without re-rendering its content; a `resize` event
  tells the content. Every rendered element carries a `data-layout-path` for tests.
- Lessons: the alternating-orientation row removes the `axis` field and makes "same-axis nested split" not
  representable, which is exactly the case our `getGroupWithoutWindow` has to flatten by hand. The
  global-then-node attribute inheritance is a proven configurability pattern; our window definitions plus
  per-window overrides already follow it and group containers should too.

### Q6 Incremental relayout — Spineless Traversal (paper read in full)

Source: Kirisame, Wang, Panchekha, "Spineless Traversal for Layout Invalidation", PACMPL 9 (PLDI), article
219, 2025, doi 10.1145/3729322; arXiv 2411.10659 HTML version, read 2026-09-17.

- **Model.** Layout is an **attribute grammar**: a fixed schedule of in-order tree passes; each pass assigns
  fields before and after it visits the children; every field is written once, in one pass; an expression
  reads only `self`, `parent`, `prev`, `next`, `first`, `last`. All other computation is pure, with no loops.
  A sum over children is a running field on each sibling (`HA = prev.HA + self.H + gap`), not a loop. The
  paper states that flexbox, intrinsic sizes and line breaking are expressible this way (about 50 fields, 700
  lines of DSL, flexbox takes 9 intermediate fields and 2 passes).
- **Direction of data.** Width runs parent to child, height runs child to parent, `x` and `y` run in order.
  Intrinsic sizes run bottom-up, feed the top-down width pass, which feeds the bottom-up height pass. Fixed
  sizes (`width`, `min-`, `max-`) **cut dependency chains**; percentages keep them.
- **Dependencies are static.** For each assignment `self.V <- T`, each read `N.U` in `T` means a change to
  `U` must dirty `V` on the inverse neighbour (`next`/`prev` swap, `first`/`last` map to `parent`, `parent`
  maps to all children). Insert and delete dirty every field that reads a neighbour pointer. The compiler
  (Megatron) writes this marking code; it also emits a from-scratch layout used as the correctness oracle.
- **Order rule.** Recompute dirty fields in the same relative order as a from-scratch layout; then each
  field is dirtied at most once per layout. Propagate dirtiness **only when the recomputed value differs**.
- **State of practice.** Browsers use Double Dirty Bit: a dirty bit per field group plus a summary bit on
  every ancestor, so the traversal skips clean subtrees but still visits the ancestors and their children
  ("auxiliary nodes"; 66 for one dirty node on the Google home page).
- **Spineless Traversal.** A min-heap of `(node, field group)` ordered by timestamps from an **order
  maintenance** structure (Bender et al. 2002, two-level labelled lists, O(1) insert and compare). Only dirty
  nodes are touched. New subtrees enter the queue as one "initialise this pass on this subtree" element.
  Dense runs are compressed: after a pop, keep going while the successor is dirty.
- **Measured.** 50 sites, 2216 frames, traces from Ladybird, Intel i7-8700K: 1.80x mean speedup; 2.22x on the
  65.6% of frames that recompute at most 1% of fields; about 2x **slower** on bulk subtree insertion; 17% of
  frames slower overall. The gain is fewer cache misses on trees of thousands of nodes with depth 18 to 53.
  Two dirty bits per node (pre-order fields, post-order fields) was enough.
- **Related-work claims in the paper:** parallel layout schedules (Meyerovich and Bodik 2010; Meyerovich 2013) "have not proven practical", citing Servo's Layout 2013 versus 2020 post. Medea (Liu et al., PLDI 2023) synthesises dirty-bit propagation code.
- **What this means for us (inference).** Our trees are one group: tens of nodes, depth under ten. The
  queue and order-maintenance machinery answers a cache-miss problem we do not have; it must not be built.
  What transfers is the discipline, and Legend State already supplies its mechanism: each layout field as a
  computed that reads only neighbour fields is an attribute grammar with static dependencies, and the
  observable graph does "recompute in dependency order, propagate only on change". The rule to keep is the
  field direction: minimum and intrinsic sizes go up, available size goes down, positions go in order, and
  a fixed size ends propagation. The from-scratch function as the oracle for any incremental path is a test
  method we should copy. The paper is one more source against a GPU or parallel box-layout engine.

### Q4 Packing into free space — Jylänki 2010 (sections 1 to 5 read in full; appendix tables not)

Source: Jukka Jylänki, "A Thousand Ways to Pack the Bin — A Practical Approach to Two-Dimensional Rectangle
Bin Packing", 27 February 2010; PDF from github.com/juj/RectangleBinPack, read 2026-09-17.

- **Terms.** _Online_ packing: each rectangle is placed on arrival and never moved. _Offline_: the whole
  sequence is known, so it can be sorted. _Orthogonal_, _rotatable_, _guillotineable_ (separable by
  edge-to-edge cuts, recursively). The problem is NP-hard; every method here is a greedy heuristic: a **free
  space structure** plus a **scoring rule** over candidate placements.
- **Four free-space structures.**
  - **Shelf**: rows of fixed height. Simple, wasteful. O(1) memory for next-fit.
  - **Guillotine**: a list of pairwise **disjoint** free rectangles; place in a corner, split the L-shaped
    rest in two by a _split rule_; optional _rectangle merge_. Cannot place across a split line.
  - **Maximal rectangles**: a list of **overlapping** free rectangles, each maximal (every side touches a
    placed rectangle or the bin). After a placement, subtract the placed box from every free rectangle it
    intersects (up to four pieces each), then prune any free rectangle contained in another. Proposition 7:
    any rectangle that fits in the free area fits inside one list entry, so no valid placement is missed.
    Worst case 2n² maximal rectangles; "in our tests ... linear in n".
  - **Skyline**: only the top edges of placed rectangles. Lossy, fast; a guillotine "waste map" recovers holes.
- **Scoring rules**: bottom-left, best area fit, best short side fit (BSSF: minimise the shorter leftover
  side), best long side fit, contact point (maximise touched perimeter; Lodi, Martello, Vigo call it
  _touching perimeter_), and "worst fit" inverses, which lost.
- **Results** (ratio to best known bin count, average (worst), 48600 instances per algorithm): online, one
  bin: SKYLINE-BL-WM 1.392 (1.654), MAXRECTS-BSSF 1.408 (1.788). Offline: MAXRECTS-BSSF-BBF-GLOBAL 1.005
  (1.068). Conclusion: "the MAXRECTS algorithms perform the best of all"; sorting by descending short side
  helps every method offline.
- **What this means for us (inference).** Our placement problem is the online one, and it is not bin
  packing: the plane is unbounded, the goal is nearness to an anchor (the viewport centre or a source
  window), not fill ratio. What transfers is the split the paper makes: _free-space structure_ apart from
  _scoring rule_. Maximal rectangles over a bounded search region around the anchor gives an exact "does it
  fit, and where" answer, with Proposition 7 as the guarantee; the score becomes distance to the anchor,
  with contact point as a tie-break so that new windows sit against neighbours. This would replace the
  fixed ring search in `getVacantRect`, which can miss a gap that exists. "Tidy" and "pack selection" are
  the offline case: sort by descending short side, MAXRECTS-BSSF. The author's C++ is public domain; npm
  ports exist (`maxrects-packer`) but target texture atlases with a fixed bin; not yet evaluated.

### Q4 Overlap removal — Dwyer, Marriott, Stuckey 2005 (sections 1 to 4 read; optimal variant and evaluation not)

Source: "Fast Node Overlap Removal", Graph Drawing 2005, PDF at
people.eng.unimelb.edu.au/pstuckey/papers/gd2005b.pdf, read 2026-09-17.

- **Problem name: _layout adjustment_.** Remove overlap while nodes stay "as close as possible to their
  original positions"; this preserves the user's **mental map** (Misue et al.: orthogonal ordering,
  proximity, topology). Objective: minimise the sum of squared displacement.
- **Method.** Solve x, then y. For each axis, a scan line over the rectangles (O(n log n)) emits a linear
  number of **separation constraints** `u + gap <= v`. Overlapping pairs get an x constraint only when the
  x overlap is smaller than the y overlap; the y pass removes what is left. Padding goes in the node size.
- **`satisfy_VPSC`** (variable placement with separation constraints): process variables in constraint
  order; put each in a block at its desired position; while the most violated incoming constraint is
  violated, merge the two blocks and place the merged block at the weighted mean of its members' desired
  positions. O(n + c log c). Not always optimal; an active-set variant is, with worse bounds. **Weights**
  say which nodes should move least. No mathematical programming package is needed.
- **What this means for us (inference).** This is the grounded algorithm for a "tidy" or "resolve overlaps"
  action, and for making room when a window is dropped or grows: weight the dragged or pinned window
  heavily and the others lightly, and neighbours move the least amount needed. It complements maximal
  rectangles: MAXRECTS finds a free place for a _new_ item without moving anything; VPSC moves _existing_
  items the least. The same authors' WebCola library is reported to ship this as a function; that is a
  lead from memory, not verified here.

### Q2 The solver option — ORC Layout (paper read in full; Table 1 values did not survive text extraction)

Source: Jiang, Du, Lutteroth, Stuerzlinger, "ORC Layout: Adaptive GUI Layout with OR-Constraints", CHI 2019,
doi 10.1145/3290605.3300643; arXiv 1912.07827v1, read 2026-09-17.

- **Claim about the field:** "Most layout models can be reduced to linear constraint systems, with the
  exception of flow layouts", because a linear system is a conjunction and flow needs a choice ("to the
  right OR at the start of the next row"). Widget topology is otherwise static.
- **Model:** hard and weighted soft linear constraints over `left, top, width, height`; each widget has
  **min / preferred / max** size constraints. An **OR-constraint** is hard as a whole, each branch soft with
  a weight, so the system stays feasible. Boolean grouping `(A AND B) OR (A2 AND B2)` makes branches switch
  together.
- **Patterns built from it:** flow; cross-cutting equal sizes across sub-layouts; connected sub-layouts
  (widgets move between two toolbars); balanced flow (row counts from the factors of the item count);
  alternative positions; alternative widgets (`size = pref OR size = 0`); optional widgets that vanish by
  priority; flow around a fixed area. The editor exposes **patterns as templates with parameters**; users
  do not write constraints.
- **Solver and cost:** Z3 (SMT, WMax for weighted soft constraints), incremental re-solve for insert, delete
  and move; a resize rebuilds the system. Their own words: under one second for fewer than 175 constraints
  on an Intel i5, and "ORC solving does not yet work at real-time interactive speeds". ORCSolver (CHI 2020)
  is the follow-up on speed; not read.
- **What this means for us (inference).** A general solver is ruled out as the engine's protocol: a second
  per solve against a frame budget of milliseconds, opaque failure modes, and a heavy dependency. Two ideas
  transfer without a solver. (1) **min / preferred / max per item with a priority** is the input vocabulary
  that lets one container express "optional" and "alternative" children; CSS Grid track sizing already
  consumes min and max, so preferred plus priority is the only addition. (2) **Discrete alternatives chosen
  by fit** (row or column, toolbar on top or on the left) is a container-level choice among a few candidate
  arrangements scored by the space they need; Zellij's swap layouts and Hyprland's aspect-ratio split are
  the same idea. This is a per-container function, not a global solve. Cross-cutting equal sizes is the one
  pattern a tree protocol cannot express; CSS subgrid is the tree-shaped answer and is unread.

### Q3, Q5, Q8 Split sizing under constraints — VS Code `splitview` and `gridview` (source, mechanism read)

Source: `src/vs/base/browser/ui/splitview/splitview.ts` (lines 1 to 1360 read) and
`src/vs/base/browser/ui/grid/gridview.ts` (lines 20 to 350 and 1010 to 1410 read), microsoft/vscode `main`,
2026-09-17. Source internals, read for one mechanism: how a production split tree keeps child size limits
true during a drag. `grid.ts` (the directional API) is not read.

- **Item contract:** `minimumSize`, `maximumSize`, `priority` (`Low | Normal | High`), `snap`,
  `proportionalLayout`. A hidden item keeps its place with size 0 and a `cachedVisibleSize`.
- **Model:** the grid is "a tree composition of multiple SplitView instances, orthogonal between one
  another": `branch` and `leaf`, **orientation alternates by depth and is stored only at the root**. A leaf
  is addressed by an index path (`GridLocation = number[]`). Serialised form: `{ type: 'branch' | 'leaf',
data, size, visible? }` with absolute sizes plus the root width and height.
- **Limits go up the tree:** a branch's minimum along its axis is the **sum** of its children's minimums;
  across its axis it is the **maximum** of the children's cross minimums (and the minimum of their cross
  maximums). This is the propagation our engine lacks.
- **One drag algorithm** (`resize(index, delta, sizes, low, high, minDelta, maxDelta, snapBefore,
snapAfter)`): take the sizes **captured at drag start**; items before the sash, nearest first, absorb
  `+delta`, each clamped to its limits, the rest **cascades to the next neighbour**; items after absorb
  `-delta` the same way; `delta` is first clamped to what both sides can give. High priority items move to
  the front of the absorb order, low priority to the end. Because it always starts from the drag-start
  sizes, the result depends only on the current pointer position: no drift, and preview equals commit.
- **Snap:** an item with `snap` hides when the drag passes half of its minimum size beyond the limit, and
  shows again on the way back.
- **Container resize:** with `proportionalLayout`, sizes scale by proportions saved after the last user
  action, clamped; otherwise the delta goes through `resize` by priority. `distributeEmptySpace` then gives
  any rest to items in priority order.
- **Insert sizing is a named policy:** `distribute`, `split(index)` (halve one item), `auto` (distribute if
  the items are already even, else split), `invisible(cachedSize)`.
- **Normalisation on removal:** a branch left with one child is dissolved; if that child is a branch, its
  children are **spliced into the grandparent** (same orientation, because orientation alternates), and the
  grandparent's sizes are restored. Adding next to a leaf replaces the leaf by a new branch that holds both.
- **What this means for us (inference).** Three sources now agree on the tiling tree: i3, FlexLayout and VS
  Code all use branch and leaf with alternating orientation. VS Code shows the two things ours is missing:
  limits that propagate up, and the cascade resize from drag-start sizes. The cascade is a special case of
  CSS Grid's "distribute extra space" with a fixed order, so one track-sizing function can serve both
  resting layout and the drag. Priority, snap-to-hide and the insert sizing policy are proven configuration
  points, each one a small enumerated value, not a callback.

### Q1 Size vocabulary — CSS Box Sizing Level 3 (sections 2 and 3.1 read in full)

Source: w3.org/TR/css-sizing-3, fetched 2026-09-17.

- **The three size properties have standard names: _preferred size_, _minimum size_, _maximum size_.**
  "the minimum size constraint is always the strongest constraint", and the inner size floors at zero.
- **Definite size**: known without layout. **Indefinite size**: not; "Indefinite available space is
  essentially infinite."
- **Available space**: the space a box is laid out into; it is definite, infinite, a **min-content
  constraint**, or a **max-content constraint**. This is the same four-way input as Taffy's
  `AvailableSpace` and Flutter's bounded or unbounded constraint.
- **Automatic sizes**: **stretch-fit** (fill the available space), **max-content** (ideal size with
  infinite space), **min-content** (smallest size without avoidable overflow), **fit-content** =
  `max(min-content, min(max-content, stretch-fit))`. An **intrinsic size** is a min-content or max-content
  size.
- **Contribution**: what a box adds to its container's intrinsic size, measured on its outer size.
- **Preferred aspect ratio**: a ratio that biases sizing "while honoring other sizing inputs".
- For us: these are the words for the engine's item input and for the intrinsic query. A window whose
  height follows its content (`heightMode: 'content'`) has an indefinite preferred block size whose
  max-content size the DOM reports; that one measured number is the only DOM input the engine needs.

### Q3 Flexible length resolution — CSS Flexbox Level 1, section 9.7 (read in full)

Source: w3.org/TR/css-flexbox-1 section 9.7, fetched 2026-09-17.

- Choose grow or shrink by comparing the sum of hypothetical sizes with the container. Each item has a
  **flex base size** and a **target main size**; items are **frozen** one group at a time.
- Loop: share the remaining free space among unfrozen items in proportion to their factors (shrink factors
  are scaled by base size); clamp each by its minimum and maximum; sum the clamp adjustments; if the total
  is positive freeze the minimum violators, if negative freeze the maximum violators, if zero freeze all;
  repeat. "This freezes at least one item", so it ends in at most n rounds.
- Relation to the other two algorithms read: Grid's "find the size of an `fr`" restarts when a track's
  base size exceeds its share, which is the same freeze loop seen from the minimum side only. VS Code's
  cascade is a priority order, not a proportional share. One function with **base size, factor, minimum,
  maximum and an order** as inputs covers all three: proportional share at rest (weights), cascade during
  a sash drag (order from the sash outwards). Flexbox is the only one of the three that handles maximums
  in the proportional case, so its freeze loop is the one to implement to the letter.

### Q1, Q5, Q8 Tiling window managers — bspwm, river, Zellij, niri, Hyprland (consumer documents read)

Sources, all fetched 2026-09-17: bspwm README (full); river `river-layout-v3.xml` protocol (full); Zellij
"Swap Layouts" page (full); niri README and "Configuration: Layout" page (full); Hyprland wiki "Dwindle
Layout" and "Scrolling Layout" option and message tables. Hyprland "Master Layout" is not read.

- **Two families exist.** _Manual_ tiling keeps a tree that the user edits (i3, bspwm, Hyprland dwindle).
  _Dynamic_ tiling keeps only an ordered list and a **layout generator** computes every rectangle from the
  list (dwm, river, Hyprland master, Zellij swap layouts).
- **bspwm (manual).** "represents windows as the leaves of a full binary tree"; an internal node has a
  split _type_ and a _ratio_ in (0, 1). New windows go to an **insertion point** with an **insertion
  mode**: _manual_ (**preselection**: a direction and a ratio chosen ahead of time) or _automatic_ with a
  **scheme**: `longest_side`, `alternate`, `spiral`. An **initial polarity** picks first or second child.
- **Hyprland dwindle** is the same binary tree. Its options are the drop-policy vocabulary: `force_split`,
  `preserve_split`, **`smart_split`** ("conceptually divided into four triangles, and cursor's triangle
  determines the split direction"), `split_width_multiplier`, `default_split_ratio`, `split_bias`,
  `preselect`, `swapsplit`, `rotatesplit`, `movetoroot`.
- **river (dynamic) makes the generator an external pure function.** The compositor sends a
  `layout_demand` (`view_count`, `usable_width`, `usable_height`); the generator answers one
  `(x, y, width, height)` per view, in order, then `commit(layout_name)`. "Layouts are a strictly linear
  list of views ... Any complex underlying data structure a client may use when generating the layout is
  lost in transmission. This is an intentional limitation." A `user_command` string carries settings to it.
- **Zellij swap layouts** pick an arrangement **by pane count**: each candidate has `max_panes`,
  `min_panes` or `exact_panes`; opening or closing a pane "will snap the layout" to the first candidate
  that fits; extra panes fill "breadth first". The same exists for floating panes.
- **niri (scrollable tiling, 2023 to now; PaperWM is the origin).** "Windows are arranged in columns on an
  infinite strip going to the right. Opening a new window never causes existing windows to resize." A
  column holds stacked windows or is `tabbed`. Widths and heights are `proportion` of the view or `fixed`,
  cycled through **presets** (1/3, 1/2, 2/3). The camera is part of the layout: `center-focused-column`
  = `never | always | on-overflow`. **Struts** reserve view edges so "the next window to the side [will]
  always peek out slightly". An **insert hint** shows where a dragged window will land. An overview zooms
  out. Hyprland's scrolling layout copies it: `focus_fit_method` (center or fit), `follow_min_visible`,
  and the actions `consume`, `expel`, `promote`, `swapcol`, `fit active | visible | all`.
- **What this means for us (inference).**
  1. The engine needs **both families** behind one contract. A container holds either a tree the user
     edits, or an ordered list plus a named generator. river's contract is the generator signature:
     `(count, available size, parameters) -> rectangles`. It is the public extension point for custom
     layouts, and it is already flat data in and flat data out, which a GPU driver can also consume.
  2. **Scrollable tiling is the emergent idea that matches this product.** A strip that never resizes
     existing items, inside an infinite canvas, with the camera following focus and neighbours peeking in,
     is the "presentation mode" the owner described for visitors, above all on a phone: one column per
     stop, swipe to move, overview to zoom out. It needs no new machinery beyond a strip container and the
     camera-follow policy; camera stops already exist.
  3. Drop policy has an established vocabulary (insertion point, preselection, automatic scheme, smart
     split by cursor triangle). Our `DockEdge` five-zone rule is one fixed policy among these; it should
     become a configured value.
  4. Swap-by-count plus ORC's "alternatives chosen by fit" gives responsive groups: a group declares
     candidates with count and size conditions, and the engine picks the first that fits.

### Q5, Q8 Affordance checklist — niri (owner-named reference for tiling affordances, not for algorithms)

Sources, github.com/YaLTeR/niri `main`, fetched 2026-09-17, each read in full: README; wiki pages Design
Principles, Configuration: Layout, Tabs, Overview, Floating Windows, Gestures, Fullscreen and Maximize,
Fractional Layout; the action names bound in `resources/default-config.kdl`. Not read: Configuration:
Animations, Configuration: Gestures, Workspaces, Window Rules.

Principles that are requirements for us:

1. "Opening a new window should not affect the sizes of any existing windows."
2. "The focused window should not move around on its own."
3. "Actions should apply immediately": input goes to the final state at once; animation never gates it.
4. Disabled eye-candy costs nothing; an animation still "starts" with duration 0, so there is one code path.
5. "Be mindful of invisible state": keep one saved view position, and forget it on focus change.
6. A window larger than the view aligns top-left. A `proportion` size includes the border and gaps; a
   `fixed` size is the content size.
7. Fullscreen and maximised windows stay "a normal participant of the layout"; the user can scroll away.
8. Sizes round to physical pixels (`round(logical * scale) / scale`); view offsets do not, tile positions
   round when emitted. Taffy's rounding pass is the same rule.

Affordances, as a checklist against `next`:

| Affordance (niri name)                                                                                              | State in `next`                                                    |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Strip of columns; a column stacks windows or shows them as tabs (`toggle-column-tabbed-display`)                    | missing: no strip container; tabs exist                            |
| `consume-window-into-column`, `expel-window-from-column`, `consume-or-expel-window-left/right`                      | missing as actions; dock and undock cover part                     |
| `focus-column-left/right/first/last`, `focus-window-up/down`                                                        | `focusDirection` exists (geometric); no first or last              |
| `move-column-left/right/to-first/to-last`, `move-window-up/down`                                                    | missing (reorder inside a container)                               |
| `switch-preset-column-width(-back)`, `switch-preset-window-height`, `set-column-width "50%"`, `reset-window-height` | `resizeWindow` exists; no presets, no proportion, no reset         |
| `maximize-column`, `expand-column-to-available-width`, `maximize-window-to-edges`, `fullscreen-window`              | `placeWindow` fill exists; others missing                          |
| `center-column`, `center-visible-columns`, `center-focused-column never/always/on-overflow`                         | `revealWindow` and camera behaviours exist; no follow policy       |
| Struts (neighbours peek in), gaps, fractional gaps                                                                  | `gap` exists per container; no struts                              |
| Insert hint during a drag                                                                                           | drop preview exists                                                |
| Overview: zoom out, drag windows, drag across workspaces, hold to activate                                          | minimap and fit exist; no overview mode                            |
| Floating layer above tiling; `toggle-window-floating`; right click during a drag toggles the target                 | floating and docked exist; no toggle during drag                   |
| Double-click a resize edge: reset height, or full width                                                             | missing                                                            |
| Edge scroll of the view during drag and drop                                                                        | missing in `next` (the old package had edge pan)                   |
| Touch: drag a tiled window sideways scrolls the view                                                                | missing; matters for presentation mode                             |
| Per-output and per-workspace overrides of layout settings                                                           | definitions plus per-window overrides exist; per-container missing |

### Q5, Q8 Transitions between layouts — Motion layout animations (page read in full)

Source: motion.dev/docs/react-layout-animations, fetched 2026-09-17. SwiftUI's `Layout` is `Animatable`
(see the SwiftUI finding); this page is the DOM-side state of practice.

- The technique: **measure** the box before and after a layout change, then animate a `transform`
  (translate and scale) from the old box to the new one. It needs scale correction for children, border
  radius and shadows, `layout="position"` for content that changes aspect ratio, `layoutScroll` and
  `layoutRoot` for scrolled and fixed ancestors, and `LayoutGroup` so that siblings measure together.
  Calculations are **parent-relative**, so a delayed child is not left behind. It is interruptible.
- The View Transitions API animates **snapshots**: not interruptible, blocks pointer input, one transition
  at a time, no scroll compensation (the page's own list).
- **What this means for us (inference).** Every difficulty on that page comes from one fact: the DOM owns
  the layout, so the old and new boxes must be _measured_ and the change faked with scale. Our engine
  _computes_ both boxes. A transition is then interpolation of rectangles the engine already has: no
  measurement, no scale distortion (we set real width and height on a transformed world), interruptible by
  construction, and the same code drives DOM today and GPU quads later. The contract is: the engine returns
  target rectangles; a presentation layer owns the current rectangles and moves them to the targets with a
  configured transition (spring, duration, per-item delay for stagger, `arc` path). Motion values already
  carry springs in this repo; the engine must not own time. Identity across containers (a window leaves a
  split and joins a strip) is free because rectangles are keyed by window id in world space, which is what
  `layoutId` emulates.

### Q3 The portfolio board's packer — design handoff and CSS Grid Level 2 section 8.5 (both read in full)

Sources: `docs/handoff/design_handoff_scatter_canvas/README.md` (full) and `packItems` in
`docs/handoff/LayoutEnginePOC.dc.html` lines 1053 to 1130; w3.org/TR/css-grid-2 section 8.5, fetched
2026-09-17.

- The owner's portfolio design states its layout requirements: 45 widgets on a column grid, **cols
  16/13/10/8/6 at widths >= 1120/880/660/470/below**, gap 12, cell = `(width - gaps) / cols`; each widget
  has a column and row span, and an expanded span; spans scale with the column count down to a per-widget
  floor; **"Derive expanded sizes from content, never from a row count"**; category filters hide widgets;
  **"one layout function, any depth"**: a widget unfolds into a nested board that uses the same packer,
  children spring outward with a stagger; a swiped inbox card previews its destination slot.
- The prototype's packer is "Bitmap first-fit: scans top-left for the first free footprint", and it says
  why: "A skyline packer cannot backfill, which is what left the canvas full of dead air."
- That is, to the letter, the **CSS Grid auto-placement algorithm with `dense` packing** (section 8.5 step
  4): an **occupied / unoccupied cell** grid; for each auto-positioned item in order, reset the
  **auto-placement cursor** to the start, advance by column then by row until the item's area overlaps no
  occupied cell, creating implicit rows as needed. Step 1, "Position anything that's not auto-positioned",
  is the rule for an item the user dragged to a cell: it becomes a **definite position** and the rest flow
  around it. `sparse` packing keeps the cursor moving forward and never backfills.
- The prototype adds one consumer rule: 1x1 tiles may not share an edge with another tile, relaxed in
  steps when no legal cell exists. That is a **placement predicate** supplied by the consumer, not engine
  behaviour.
- Correction to an earlier conclusion in this document: the grid that replaces today's `masonry` is grid
  auto-placement (dense or sparse), not Skyline. Lanes (Grid 3) stays a separate container for true masonry.

### Build or take — libraries checked on the registry, 2026-09-17

| Package                                    | Registry facts                                              | Gives                                              | Verdict                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `taffy-layout` 3.0.0 (README read in full) | WASM, 0.9 MB, modified 2026-09-09, one maintainer           | Flexbox, Grid, Block to the CSS specifications     | Not the engine. It needs `await loadTaffy()` before any call, a second retained tree of `Style` and node objects mirrored from our document, and a manual `.free()` on every style, layout and tree. That is a second owner of the tree plus hand-made lifecycle, both banned here. It covers one of our ten algorithms (flexible lengths) and none of tiling drag, strip, lanes, packing or overlap removal. |
| `yoga-layout` 3.2.1                        | WASM, last modified 2024-12                                 | Flexbox only                                       | Same objections, less coverage. README not read.                                                                                                                                                                                                                                                                                                                                                              |
| `flatbush` 4.6.2                           | modified 2026-06, no dependencies                           | Static packed rectangle index                      | Take, with owner consent.                                                                                                                                                                                                                                                                                                                                                                                     |
| `maxrects-packer` 2.7.3                    | modified 2025-08                                            | MAXRECTS for sprite atlases with fixed bins        | README not read. Our use is anchored search on an open plane, so the fit is doubtful; decide after reading it.                                                                                                                                                                                                                                                                                                |
| `webcola` 3.4.0                            | last modified 2022-06                                       | VPSC overlap removal inside a graph layout library | Stale and large for one function. README not read.                                                                                                                                                                                                                                                                                                                                                            |
| `motion`                                   | already a dependency of `infinite-canvas` and `polkadot-ui` | Springs and transitions                            | Take for transitions; the engine does not own time.                                                                                                                                                                                                                                                                                                                                                           |

## Recommendation

This section is the deliverable named in "Completion criteria". Each line cites the finding it rests on.

### Ontology

- **One node kind.** A node hosts content, or arranges child nodes, or both (i3 "Container"; a CSS box; a
  Taffy node; SwiftUI subviews). In this framework the node is the **window**: a window may have a layout
  and child windows. A separate "group" entity, a second id space for tree nodes, and membership found by
  scanning are the multiple-lists design that i3 left. A window with content _and_ a layout is the
  portfolio's "widget that is also a board", at any depth. Selection, stacking, drag, resize, maximise and
  workspace membership then apply to any window, container or not.
- Properties divide as in CSS: **container properties** on the parent (layout kind and its options),
  **item properties** on the child (factor, priority, grid position and span, limits).
- **Item**: the thing a container arranges. Input per axis: **preferred size**, **minimum size**, **maximum
  size** (CSS Sizing 3), plus **priority** and **snap** (VS Code), **preferred aspect ratio** (CSS Sizing 3).
- **Available space**: definite, indefinite, min-content or max-content (CSS Sizing 3; Taffy; Flutter).
- **Container**: arranges items inside a rectangle. Kinds:
  - **split**: a branch of the tiling tree; orientation alternates with depth and is stored once at the
    root (i3, FlexLayout, VS Code). Children carry a flex factor ("weight").
  - **stack**: one child fills the rectangle; presented as **tabs** or as an **accordion** (i3 `tabbed` and
    `stacking`; FlexLayout `tabset`).
  - **strip**: columns on one axis that never resize when one is added; it is longer than its view and the
    camera scrolls it (niri, PaperWM).
  - **grid**: explicit **tracks** and **gutters** (CSS Grid 2).
  - **lanes**: masonry; **grid axis**, **stacking axis**, **running position**, **tolerance** (CSS Grid 3).
  - **generated**: an ordered list plus a named **layout generator**
    `(count, available size, parameters) -> rectangles` (river). This is the consumer extension point.
- **Floating** is a state of a window, not a container (i3, niri). The plane itself has no layout; it has
  **placement** (find a vacant rectangle) and **adjustment** (remove overlap) (Jylänki; Dwyer et al.).
- **Insertion**: **insertion point**, **preselection**, **automatic scheme** (`longest_side`, `alternate`,
  `spiral`), **smart split** by cursor triangle (bspwm, Hyprland); **sizing policy** on insert and remove:
  `distribute`, `split`, `auto` (VS Code).
- **Alternatives**: a container may list candidate arrangements with count or size conditions; the first
  that fits wins (Zellij swap layouts; ORC alternatives).

### Protocol

Constraints go down, sizes go up, the parent sets position (Flutter). One measuring pass per container plus
a pure intrinsic query that never lays out (Compose). Each container kind is one pure function
`(items, available space) -> { size, rectangles }` (Taffy's per-node compute functions; SwiftUI
`sizeThatFits` plus `placeSubviews`; river's generator). Minimums and maximums propagate up: sum along the
axis, maximum of minimums across it (VS Code `BranchNode`). Rounding to device pixels happens once, when
rectangles are emitted (Taffy; niri). No constraint solver (ORC: about one second per solve).

### Evaluation and data

- Incremental evaluation is the observable graph we already have: one computed per group, fields that read
  only neighbours, change propagated only when a value differs. No dirty-bit or queue machinery; our trees
  have tens of nodes (Spineless Traversal). A from-scratch function is the test oracle (same paper).
- The engine takes and returns plain numbers. The track function works on parallel arrays
  (`base, min, max, factor`), which is already the flat layout a GPU pass needs. No GPU layout now: no
  credible work exists, and the PLDI 2025 paper reports parallel layout as not practical.
- Gesture input stays an argument of the same functions, so preview equals commit (current system; VS
  Code's drag-start sizes give the same property without drift).

### Algorithms to implement, each to its specification

1. **Resolve flexible lengths**: Flexbox 1 section 9.7 freeze loop. Serves split, accordion, grid `fr`
   tracks and strip cross-axis sizes.
2. **Cascade resize** from drag-start sizes, with priority order and snap-to-hide (VS Code `resize`). The
   same function as 1 with an order in place of proportional shares.
3. **Track sizing**: CSS Grid 2 section 12, reduced to fixed, flexible and intrinsic tracks.
4. **Lanes placement**: CSS Grid 3 section 4.4. Replaces `react-grid-layout`.
5. **Grid auto-placement**, `dense` and `sparse`, with definite positions for items the user placed and an
   optional consumer placement predicate: CSS Grid 2 section 8.5. This is the portfolio board's packer and
   the true replacement for today's `masonry`; it nests ("one layout function, any depth").
6. **Vacancy search**: maximal rectangles in a bounded region around an anchor, scored by distance then
   contact (Jylänki 2.4). Replaces the ring search in `getVacantRect`.
7. **Layout adjustment**: scan-line separation constraints plus `satisfy_VPSC`, with weights (Dwyer et al.).
8. **Rectangle index** for hit testing, marquee, snap candidates and culling: Flatbush, rebuilt per change.
9. **Alternatives by fit** (Zellij, ORC) and **directional focus** (already in `geometry.ts`).

Transitions are not an engine algorithm: the engine emits target rectangles keyed by window id in world
space; the presentation layer moves current rectangles to targets (Motion finding). This is what makes
"layouts that animate into each other" work between any two container kinds.

### What this unlocks that `react-grid-layout` cannot

Real child minimums and maximums in every container; one drag algorithm without drift; scrollable strips
and the visitor presentation mode built on them; responsive groups that swap arrangement by count or size;
consumer-written generators; exact vacancy search; least-movement overlap removal; animated change between
any two arrangements; and a data path a GPU renderer can read.

### Unresolved, with the missing evidence

- Snapping and alignment guides: Bier and Stone 1986 is unread; equal-gap snapping from the old package is
  the requirement to meet.
- Cross-container equal sizes (ORC "cross-cutting"): CSS subgrid is the tree-shaped answer; unread.
- Drag-to-dock has no formal specification (survey claim, not disproved); we define it with the insertion
  vocabulary above.
- Declined as not needed for the chosen protocol: Cassowary, Adapton, Meyerovich and Bodik, Servo report,
  GRIDS, treemaps, CSS Anchor Positioning. They stay in the survey table as leads.

## Resumption point

Research is complete for the design. Before code: read `next/layout.ts`, `next/groups.ts`, the group
computeds and every consumer of group state again in full, then write the design (document shape, the
container function signature, the action list) against "Recommendation". Read the `maxrects-packer` and
Flatbush API documents before any code that would use them; `flatbush` needs the owner's consent first.
The i3 user guide was read only in excerpts; read its tree section in full if the split design needs it.
