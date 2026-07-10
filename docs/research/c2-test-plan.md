# C2 — the scenario suite, specified to the assertion

> **Why this file exists.** SHIP*PLAN's C2 is the single largest gap to an honest "production":
> no test in the suite touches groups, history, or recipes. Writing those tests is out of scope
> for the session that wrote this document (no unit tests), but \_specifying* them is not — and a
> reading-audit of the whole group/history/recipe core on 2026-07-09 established exactly which
> invariant each scenario turns on. This file is that audit, rendered as an execution plan: an
> arrange/act/assert for every P1/P4 scenario, grounded in the real functions, so the suite is
> mechanical to type and cannot drift from the code it guards.
>
> **Level.** These are pure reducer/primitive assertions — no DOM, because the group core is
> pure (`verify-pure-core.mjs` proves it). Two surfaces are assertable and both should be used:
> the **primitive** (`group-tree.ts` / `group-state.ts` functions, which give the tightest
> structural assertions) and the **reducer** (`reduceInfiniteCanvasState` with a
> `command.execute` or `interaction.*` action, which is what a user actually triggers). Where a
> scenario is really about the user-facing transition, assert at the reducer; where it is about a
> structural invariant, assert on the primitive.
>
> **Fixtures.** `createInfiniteCanvasState({ windows: [...] })` and `createInfiniteCanvasWindow`
> build initial state. A window node's id **is** its window id (group-tree invariant 1); container
> ids are `` `${targetId}::${edge}` `` for a split/tab wrapper and `` `${windowId}::group` `` for a
> new shell (see `getInfiniteCanvasDockContainerId` / `getInfiniteCanvasDockGroupId`). Deriving
> them rather than generating them is what makes an undo replay reproduce the identical tree, so
> the tests can hard-code the expected ids.

## Docking (DOCK-001..005) — `group-tree.ts`, `group-state.ts`

### DOCK-001 — dock beside a floating window → a split shell, nothing else moves

- **Arrange** a group whose tree is a single window node `B` at some `group.rect`. (Or start from
  two floating windows and drive `applyInfiniteCanvasDockPreview`; the tree primitive is tighter.)
- **Act** `dockInfiniteCanvasGroupWindow(tree, { containerId: "B::east", edge: "east", targetId: "B", windowId: "A" })`.
- **Assert** the result is a `container` with `layout: "split"`, `axis: "horizontal"`,
  `children: [B, A]` (B before A because east is a trailing edge — `isInfiniteCanvasGroupLeadingEdge("east") === false`), and **each child weight `=== 0.5 × B.originalWeight`** so the pair occupies exactly the space `B` held. Solve it with
  `getInfiniteCanvasGroupLayout(tree, group.rect)` and assert the two window rects tile
  `group.rect` along x with a `gutterSize` gap and no overflow. The invariant under test:
  **neighbours never move because someone docked elsewhere.**
- **Guard the real defect (dock intent).** At the reducer, one `interaction.step` with
  `dockIntent: true` must resolve the preview **once**. Dispatch a single step and assert
  `state.interaction.dockPreview` is set and `resolveInfiniteCanvasDockPreview` ran once, not three
  times (the 2026-07-08 defect: three handlers stepped one pointermove and `dockIntent` collapsed
  to `false`).

### DOCK-002 — dock over the centre → tab merge, dropped tab is active

- **Act** `dockInfiniteCanvasGroupWindow(tree, { edge: "center", targetId: "B", windowId: "A", containerId: "B::group" })`.
- **Assert** a `container` with `layout: "tabs"`, `children: [B, A]`, and **`activeChildId === "A"`**
  (the just-dropped window is active — DOCK-002). Re-dock a third window `C` onto that tab
  container's centre and assert it **absorbs** into the existing strip (`children: [B, A, C]`,
  `activeChildId === "C"`) rather than nesting a second tab group — `mergeInfiniteCanvasGroupWindowAsTab`
  takes the absorb branch when `hasInfiniteCanvasGroupActiveChild(target)` is true.

### DOCK-003 — move the shell → one world object

- **Arrange** a two-pane group at a known `group.rect`.
- **Act** at the reducer: `beginInfiniteCanvasGroupMove` then an `interaction.step` a known screen
  delta at zoom 1.
- **Assert** `group.rect` translated by exactly the world delta and **every member rect translated
  by the same delta** (members re-derive from the shell via `syncInfiniteCanvasGroupWindowRects`;
  no member rect is written directly). Assert the tree is referentially unchanged (only `rect`
  moved). Cross-check DOCK-003's sibling fix: dispatch `window.nudge` on a **member** and assert it
  translates the **shell**, not the member's own rect (the 2026-07-08 detach bug).

### DOCK-004 — tear a child out → sensible rect, group stays valid

