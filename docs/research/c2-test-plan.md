# C2 scenario suite

Status: specified. SHIP*PLAN C2 identifies the largest gap to honest "production". No current test covers groups, history, or recipes. Audit date: 2026-07-09. The audit mapped each P1 and P4 scenario to a core invariant.

Use primitives from `group-tree.ts` and `group-state.ts` for structural assertions. Use `reduceInfiniteCanvasState` for user transitions.

Reducer actions use `command.execute` or `interaction.*`. No DOM is necessary because `verify-pure-core.mjs` proves that the group core is pure.

Use `createInfiniteCanvasState({ windows: [...] })` and `createInfiniteCanvasWindow` for fixtures. A window node ID is its window ID.

Group-tree invariant 1 defines this identity.

Container IDs are `` `${targetId}::${edge}` `` for a split/tab wrapper and `` `${windowId}::group` `` for a
new shell (see `getInfiniteCanvasDockContainerId` / `getInfiniteCanvasDockGroupId`). These helper functions derive the IDs.

Tests can hard-code these IDs because an undo replay reproduces the same tree.

## Docking (DOCK-001 through DOCK-005)

Source: `group-tree.ts`, `group-state.ts`.

### DOCK-001: dock beside a floating window

- **Arrange:** Create a group with window node B at a known `group.rect`.
- **Reducer path:** Create two floating windows and call `applyInfiniteCanvasDockPreview`.
- **Act:** Call `dockInfiniteCanvasGroupWindow(tree, { containerId: "B::east", edge: "east", targetId: "B", windowId: "A" })`.
- **Assert:** The result has `layout: "split"`, `axis: "horizontal"`, and `children: [B, A]`.
- **Assert:** `B` precedes `A` because `isInfiniteCanvasGroupLeadingEdge("east") === false`.
- **Assert:** Each child weight satisfies `=== 0.5 × B.originalWeight`. The pair occupies the former `group.rect` space of `B`.
- **Assert:** `getInfiniteCanvasGroupLayout(tree, group.rect)` tiles both rectangles along x with one `gutterSize` gap and no overflow.
- **Assert:** Neighboring rectangles do not move.
- **Regression:** Dispatch one `interaction.step` with `dockIntent: true`. `state.interaction.dockPreview` must exist.
- **Regression:** `resolveInfiniteCanvasDockPreview` must run once. Three handlers processed one pointer move and set `dockIntent` to `false` on 2026-07-08.

### DOCK-002: dock at the center

- **Act:** Call `dockInfiniteCanvasGroupWindow(tree, { edge: "center", targetId: "B", windowId: "A", containerId: "B::group" })`.
- **Assert:** The `container` has `layout: "tabs"`, `children: [B, A]`, and `activeChildId === "A"`.
- **Act:** Dock C at the center of that tab container.
- **Assert:** The `container` absorbs `C` as `children: [B, A, C]` with `activeChildId === "C"`.
- **Assert:** No second tab group exists.

When `hasInfiniteCanvasGroupActiveChild(target)` is true, `mergeInfiniteCanvasGroupWindowAsTab` uses the absorb branch.

### DOCK-003: move the shell

- **Arrange:** Create a two-pane group at a known `group.rect`.
- **Act:** Call `beginInfiniteCanvasGroupMove`. Then dispatch `interaction.step` with a known screen delta at zoom 1.
- **Assert:** The world delta moves `group.rect` and every member rectangle by exactly the same amount.
- **Assert:** `syncInfiniteCanvasGroupWindowRects` derives member rectangles from the shell. The reducer does not write them directly.
- **Assert:** The tree keeps its reference. Only `rect` changes.
- **Regression:** Dispatch `window.nudge` for a member. It must move the complete shell and every member rectangle.

The last assertion covers the 2026-07-08 detach defect.

### DOCK-004: remove a child

- **Act:** Call `undockInfiniteCanvasGroupWindow(tree, "A")` on `[B, A, C]`.
- **Assert:** The normalized tree contains `[B, C]`. `activeChildId` refers to a present child.
- **Assert:** If A was active, `resolveInfiniteCanvasGroupActiveChildId` selects `B`.
- **Assert:** The floating window keeps the solver rectangle. For a hidden tab, `windowRects` holds its reveal rectangle.
- **Assert:** No member grows to fill the shell.

### DOCK-005: remove the last child

