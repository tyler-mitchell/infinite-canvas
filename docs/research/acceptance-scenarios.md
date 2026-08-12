# Acceptance Scenarios

> Provenance: adapted 2026-06-10 from the kek-monorepo windowing corpus
> (`09_test_scenarios.md`, verified 2026-04-23). These exist to catch
> architecture mistakes, not to check trivial movement.
> If several fail at once, suspect the model boundary, not the interaction code.

**Status vocabulary, rewritten 2026-07-08.** The old vocabulary had one bucket, `open`,
meaning "feature unbuilt **or** untested". Those are opposite problems with opposite
remedies, and collapsing them made this document say _"Docking and groups — all `open`
(grouping unbuilt)"_ over a list in which every DOCK scenario was already marked `done`.
Four buckets now:

| Status    | Meaning                                                                 |
| --------- | ----------------------------------------------------------------------- |
| `covered` | Built, and a test or a live verification asserts this scenario.         |
| `partial` | Built, and something adjacent is asserted, but not this scenario.       |
| `built`   | **Built and entirely unasserted.** Works when tried; nothing guards it. |
| `unbuilt` | The capability does not exist.                                          |

**That headline changed on 2026-08-12.** This paragraph read "No test in the suite touches
groups, history, or recipes" for a month, and that is no longer true: seventeen scenarios moved
from `built` to `covered` when C2 landed and the README-claims audit followed it. What remains
`built` is now a short list rather than the bulk of the document — SPLIT-004, the RENDER family,
and the transactional _sequence_ in PERSIST-003. P1 and P4 were capability-complete
and verification-empty. Three defects found by reading on 2026-07-08 — dock intent dispatched
three times for one pointermove, a grouped window's dead resize handles burying the gutter,
and a mid-drag zoom sliding the window out from under the cursor — map onto DOCK-001,
SPLIT-001, and FAIL-001. The third was found _by writing this document down_, before a line
of it could be run.

## Floating windows

- **FLOAT-001** — Move a window across the world at 0.25x, 1x, 4x zoom.
  Movement stays smooth; no hidden zoom-coupled thresholds. `partial`
  (reducer tests cover move at non-default zoom; no sweep across the range)
- **FLOAT-002** — Resize from each edge and corner. Min/max respected;
  opposite edges stay anchored. `covered`
- **FLOAT-003** — Front A, interact with B, refocus A. Z-order and focus are
  not conflated. `covered`

## Snapping

- **SNAP-001** — Edge snapping engages at the same screen distance regardless
  of zoom. `covered` (screen-pixel thresholds are tested)
- **SNAP-002** — Center snapping works independently of edge snapping.
  `covered`
- **SNAP-003** — Equal-gap snapping among three windows in a row, visually
  distinct. `covered`
- **SNAP-004** — Resize-edge snap: the active edge snaps; the rect doesn't
  jump. `covered`
- **SNAP-005** — Hysteresis: snap holds on small retreat, releases past the
  larger threshold. `covered` (2026-08-12, `snap-resolver.test.ts`) — implemented in
  `snap-resolver.ts`
  (`getCandidateThreshold` widens an engaged guide's threshold to
  `releaseThreshold`, per guide rather than per axis). This entry read `open —
hysteresis unimplemented` until 2026-07-08, long after it shipped.

## Docking and groups — asserted 2026-08-12; keyboard-reachable since DOCK-006

- **DOCK-001** — Drag a floating window beside another → new split group shell.
  `covered` (Alt+drag. `resolveInfiniteCanvasDockPreview` finds the target from the
  canonical model; `applyInfiniteCanvasDockPreview` wraps it in a group occupying the
  rect it already had, then docks the dragged window beside it, so nothing else on the
  canvas shifts.)
- **DOCK-002** — Drag over a group's center → tab merge. `covered` (the centre
  `1 - 2 × centerRatio` of a target is the tab-merge zone; outside it the nearest
  edge wins.)