- **Act** `undockInfiniteCanvasGroupWindow(tree, "A")` on a tab group `[B, A, C]`.
- **Assert** the returned tree is `[B, C]` normalized, `activeChildId` resolves to a present child
  (if `A` was active, `resolveInfiniteCanvasGroupActiveChildId` falls to the first remaining — `B`),
  and the torn window, when re-floated, keeps the rect the solver gave it (for a hidden tab, the
  size it would have been revealed at — `windowRects` carries hidden members' rects). Nothing swells
  to fill the shell.

### DOCK-005 — remove the last child → empty-group cleanup

- **Act** `undockInfiniteCanvasGroupWindow(singleWindowTree, "A")`.
- **Assert** it returns **`null`**, and at the state level `withInfiniteCanvasGroupTree(state, id, null)`
  **removes the group from `state.groups`** (filter, line 173-174) and re-syncs remaining rects. The
  window `A` survives in `state.windows` (undock frees it; it does not close it).

## Split (SPLIT-001..004)

### SPLIT-001 — gutter drag changes weights, DOM is never the source of truth

- **Act** `beginInfiniteCanvasGroupGutterDrag` then `interaction.step`; the reducer routes to
  `stepInfiniteCanvasGroupGutterDrag`, which recomputes from `interaction.originContainer` and the
  **total** pointer travel (not an incremental delta).
- **Assert** the two panes' weights sum unchanged and their ratio equals the cursor's fractional
  position; assert `getInfiniteCanvasGroupGutterWeights` floors each pane at `MINIMUM_GROUP_PANE_SHARE`
  so neither can be dragged out of existence. Assert **no DOM width is read** (there is nothing to
  read — it is a pure reducer path). Guard the real defect: a grouped **window** frame must draw
  **no** resize handles (`isGrouped` prop), so the gutter under it is never buried by a dead handle.

### SPLIT-002 — third sibling is stable (n-ary, no binary churn)

- **Act** dock `C` to the east of `A` inside an existing horizontal split `[A, B]`; the parent
  extends (`canExtendParent` true) via `insertInfiniteCanvasGroupWindowBesideSibling`.
- **Assert** the result is a **flat** `[A, C, B]` (or `[C, A, B]` for a leading edge), **not** a
  nested split — `A` shrank to half and `C` took the other half, `B` untouched. The tree depth did
  not increase.

### SPLIT-003 — normalization flattens a redundant single-child split

- **Act** `normalizeInfiniteCanvasGroupTree` on a `split` container with one child.
- **Assert** the result **is that child**, carrying the parent's weight
  (`{ ...onlyChild, weight: parent.weight }`). Assert a one-tab `tabs` container and a one-fold
  `accordion` **survive** (they are semantic). Assert a same-axis split nested in a same-axis split
  is inlined (`inlineSameAxisSplitChildren`), and that one bottom-up pass reaches a fixed point (a
  grandchild inlined before its parent is examined).

### SPLIT-004 — shell resize by the outer edge

- **Act** `beginInfiniteCanvasGroupResize(state, pid, group, "south-east", minSize, point)` then a
  step; `stepInfiniteCanvasGroupResize` resizes from `interaction.originRect` via
  `resizeRectFromHandle`.
- **Assert** members re-project from the new `group.rect`; **no pane falls below the structural
  floor** — drag the pointer far past the minimum and assert `group.rect` clamps at
  `getInfiniteCanvasGroupMinimumSize(tree, metrics)` and **holds** (further travel does not shrink
  it, and travelling back returns it step-for-step, because the step recomputes from `originRect`,
  not the live rect). Assert the whole drag is **one** undo entry: after `begin`+`step`+`finish`,
  `state.history.past` grew by exactly 1, checkpointed at `begin` (`MUTATING_INTERACTION_KINDS`
  includes `"groupResize"`).

## Tabs / accordion (TAB-001, TAB-002, ACC-001)

### TAB-001 — tab reorder persists; tear-out is "leave the strip", not "6px"

- **Act** `reorderInfiniteCanvasGroupChild(tree, { childId: "B", toIndex: 2 })`.
- **Assert** `B` moves to index 2 among its siblings, `clampIndex` bounds an out-of-range or
  non-finite `toIndex`, and membership/weights are otherwise untouched. **Reorder must be reachable
  by drag:** at the reducer, a tab drag that stays inside the strip compiles to
  `group.reorderChild`, and only leaving the strip (≥ 6 **screen** px past its edge) tears out — a
  regression test that a small in-strip slide does **not** undock (the pre-2026-07-08 bug: any 6px
  tore out, so reorder-by-drag was unreachable).

### TAB-002 — tabs↔accordion preserves membership

- **Act** `setInfiniteCanvasGroupLayoutMode(tree, { containerId, layout: "accordion" })` then back
  to `"tabs"`.
- **Assert** `children` are referentially the same nodes in the same order with the same weights
  after a round-trip (`setInfiniteCanvasGroupLayoutMode` touches only `layout`), so weights ride
  along even while the layout ignores them.

### ACC-001 — keyboard nav follows accordion orientation

- **Act** (primitive) build a vertical accordion; call the roving-index helper
  (`getNextRovingIndex(key, index, count, axis)`) with `axis: "vertical"`.
- **Assert** `ArrowDown`/`ArrowUp` move the index, `ArrowLeft`/`ArrowRight` do **not** (and the
  reverse for a horizontal accordion); `Home`/`End` are axis-independent. This is the same
  no-diagonal-drift rule `window-focus.ts` enforces; a hard-coded Left/Right would make Down walk a
  row of side-by-side headers.

## FAIL-001 and the pan sibling — `interaction.ts`

### FAIL-001 — zoom mid-drag does not slide the window

- **Act** `beginWindowMove` at zoom 1; `interaction.step` +100px (world +100); dispatch
  `camera.zoomAt` to zoom 2; `interaction.step` +100px more.
- **Assert** the window's world displacement is **150**, not 200 — `getInteractionWorldDelta`
  projects both pointer ends through their own cameras. Add the **static-camera** case: with no
  zoom change, the delta equals `screenDelta / zoom` exactly (the reduction the fix rests on).
  Cover `move`, `resize`, `groupMove`, `groupResize`, `groupGutter` — all five carry `originCamera`.

### FAIL-001b — pan does not discard a mid-pan zoom (2026-07-09)

- **Act** `beginCanvasPan` at zoom 1; `interaction.step` a delta; dispatch `camera.zoomAt` to zoom
  2 mid-pan; `interaction.step` again.
- **Assert** after the second step, **`camera.zoom === 2`** (the pan no longer forces it back to
  the pan-start zoom), and the world point grabbed at pan-start is still under the pointer. The
  static-zoom case must be **bit-identical** to `originCamera.center - screenDelta / originZoom`.

## Persistence & history (PERSIST-001, PERSIST-003, and the recipe path)

### PERSIST-001 — save a cluster, restore positions/membership/modes

- **Act** `stringifyInfiniteCanvasState(state)` on a canvas with a floating window and a multi-tab
  group → `parseInfiniteCanvasStateJson(json, base)`.
- **Assert** a **fractional** rect (`x: 144.21052631578948`) round-trips to the bit; group
  membership, tab `activeChildId`, and window `mode`/`isPinned` are restored; a `version: 1`
  payload (pre-groups) migrates to `groups: []` rather than being rejected; transient state
  (`interaction`, `snapPreview`) is absent from the serialized form. Guard the new depth bound: a
  group tree nested past `MAX_INFINITE_CANVAS_GROUP_TREE_DEPTH` (256) parses to **`null`**, not a
  thrown `RangeError`.

### PERSIST-003 — tear out, move, re-dock, undo each step transactionally

- **Act** a sequence: dock A↔B (edit 1), move the shell (edit 2), tear A out (edit 3); then undo ×3,
  redo ×3.
- **Assert** each undo restores the **document** (`{ windows, groups }`) that stood before that
  edit and **only** the document — the camera does not move, the selection is re-normalized against
  the restored windows. Assert a drag is **one** entry (checkpoint at the null→non-null interaction
  transition, never on `interaction.step`), the redo branch is cleared by any new edit
  (`pushInfiniteCanvasHistory` sets `future: []`), and the stack is bounded at
  `INFINITE_CANVAS_HISTORY_LIMIT` (100). Known wart to encode, not fix: a grab-and-release with no
  movement still leaves one checkpoint (one no-op undo press).

### RECIPE — capture and apply survive a closed window

- **Act** `captureInfiniteCanvasRecipe` a group of A+B; close B; `applyInfiniteCanvasRecipe`.
- **Assert** the restored group does **not** lay out a ghost: `reconcileInfiniteCanvasGroups` runs
  on apply and `undockInfiniteCanvasGroupWindow` strips B, dropping the tree if it empties. Assert a
  recipe **translates, never scales** (a window's `minSize` is never violated by placement), the
  whole apply is **one** undo entry, and a group is captured only if **every** member is
  (`getCapturableGroups`), else its windows are captured as floating.

## Coverage floor

When these land, add to `verify-api-doc.mjs`'s sibling gates a check that
`src/*.test.*` collectively references `dockInfiniteCanvasGroupWindow`,
`undockInfiniteCanvasGroupWindow`, `setInfiniteCanvasGroupChildWeightsInState`,
`undoInfiniteCanvasHistory`, and `captureInfiniteCanvasRecipe` — so P1/P4 cannot silently return to
verification-empty. The `built` scenarios above become `covered` one assertion at a time; nothing
here is `covered` until its assertion exists and runs.
