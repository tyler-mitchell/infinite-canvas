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

**The `built` column is the honest headline.** No test in the suite touches groups,
history, or recipes — `grep -l "createGroup\|dockWindow\|setChildWeights\|undoInfiniteCanvas\|captureInfiniteCanvasRecipe" src/*.test.*` returns nothing. P1 and P4 are capability-complete
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
  larger threshold. `built` — implemented in `snap-resolver.ts`
  (`getCandidateThreshold` widens an engaged guide's threshold to
  `releaseThreshold`, per guide rather than per axis). This entry read `open —
hysteresis unimplemented` until 2026-07-08, long after it shipped.

## Docking and groups — built by drag, none asserted

- **DOCK-001** — Drag a floating window beside another → new split group shell.
  `built` (Alt+drag. `resolveInfiniteCanvasDockPreview` finds the target from the
  canonical model; `applyInfiniteCanvasDockPreview` wraps it in a group occupying the
  rect it already had, then docks the dragged window beside it, so nothing else on the
  canvas shifts.)
- **DOCK-002** — Drag over a group's center → tab merge. `built` (the centre
  `1 - 2 × centerRatio` of a target is the tab-merge zone; outside it the nearest
  edge wins.)
- **DOCK-003** — Move a group shell → the group moves as one world object. `built`
  (dragging any member's header starts a `groupMove` interaction; members follow
  because their rects are re-derived from the shell.)
- **DOCK-004** — Tear a child out of a tab group → sensible floating rect; group
  stays valid. `built` (dragging a tab past a 6px threshold undocks the window and
  hands the same pointer to `interaction.startMove`. It keeps the rect the solver
  gave it — for a hidden tab, the size it would have been revealed at — so nothing
  jumps and nothing swells to fill the shell.)
- **DOCK-005** — Remove the last child → empty-group cleanup. `built`
  (`undockInfiniteCanvasGroupWindow` returns `null`, and `withInfiniteCanvasGroupTree`
  drops the shell.)

## Split behavior — built, none asserted

- **SPLIT-001** — Resizing a child changes weights/partitions; DOM widths are never
  the source of truth. `built` (dragging a gutter starts a `groupGutter` interaction
  and dispatches `group.setChildWeights`. Each step recomputes from the container
  snapshotted at drag start, so the seam tracks the cursor exactly. No DOM width is
  ever read.)
- **SPLIT-002** — Inserting a third sibling stays stable (n-ary, no binary churn).
  `built` (the tree is n-ary by construction; docking inserts a child rather than
  splitting a pair.)
- **SPLIT-003** — Normalization flattens a redundant single-child container safely.
  `built` (`normalizeInfiniteCanvasGroupTree`: a single-child split _is_ its child.
  Tab and accordion shells are semantic and survive. Bottom-up, so one pass reaches a
  fixed point.)
- **SPLIT-004** — Resize the shell by its outer edge: members re-project, no pane
  falls below the structural floor, and the drag is one undo entry. `built`
  (2026-07-08. `groupResize` steps `group.rect`; `getInfiniteCanvasGroupMinimumSize`
  is the floor, measured with the layer's own metrics and captured at drag start.)

## Tabs, accordion, focus

- **TAB-001** — Tab reorder via drag persists; focus stays predictable. `unbuilt`
  by drag — `group.reorderChild` exists as a command, but no pointer gesture compiles
  to it.
- **TAB-002** — Tabs↔accordion conversion preserves membership. `built`
  (`setInfiniteCanvasGroupLayoutMode` changes `layout` and touches no child.)
- **ACC-001** — Keyboard navigation follows accordion orientation. `built` (2026-07-08).
  Each accordion container is one roving tab stop, and its arrows follow
  `container.axis`: a vertically stacked accordion answers Up/Down, a horizontal one
  Left/Right. Hard-coding Left/Right, as a tablist may, would make Down walk a row of
  side-by-side headers — the diagonal drift `window-focus.ts` refuses everywhere else.
  Home/End are axis-independent. Activation stays Enter/Space through the existing
  `onClick`. Unasserted.
- **FOCUS-001** — Directional focus prefers group-local neighbors over global.
  `built` (inside a group the arrow searches the group's own members first, and only
  leaves the group when nothing lies that way. Windows behind an inactive tab or a
  collapsed fold are never focus targets — nothing draws them. The global tier ranks
  "beside" over "close", so arrows never drift diagonally.)
- **FOCUS-002** — Floating window over a shell: contextual-parent focus behaves
  sensibly. `unbuilt`
- **FOCUS-003** — "Left half"-style placement commands resolve through the same
  canonical placement engine as drag snapping. `unbuilt` (`partial` precedent:
  fit/navigation commands already share the camera reducer; placement commands don't
  exist yet)

## Persistence

- **PERSIST-001** — Save a cluster (floating + multi-tab group); restore recreates
  positions, membership, modes. `built` — the envelope is at `version: 2` and
  serializes `groups`; a `version: 1` payload migrates to `groups: []`. No test
  round-trips a group.
- **PERSIST-002** — Persist, reload, compare canonical state: runtime
  previews/constraints/hover are absent from persistence. `covered`
- **PERSIST-003** — Tear out, move, re-dock, undo each step transactionally.
  `built` — undo/redo over `{ groups, windows }` shipped with P4; a drag is one entry,
  checkpointed at its start. This entry read `open (undo/redo unbuilt)` until
  2026-07-08. The transactional _sequence_ in this scenario is unasserted.

## Columns mode — `unbuilt`, deliberately last

- **COL-001** — Appending a column doesn't resize existing columns.
- **COL-002** — Scroll/pan is local to the shell, not the world.

## Rendering and body mounts

- **RENDER-001** — Focused = live DOM; background = snapshot; far = card.
  Transitions stable, identity preserved. `partial` (snapshot lane exists;
  semantic far-card lane is RASTERIZATION_PLAN work)
- **RENDER-002** — Dragging a snapshot-represented window stays coherent.
  `partial` (captures pause during interaction by design; needs an explicit
  test)
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

  The fix is to derive the world delta from two screen→world projections — the origin
  pointer under the origin camera, the current pointer under the current camera — rather
  than from one cached scalar. That changes `InfiniteCanvasMoveInteraction`, which is
  public, and every drag path depends on it, so it wants this scenario as a regression
  test first rather than a blind edit. Applies to move, resize, `groupMove`, and
  `groupResize` alike.

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