- **Act:** Call `undockInfiniteCanvasGroupWindow(singleWindowTree, "A")`.
- **Assert:** The function returns `null`.
- **Assert:** `withInfiniteCanvasGroupTree(state, id, null)` removes the group from `state.groups` at lines 173 and 174.
- **Assert:** The state synchronizes remaining rectangles. Window A remains in `state.windows`.

An undock action frees a window. It does not close the window.

## Split (SPLIT-001 through SPLIT-004)

### SPLIT-001: drag a gutter

- **Act:** Call `beginInfiniteCanvasGroupGutterDrag`. Then dispatch `interaction.step`.
- **Assert:** `stepInfiniteCanvasGroupGutterDrag` uses `interaction.originContainer` and total pointer travel. It ignores incremental deltas.
- **Assert:** The weight sum does not change. The weight ratio equals the fractional cursor position.
- **Assert:** `getInfiniteCanvasGroupGutterWeights` limits each pane to `MINIMUM_GROUP_PANE_SHARE` or more.
- **Assert:** The reducer does not read DOM widths.
- **Regression:** When `isGrouped` is true, a grouped frame draws no resize handles. No dead handle covers the gutter.

### SPLIT-002: keep a third sibling stable

- **Arrange:** Create the horizontal split `[A, B]`.
- **Act:** Dock `C` east of `A`.
- **Assert:** `canExtendParent` is true. `insertInfiniteCanvasGroupWindowBesideSibling` extends the parent.
- **Assert:** The flat result is `[A, C, B]`. A leading edge gives `[C, A, B]`.
- **Assert:** No nested split exists. `A` and `C` each get half of the former weight of `A`.
- **Assert:** The weight of `B` and the tree depth do not change.

### SPLIT-003: normalize a redundant split

- **Act:** Pass a one-child `split` to `normalizeInfiniteCanvasGroupTree`.
- **Assert:** The result is `{ ...onlyChild, weight: parent.weight }`.
- **Assert:** A one-tab `tabs` container and a one-fold `accordion` container remain because they contain semantic state.
- **Assert:** `inlineSameAxisSplitChildren` inlines a same-axis split inside a same-axis split.
- **Assert:** One bottom-up pass gets to a fixed point. The pass examines each grandchild before its parent.

### SPLIT-004: resize a shell from the outer edge

- **Act:** Call `beginInfiniteCanvasGroupResize(state, pid, group, "south-east", minSize, point)`. Then dispatch a step.
- **Assert:** `stepInfiniteCanvasGroupResize` uses `interaction.originRect` with `resizeRectFromHandle`.
- **Assert:** The new `group.rect` determines member rectangles. No pane is smaller than the structural limit.
- **Assert:** `group.rect` stops at `getInfiniteCanvasGroupMinimumSize(tree, metrics)` and does not shrink after that point.
- **Assert:** Reverse pointer travel restores each size because the step uses `originRect`, not the live rectangle.
- **Assert:** `begin` + `step` + `finish` adds one entry to `state.history.past`.
- **Assert:** The checkpoint occurs at `begin`. `MUTATING_INTERACTION_KINDS` includes `"groupResize"`.

## Tabs and accordion (TAB-001, TAB-002, ACC-001)

### TAB-001: reorder a tab

- **Act:** Call `reorderInfiniteCanvasGroupChild(tree, { childId: "B", toIndex: 2 })`.
- **Assert:** `B` moves to index 2. `clampIndex` limits an out-of-range or non-finite `toIndex`.
- **Assert:** Membership and weights do not change.
- **Assert:** A drag inside the strip compiles to `group.reorderChild`.
- **Regression:** Tear-out means "leave the strip", not "6px".
- **Regression:** A tab leaves the group at least 6 screen pixels past the strip edge.
- **Regression:** A small drag inside the strip does not undock the tab.

The pre-2026-07-08 defect removed a tab after any 6-pixel drag. This made drag reorder unreachable.

### TAB-002: change tabs to accordion and back

- **Act:** Call `setInfiniteCanvasGroupLayoutMode(tree, { containerId, layout: "accordion" })`. Then set the layout to `"tabs"`.
- **Assert:** The same `children` references remain in the same order with the same weights.

`setInfiniteCanvasGroupLayoutMode` changes only `layout`. An accordion ignores weights but keeps them.

### ACC-001: use the accordion orientation

- **Act:** Create a vertical accordion. Call `getNextRovingIndex(key, index, count, axis)` with `axis: "vertical"`.
- **Assert:** `ArrowDown` and `ArrowUp` move the index. `ArrowLeft` and `ArrowRight` do not.
- **Assert:** A horizontal accordion has the reverse behavior. `Home` and `End` do not depend on the axis.