- **DOCK-003** — Move a group shell → the group moves as one world object. `covered`
  (dragging any member's header starts a `groupMove` interaction; members follow
  because their rects are re-derived from the shell.)
- **DOCK-004** — Tear a child out of a tab group → sensible floating rect; group
  stays valid. `covered` (dragging a tab **out of its strip** undocks the window and hands the
  same pointer to `interaction.startMove`. It keeps the rect the solver gave it — for a
  hidden tab, the size it would have been revealed at — so nothing jumps and nothing swells
  to fill the shell. The trigger was "any 6px of travel" until 2026-07-08, when TAB-001
  needed those pixels for reordering.)
- **DOCK-005** — Remove the last child → empty-group cleanup. `covered`
  (`undockInfiniteCanvasGroupWindow` returns `null`, and `withInfiniteCanvasGroupTree`
  drops the shell.) Note the _last_, literally: a one-member group is a deliberate state
  — `createInfiniteCanvasGroup` has a branch that builds one — so undocking down to one
  leaves a shell holding a single pane rather than dissolving.
- **DOCK-006** — Dock and undock without a pointer. `covered` (2026-08-12. Every group
  gesture was drag-only until then: `resolveInfiniteCanvasDockPreview` reads a world
  point, so the largest feature in the library was unreachable by keyboard — an
  accessibility failure, not a missing convenience. `window.dockDirection` targets via
  `getInfiniteCanvasDirectionalFocusTarget`, so "dock left" reaches exactly the window
  "focus left" would, and lands on the _arrival_ edge — travelling right puts the window
  on the target's west side, matching a drag onto that target's left half.
  `resolveInfiniteCanvasDockPreviewForTarget` produces the same `InfiniteCanvasDockPreview`
  a drop produces and both commit through `applyInfiniteCanvasDockPreview`, so the two
  gestures are one operation by construction. `window.undock` tears the active window out.)

- **DOCK-007** — Break up a group from the product. `covered` (2026-08-12. `group.close`
  existed in the reducer and was dispatched from nowhere but the actions facade, so a user
  could build a group and never take it apart except by undocking one member at a time.
  `group.dissolve` closes the group holding the active window. A split comes apart exactly
  where it was drawn — every member keeps the rect the solver last gave it. **A tab or
  accordion group lands its members in an exact stack**, because hidden members all carry
  the shell's content rect, the rect they would occupy if revealed. That is
  `closeInfiniteCanvasGroup` behaving as it always has, now exposed; giving dissolve a
  fan-out is a separate decision about shared semantics and has not been taken.)

## Split behavior — built, asserted 2026-08-12 (except SPLIT-004)

- **SPLIT-001** — Resizing a child changes weights/partitions; DOM widths are never
  the source of truth. `covered` (dragging a gutter starts a `groupGutter` interaction
  and dispatches `group.setChildWeights`. Each step recomputes from the container
  snapshotted at drag start, so the seam tracks the cursor exactly. No DOM width is
  ever read.)
- **SPLIT-002** — Inserting a third sibling stays stable (n-ary, no binary churn).
  `covered` (the tree is n-ary by construction; docking inserts a child rather than
  splitting a pair.)
- **SPLIT-003** — Normalization flattens a redundant single-child container safely.
  `covered` (`normalizeInfiniteCanvasGroupTree`: a single-child split _is_ its child.
  Tab and accordion shells are semantic and survive. Bottom-up, so one pass reaches a
  fixed point.)
