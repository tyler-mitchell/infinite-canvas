# Acceptance Scenarios

> Provenance: adapted 2026-06-10 from the kek-monorepo windowing corpus
> (`09_test_scenarios.md`, verified 2026-04-23). These exist to catch
> architecture mistakes, not to check trivial movement. Status reflects the
> framework as of 2026-06-10: `covered` (exercised by the ported unit suites
> or verified live), `partial`, `open` (feature unbuilt or untested).
> If several fail at once, suspect the model boundary, not the interaction
> code.

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
  larger threshold. `open` — hysteresis unimplemented (FEATURE_TRACKER risk;
  spec in [snapping.md](snapping.md))

## Docking and groups — all `open` (grouping unbuilt)

- **DOCK-001** — (`done`: Alt+drag. `resolveInfiniteCanvasDockPreview` finds the
  target from the canonical model, `applyInfiniteCanvasDockPreview` wraps it in a
  group occupying the rect it already had, then docks the dragged window beside
  it, so nothing else on the canvas shifts.) Drag a floating window beside another → new split group
  shell.
- **DOCK-002** — (`done`: the centre `1 - 2 × centerRatio` of a target is the
  tab-merge zone; outside it the nearest edge wins.) Drag over a group's center → tab merge.
- **DOCK-003** — Move a group shell → the group moves as one world object.
  (`done`: dragging any member's header starts a `groupMove` interaction; the
  members follow because their rects are re-derived from the shell.)
- **DOCK-004** — (`done`: dragging a tab past a 6px threshold undocks the window
  and hands the same pointer to `interaction.startMove`. It keeps the rect the
  solver gave it — for a hidden tab, the size it would have been revealed at — so
  nothing jumps and nothing swells to fill the shell.) Tear a child out of a tab
  group → sensible floating rect;
  group stays valid.
- **DOCK-005** — Remove the last child → empty-group cleanup.
  (`done`: `undockInfiniteCanvasGroupWindow` returns `null`, and `withInfiniteCanvasGroupTree` drops the shell.)

## Split behavior — all `open`

- **SPLIT-001** — (`done`: dragging a gutter starts a `groupGutter` interaction
  and dispatches `group.setChildWeights`. Each step recomputes from the container
  snapshotted at drag start, so the seam tracks the cursor exactly. No DOM width
  is ever read.) Resizing a child changes weights/partitions; DOM widths are
  never the source of truth.
- **SPLIT-002** — Inserting a third sibling stays stable (n-ary, no binary
  churn).
- **SPLIT-003** — Normalization flattens a redundant single-child container
  safely.

## Tabs, accordion, focus — all `open`

- **TAB-001** — Tab reorder via drag persists; focus stays predictable.
- **TAB-002** — Tabs↔accordion conversion preserves membership.
- **ACC-001** — Keyboard navigation follows accordion orientation.
- **FOCUS-001** — Directional focus prefers group-local neighbors over global.
  (`partial`: the global geometric tier is built — `window.focusDirection`,
  `src/window-focus.ts`, nearest window strictly ahead, "beside" outranking
  "close". The group-local tier it should prefer first awaits P1.)
- **FOCUS-002** — Floating window over a shell: contextual-parent focus
  behaves sensibly.
- **FOCUS-003** — "Left half"-style placement commands resolve through the
  same canonical placement engine as drag snapping. (`partial` precedent:
  fit/navigation commands already share the camera reducer; placement
  commands don't exist yet)

## Persistence

- **PERSIST-001** — Save a cluster (floating + multi-tab group); restore
  recreates positions, membership, modes. `open` (groups/recipes)
- **PERSIST-002** — Persist, reload, compare canonical state: runtime
  previews/constraints/hover are absent from persistence. `covered`
- **PERSIST-003** — Tear out, move, re-dock, undo each step transactionally.
  `open` (undo/redo unbuilt)

## Columns mode — `open`, deliberately last

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
  `partial` (visibility tests exist; no culling-vs-selection scenario)

## Failure-oriented

- **FAIL-001** — Zoom mid-drag: snap feel stays screen-space stable. `open`
  (explicitly untested; FEATURE_TRACKER lists zoomed/panned-camera test
  coverage as an unchecked hardening item)
- **FAIL-002** — Rapid hover between neighboring docking targets doesn't
  flicker. `open` (docking)
- **FAIL-003** — Rapid open/close doesn't leak stale candidates from indexes
  or layout caches. `open` (becomes real with the spatial index)

## Dashboard isolation

- **DASH-001** — A dashboard-grid surface inside a dedicated group/mode never
  leaks grid rules into floating-window behavior. `open` (relevant only if a
  dashboard mode ever ships)