`window-focus.ts` uses the same axis rule. A fixed Left or Right rule makes Down move across side-by-side headers.

## Interaction failures

Source: `interaction.ts`.

### FAIL-001: keep a window stable through a zoom change

- **Act:** Call `beginWindowMove` at zoom 1. Dispatch `interaction.step` with +100px.
- **Assert:** At zoom 1, the first +100px screen step moves +100 in world space.
- **Act:** Dispatch `camera.zoomAt` to zoom 2. Dispatch another `interaction.step` with +100px.
- **Assert:** The world displacement is 150, not 200.
- **Assert:** `getInteractionWorldDelta` projects each pointer end through its associated camera.
- **Assert:** With a static camera, the delta equals `screenDelta / zoom`.
- **Assert:** Cover `move`, `resize`, `groupMove`, `groupResize`, and `groupGutter`. Each interaction stores `originCamera`.

### FAIL-001b: keep a zoom change during a pan (2026-07-09)

- **Act:** Call `beginCanvasPan` at zoom 1. Dispatch `interaction.step` with a delta.
- **Act:** Dispatch `camera.zoomAt` to zoom 2. Dispatch another `interaction.step`.
- **Assert:** After the second step, `camera.zoom === 2`.
- **Assert:** The world point from the pan start remains under the pointer.
- **Assert:** With a static zoom, the result is bit-identical to `originCamera.center - screenDelta / originZoom`.

## Persistence and history

### PERSIST-001: save and restore a cluster

- **Act:** Serialize a floating window and multi-tab group with `stringifyInfiniteCanvasState(state)`.
- **Act:** Pass the result to `parseInfiniteCanvasStateJson(json, base)`.
- **Assert:** The fractional value `x: 144.21052631578948` keeps the same bits.
- **Assert:** Group membership, tab `activeChildId`, window `mode`, and window `isPinned` remain.
- **Assert:** A `version: 1` payload becomes `groups: []`. The parser returns no error.
- **Assert:** This payload predates group state.
- **Assert:** The serialized form excludes `interaction` and `snapPreview`.
- **Assert:** A tree deeper than `MAX_INFINITE_CANVAS_GROUP_TREE_DEPTH` (256) parses to `null`.
- **Assert:** The parser does not throw a `RangeError` for this tree.

### PERSIST-003: undo and redo a group sequence

- **Act:** Dock A with B as edit 1. Move the shell as edit 2. Remove A as edit 3.
- **Act:** Undo three times. Then redo three times.
- **Assert:** Each undo restores the prior `{ windows, groups }` document. The camera does not move.
- **Assert:** The restored windows determine the normalized selection.
- **Assert:** One drag creates one entry at the null-to-non-null interaction transition.
- **Assert:** `interaction.step` does not create an entry.
- **Assert:** A new edit clears redo because `pushInfiniteCanvasHistory` sets `future: []`.
- **Assert:** The stack has at most `INFINITE_CANVAS_HISTORY_LIMIT` (100) entries.
- **Known behavior:** A grab and release without movement creates one checkpoint and one no-op undo action.

### RECIPE: apply a recipe after a window closes

- **Act:** Capture a group of A and B with `captureInfiniteCanvasRecipe`. Close B. Call `applyInfiniteCanvasRecipe`.
- **Assert:** `reconcileInfiniteCanvasGroups` runs and `undockInfiniteCanvasGroupWindow` removes B.
- **Assert:** Reconciliation removes an empty tree. The restored group has no ghost window.
- **Assert:** A recipe translates windows but does not scale them. Placement does not violate `minSize`.
- **Assert:** One apply action creates one undo entry.
- **Assert:** If every group member is in the capture set, `getCapturableGroups` captures the group.
- **Assert:** If the capture set omits a member, the function captures the selected windows as floating windows.

## Coverage requirement

After the assertions exist, add a sibling gate to `verify-api-doc.mjs`.

The gate must find these references across `src/*.test.*`:

- `dockInfiniteCanvasGroupWindow`
- `undockInfiniteCanvasGroupWindow`
- `setInfiniteCanvasGroupChildWeightsInState`
- `undoInfiniteCanvasHistory`
- `captureInfiniteCanvasRecipe`.

The scenarios start with `built` status. Change one to `covered` only after its assertion exists. Nothing is `covered` before its assertion runs.