- **SPLIT-004** — Resize the shell by its outer edge: members re-project, no pane
  falls below the structural floor, and the drag is one undo entry. `built`
  (2026-07-08. `groupResize` steps `group.rect`; `getInfiniteCanvasGroupMinimumSize`
  is the floor, measured with the layer's own metrics and captured at drag start.)
- **SPLIT-006** — Flip a container's axis: a row of panes becomes a column and back,
  without moving or resizing the shell. `covered` (2026-08-12. `group.flipAxis`.
  `setInfiniteCanvasGroupAxis` had existed since the group model shipped and was reachable
  by **nothing** — no action variant, no store method, no command — so a user could dock
  windows into a split and never change which way it ran. Now wired end to end: a
  `group.setAxis` action, a `setGroupAxis` facade method, and a command that computes the
  opposite axis. Offered only when the container is not a tab strip, whose layout ignores
  axis entirely.)
- **SPLIT-005** — Equalize returns a container's panes to identical weights, undoing
  accumulated seam drags. `covered` (2026-08-12. `equalizeInfiniteCanvasGroupChildren`,
  reached by the `group.equalizeChildren` command, which targets the active window's
  _parent_ container rather than the whole tree and is disabled when the panes are
  already even. Idempotent; a nested container keeps its own weights.)

## Tabs, accordion, focus

- **TAB-001** — Tab reorder via drag persists; focus stays predictable. `covered`
  (2026-07-08). Where the pointer goes decides what the drag is: inside the strip it
  reorders, leaving the strip tears out. Until then _any_ six pixels of travel tore the tab
  out, so reorder was unreachable by drag no matter how carefully you slid a tab sideways —
  `group.reorderChild` existed and nothing compiled to it. Leaving the strip costs the same
  six **screen** pixels that entering the drag did, because the strip's height is fixed in
  world units and at low zoom a bare `clientY > bottom` would tear on the first wobble.
  Unasserted.
- **TAB-002** — Tabs↔accordion conversion preserves membership. `covered`
  (`setInfiniteCanvasGroupLayoutMode` changes `layout` and touches no child.)
- **TAB-003** — Convert a container's layout from the product, not just the API. `covered`
  (2026-08-12. TAB-002 was covered at the primitive while no user could trigger it:
  `setInfiniteCanvasGroupLayoutMode` was dispatched only from the actions facade, so
  turning a split into tabs was impossible for anyone but a consumer calling the store
  directly. `group.setLayout` exposes all three modes, each offered only when the container
  is not already in that mode. Converting split→tabs relies on normalization filling in a
  live `activeChildId` — a split's is always null — which is exactly why that guarantee
  exists; a test pins it, because otherwise the conversion yields a tab group with no
  visible pane.)
- **TAB-004** — Reorder a pane within its container by keyboard. `covered` (2026-08-12.
  Reordering existed only as a tab drag, so a group's member order was pointer-only in
  exactly the way docking was. `group.moveChild` moves the active window one place toward
  the start or end of its container's order. Clamped rather than wrapping — a pane at the
  end that jumped to the front would read as a bug, and the drag it mirrors cannot wrap —
  so the ends are simply not offered.)
- **ACC-001** — Keyboard navigation follows accordion orientation. `covered` (2026-07-08).
  Each accordion container is one roving tab stop, and its arrows follow
  `container.axis`: a vertically stacked accordion answers Up/Down, a horizontal one
  Left/Right. Hard-coding Left/Right, as a tablist may, would make Down walk a row of
  side-by-side headers — the diagonal drift `window-focus.ts` refuses everywhere else.
  Home/End are axis-independent. Activation stays Enter/Space through the existing
  `onClick`. Unasserted.
- **FOCUS-001** — Directional focus prefers group-local neighbors over global.
  `covered` (inside a group the arrow searches the group's own members first, and only
  leaves the group when nothing lies that way. Windows behind an inactive tab or a
  collapsed fold are never focus targets — nothing draws them. The global tier ranks
  "beside" over "close", so arrows never drift diagonally.)
- **FOCUS-002** — Floating window over a shell: contextual-parent focus behaves
  sensibly. `covered` (2026-07-08). A floating window whose centre lies inside a group's rect
  gets that group as its **contextual parent**, and directional focus searches the group's
  members before the canvas — so a floating window needs no keyboard model of its own, which
  is the mitigation `research/state-focus-and-recipes.md` names for the "focus model
  fragments" risk. Smallest containing group wins, because group rects may overlap and the
  tighter one is the one the window is really in; area ties break on group id, so an arrow
  key is never ambiguous. Membership still takes precedence and short-circuits the scan.
  `getInfiniteCanvasContextualGroup(state, point)` is public. Unasserted.
- **FOCUS-003** — "Left half"-style placement commands resolve through the same
  canonical placement engine as drag snapping. `covered` (2026-07-08). `window.place` takes a
  region — halves, quarters, `fill`, `center` — and `window-placement.ts` is the only thing
  that knows what "left half" means, so pointer and keyboard cannot disagree.
  `Mod+Shift+Arrow`, `Mod+Shift+Enter`; centring and the quarters have no default chord,
  because the canvas `preventDefault()`s every chord it owns and the obvious candidates are
  browser devtools or tab-switching keys.

  **The scenario's clause is met in substance and refused in letter, deliberately.**
  Placement does _not_ route through `applySnapToRect`, which is what drag snapping adds on
  top of a rect. A left half nudged a few pixels to align with the window beside it is no
  longer a left half, and pressing the shortcut twice would give two different rects —
  Rectangle and Magnet do not snap tiles either. What the clause is really guarding against
  is a second hand-rolled placement path, and there is exactly one.

  Placement acts on the **active** window, not the selection: tiling three selected windows
  into one rect buries two of them. It refuses a grouped window, as
  `interaction.startResize` does, because a member's rect is its group's projection. A tile
  narrower than the window's `minSize` grows away from the edge it is anchored to, so a
  too-narrow right half keeps its right edge instead of sliding off screen. Unasserted.

## Persistence

- **PERSIST-001** — Save a cluster (floating + multi-tab group); restore recreates
  positions, membership, modes. `covered` — the envelope is at `version: 2` and
  serializes `groups`; a `version: 1` payload migrates to `groups: []`. No test
  round-trips a group.
- **PERSIST-002** — Persist, reload, compare canonical state: runtime
  previews/constraints/hover are absent from persistence. `covered`
- **PERSIST-003** — Tear out, move, re-dock, undo each step transactionally.
  `covered` — undo/redo over `{ groups, windows }` shipped with P4; a drag is one entry,
  checkpointed at its start. This entry read `open (undo/redo unbuilt)` until
  2026-07-08. The transactional _sequence_ in this scenario is unasserted.

## Columns mode — `unbuilt`, deliberately last

- **COL-001** — Appending a column doesn't resize existing columns.
- **COL-002** — Scroll/pan is local to the shell, not the world.

## Rendering and body mounts

- **RENDER-001** — Focused = live DOM; background = snapshot; far = card.
  Transitions stable, identity preserved. `partial`, and for a different reason than this entry
  gave until 2026-08-12: the **far-card lane is built and asserted**, not "RASTERIZATION*PLAN
  work". `renderSummary` on a window definition plus the hysteresis band in `detail-level.ts`
  decide it on \_effective screen size* rather than raw zoom, so a large window stays legible
  longer than a small one.

  Two halves, tested separately on purpose. `detail-level.test.ts` covers the policy — which
  level applies for a rect, a zoom, and a previous level. `window-raster-body.test.tsx` covers
  the wiring — that the level the policy returns is the one the body actually renders, which no
  policy test can see: a `renderSummary` that never ran, or ran always, would pass all eleven of
  them.

  That distinction is not theoretical here. The policy was correct while the shipped _defaults_
  stranded every 300×210 window as a summary card at 100% zoom, demoting on zoom-out and never
  restoring; it was found by driving the product, not by the green assertions around it, and
  fixed in `aa5f085`. The first wiring test is now that bug's regression guard.

  What keeps it `partial` is the middle lane: snapshots exist behind the `rasterization` prop and
  nothing turns them on, so "background = snapshot" is unexercised.

- **RENDER-002** — Dragging a snapshot-represented window stays coherent.
  `partial` (captures pause during interaction by design; needs an explicit test)

  **Deliberately not tested on 2026-08-12, and the reason is worth stating so it is a decision
  rather than an omission.** The mechanism is real and readable: the scheduler gate pauses on
  `interaction !== null`, and a window under a `move`/`resize` interaction is additionally
  ineligible for capture, so the one you are dragging stays live DOM while its neighbours may
  not. Asserting it end to end means standing up the rasterization provider and a snapshot
  fixture.

  That cost buys coverage of a lane that is **off by default, marked experimental, and slated
  for replacement**: P7 rebuilds the capture path on `html-in-canvas`, with `@zumer/snapdom` as
  the fallback. Tests written against the current scheduler would be rewritten with it. The
  higher-value work with the same effort was `group-layout.ts` — the solver every grouped window's
  rect comes from, which had zero coverage and is not going anywhere.

  Revisit when P7 lands, when the lane is turned on by default, or if a snapshot defect is ever
  observed in use — whichever comes first.

- **RENDER-003** — Offscreen culling doesn't break selection or restoration.
  `unbuilt` — there is no culling. `visibility.tsx` is a diagnostics probe behind
  `/scene`, not a culling source; the predicate a culler would use is
  `isWorldRectWithinViewport`. See ROADMAP P2 tranche 2 on why culling must not
  unmount.

## Failure-oriented

- **FAIL-001** — Zoom mid-drag: snap feel stays screen-space stable.
  **Suspected defect, found by reading 2026-07-08 — this scenario earns its keep before
  a line of it is executed.** Every drag captures `zoom` at `startMove` and every step
  computes `screenDelta / interaction.zoom`. The wheel handler is not gated on an active
  interaction, so a zoom mid-drag converts the whole accumulated screen delta at a stale
  scale.

  Grab a window at zoom 1 and drag 100px right: world +100. Zoom to 2. Drag another
  100px. `screenDelta` is now 200, divided by the captured zoom 1 → world +200. The
  correct displacement is 100 (at zoom 1) + 50 (at zoom 2) = **+150**. The window slides
  50 world units out from under the cursor, and keeps sliding.

  **Fixed the same day.** `getInteractionWorldDelta` derives the world delta from two
  screen→world projections — the origin pointer under the origin camera, the current
  pointer under the current camera — instead of one cached scalar. `zoom` is gone from
  `move`, `resize`, `groupMove`, `groupResize`, and `groupGutter`; each now stores
  `originCamera`, which `pan` has always stored, because a pan _is_ a camera change and
  could not have been written any other way.

  The edit is a strict generalization rather than a rewrite: `screenPointToWorldPoint` is
  `center + (p - viewport/2) / zoom`, so for an unchanged camera the `center` and
  `viewport` terms cancel and the difference is exactly `(p - origin) / zoom` — the
  expression it replaces, to the bit. A static camera behaves identically.

  `covered` by `acceptance-scenarios.test.ts`, which drives the doc's own arithmetic through the
  real `camera.zoomAt` path and additionally asserts the invariant behind it — the grabbed world
  point stays pinned to the cursor across an arbitrary zoom.

  **Asserted is not observed.** Nobody has zoomed mid-drag and watched the window stay under the
  cursor, and this line said "still unasserted" for both facts until they were separated on
  2026-08-12.

- **FAIL-002** — Rapid hover between neighboring docking targets doesn't
  flicker. `built` — docking exists; the dock overlay renders the same value the
  reducer applies on release rather than a fresh hit-test, which is the property this
  scenario is really testing. Unasserted.
- **FAIL-003** — Rapid open/close doesn't leak stale candidates from indexes
  or layout caches. `unbuilt` (becomes real with the spatial index)

## Dashboard isolation

- **DASH-001** — A dashboard-grid surface inside a dedicated group/mode never
  leaks grid rules into floating-window behavior. `unbuilt` (relevant only if a
  dashboard mode ever ships)
