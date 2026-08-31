# Acceptance scenarios

> Provenance: This document adapts `09_test_scenarios.md` from the kek-monorepo windowing corpus.
> The adaptation occurred on 2026-06-10. A review examined the source on 2026-04-23.

These scenarios find architecture errors. Routine movement is outside their
scope. If several scenarios fail together, examine the model boundary first.

The status vocabulary changed on 2026-07-08. The former `open` status meant
"feature unbuilt **or** untested". The document uses four statuses:

The false summary was _"Docking and groups — all `open` (grouping unbuilt)"_,
although each DOCK scenario already had `done`. The remaining RENDER work had
the `built` status.

| Status    | Meaning                                                    |
| --------- | ---------------------------------------------------------- |
| `covered` | Built, with a test or live verification for this scenario. |
| `partial` | Built, with a test for related behavior only.              |
| `built`   | Built and unasserted. Manual use succeeds.                 |
| `unbuilt` | The capability does not exist.                             |

For one month, the summary said "No test in the suite touches groups, history,
or recipes". The summary changed on 2026-08-12.

C2 and the README claims audit moved 17 scenarios from `built` to `covered`.

The RENDER family still has incomplete coverage. The transactional sequence in
PERSIST-003 also has incomplete coverage.

SPLIT-004 moved to covered on 2026-08-12. Its test found no defect. Before C2,
P1 and P4 had their capabilities but had no verification.

The 2026-07-08 review found three defects:

- DOCK-001 received three dock-intent dispatches for one pointer move.

- SPLIT-001 had inactive resize handles that covered the group gutter.

- FAIL-001 moved a window away from the cursor after a zoom during a drag.

The documentation work exposed FAIL-001 before an executable test existed.

## Floating windows

- **FLOAT-001**: Move a window across the world at 0.25x, 1x, and 4x zoom.
  Movement stays smooth. No hidden threshold changes with zoom. `covered`
  (2026-08-12)
  The test sweeps zoom from 0.12 to 8. It compares the world delta with the
  screen delta divided by zoom.

  The screen displacement stays equal at each zoom. Twenty small steps also
  produce the same result as one large step.
  These assertions find a threshold on each step or rounding to whole world
  units. Snapping stays disabled during this test.

  Snapping has an intentional threshold that changes with zoom. SNAP-001 covers
  that threshold separately. FLOAT-001 found no defect.

- **FLOAT-002**: Resize from each edge and corner. The minimum and maximum
  sizes apply. The opposite edges stay fixed. `covered`

- **FLOAT-003**: Bring A forward, interact with B, and focus A again. The stack
  order and focus stay separate. `covered`

## Snapping

- **SNAP-001**: Edge snapping starts at the same screen distance for each zoom.
  `covered` by tests of the screen-pixel thresholds.

- **SNAP-002**: Center snapping works without edge snapping. `covered`

- **SNAP-003**: Equal-gap snapping arranges three windows in a row. The guide
  is visually distinct. `covered`

- **SNAP-004**: During a resize, the active edge snaps and the rectangle does
  not jump. `covered`

- **SNAP-005**: A small retreat keeps the snap. Movement past the larger
  threshold releases it. `covered` (2026-08-12, `snap-resolver.test.ts`)
  `snap-resolver.ts` implements this behavior. `getCandidateThreshold`
  increases the threshold of an active guide to `releaseThreshold`.

  The resolver applies the threshold to each guide, not to each axis. The
  implementation existed before the status review on 2026-07-08. Its former
  status was `open —
hysteresis unimplemented`.

## Docking and groups

Tests covered these scenarios on 2026-08-12. DOCK-006 added keyboard access.

- **DOCK-001**: Alt-drag a floating window beside another window. A new split
  group shell appears. `covered`
  `resolveInfiniteCanvasDockPreview` finds the target in the canonical model.
  `applyInfiniteCanvasDockPreview` creates a group in the existing target
  rectangle.
  The operation docks the dragged window beside the target. Other canvas
  content does not move.

- **DOCK-002**: Drag a window over the center of a group. The operation merges
  the window as a tab. `covered`
  The tab-merge zone is `1 - 2 × centerRatio` of the target. Outside this zone,
  the nearest edge wins.

- **DOCK-003**: Move a group shell. The group moves as one world object.
  `covered`
  A drag on a member header starts a `groupMove` interaction. The solver derives
  each member rectangle from the shell.

- **DOCK-004**: Drag a child out of a tab group. The group stays valid, and the
  child gets a useful floating rectangle. `covered`
  A tab drag outside its strip undocks the window. The same pointer continues
  through `interaction.startMove`.
  The window keeps the rectangle from the solver. A hidden tab keeps the size
  that it has when visible.

  No window jumps or expands to fill the shell. Before 2026-07-08, the trigger
  was "any 6px of travel".
  TAB-001 reserves that movement for tab reordering.

- **DOCK-005**: Remove the last child from a group. The operation removes the
  empty group. `covered`
  `undockInfiniteCanvasGroupWindow` returns `null`.
  `withInfiniteCanvasGroupTree` then removes the shell.
  A one-member group is a deliberate state. `createInfiniteCanvasGroup` has a
  branch that creates it.

  Removing one member from a two-member group leaves one pane in the shell.

- **DOCK-006**: Dock and undock a window without a pointer. `covered`
  (2026-08-12)
  Before this change, all group gestures required a drag.
  `resolveInfiniteCanvasDockPreview` reads a world point, but the feature had no
  keyboard path.
  The missing keyboard path was an accessibility failure.
  `window.dockDirection` uses `getInfiniteCanvasDirectionalFocusTarget`. Thus,
  "dock left" reaches the same window as "focus left".

  The command uses the arrival edge. Travel to the right puts the window on the
  west side of the target.
  This result matches a drag onto the left half of that target.
  `resolveInfiniteCanvasDockPreviewForTarget` returns the same
  `InfiniteCanvasDockPreview` as a pointer drop.
  Both inputs commit through `applyInfiniteCanvasDockPreview`.

  `window.undock` removes the active window from its group.

- **DOCK-007**: Dissolve a group through the product. `covered` (2026-08-12)
  `group.close` existed in the reducer, but only the actions facade dispatched
  it. The product supported removal of one member at a time.
  `group.dissolve` closes the group that contains the active window.
  Members of a split keep the rectangles from the last solver result. Members
  of a tab or accordion group form an exact stack.

  Hidden members use the content rectangle of the shell. They use this same
  rectangle when visible.
  `closeInfiniteCanvasGroup` defines this behavior. A fan-out layout remains a
  separate decision about shared behavior.

- **DOCK-008**: Assign a group to a workspace as one unit. `covered`
  (2026-08-12)
  Workspace membership uses window IDs. A group is one world object with a
  shell, a rectangle, panes, gutters, and a tab strip.
  Partial membership can show a gutter beside an absent pane. It can also put a
  tab and its panel on different desktops.

  `normalizeInfiniteCanvasWorkspaceWindowIds` expands one member ID to all
  member IDs.
  `createInfiniteCanvasGroup` uses the same expansion rule. It does not take a
  member from another group.
  The command "put this on that desktop" includes the group that contains the
  named window.
  The group layer filters the groups for the workspace. It formerly read
  all of `state.groups`.

## Split behavior

- **SPLIT-001**: Resize a child with its gutter. The operation changes the child
  weights and partitions. `covered`
  A gutter drag starts a `groupGutter` interaction and dispatches
  `group.setChildWeights`.
  Each step uses the container snapshot from the start of the drag. The seam
  follows the cursor exactly.
  The operation never reads a DOM width as a source of truth.

- **SPLIT-002**: Add a third sibling without binary restructuring. `covered`
  The tree is n-ary by construction. Docking adds a child without splitting a
  pair.

- **SPLIT-003**: Normalize a redundant single-child container. `covered`
  `normalizeInfiniteCanvasGroupTree` replaces a single-child split with its
  child.
  Tab and accordion shells remain because they have semantic meaning. The
  normalization starts at the leaves, so one pass reaches a fixed point.

- **SPLIT-004**: Resize a group shell from an outer edge. The operation projects
  its members again and creates one undo entry. `covered`
  The team built the implementation on 2026-07-08 and added the test on
  2026-08-12.
  A `groupResize` interaction changes `group.rect`.

  `getInfiniteCanvasGroupMinimumSize` supplies the structural minimum.
  The layer measures this value with its own metrics at the start of the drag.
  All three assertions passed on the first test. The test found no defect.
  The minimum belongs to the complete structure. A test uses two 48px panes and
  one 6px gutter to require 102.

  A calculation that omits the second pane fails this test.

- **SPLIT-006**: Change a split row to a column and back. The shell keeps its
  rectangle. `covered` (2026-08-12)
  `group.flipAxis` performs the change. `setInfiniteCanvasGroupAxis` existed
  from the first group model.
  It formerly had no action variant, store method, or command. A product user
  had no way to change the split axis.

  The product path has a `group.setAxis` action and a `setGroupAxis` facade
  method. The command calculates the opposite axis.
  The product offers this command only for a non-tab container. A tab layout
  ignores the axis.

- **SPLIT-007**: Resize a pane without a pointer. `covered` (2026-08-12)
  `groupGutter` was the last pointer-only interaction kind. A keyboard user had
  an equalize command. No command changed one pane size.
  `group.resizePane` uses `getInfiniteCanvasGroupGutterWeights`, which also
  supports the drag.

  The command reads `availableExtent` from the solved layout. It does not
  calculate that value again.
  The last pane has no seam after it. It grows when the command moves the seam
  before it in the opposite direction.
  A test covers this direction. The wrong sign shrinks the pane that the user
  asked to grow.

  At each zoom, the seam moves 24 screen pixels. The resulting weight change
  depends on the solved extent.

- **SPLIT-005**: Make all panes in a container use equal weights. `covered`
  (2026-08-12)
  `group.equalizeChildren` calls `equalizeInfiniteCanvasGroupChildren` for the
  parent container of the active window.
  It does not change the complete tree. The product disables the command when
  the pane weights are already equal.
  The operation is idempotent. A nested container keeps its own weights.

## Tabs, accordion, and focus

- **TAB-001**: Reorder a tab with a drag. The order persists, and focus stays
  predictable. `covered` (2026-07-08)
  Pointer movement inside the strip changes the order. Pointer movement outside
  the strip removes the tab from the group.
  Before this change, any six pixels of movement removed the tab. A drag had no
  path to `group.reorderChild`.

  The exit action requires six screen pixels. The strip height uses world
  units.
  At low zoom, a bare `clientY > bottom` condition removes the tab after a small
  vertical movement.

- **TAB-002**: Convert tabs to an accordion and back without changing membership.
  `covered`
  `setInfiniteCanvasGroupLayoutMode` changes `layout`. It does not change a
  child.

- **TAB-003**: Change a container layout through the product. `covered`
  (2026-08-12)
  TAB-002 covered the model operation, but the product had no trigger.
  `setInfiniteCanvasGroupLayoutMode` received dispatches only from the actions
  facade.
  Conversion from a split to tabs required direct store access.
  `group.setLayout` exposes all three modes.

  The product offers a mode only when the container does not use it.
  A split always has a null `activeChildId`. Normalization selects a live child
  when the command converts the split to tabs.
  A test prevents a tab group with no visible pane.

- **TAB-004**: Move a pane within its container with the keyboard. `covered`
  (2026-08-12)
  Member order formerly required a tab drag. `group.moveChild` moves the active
  window one position toward the start or end.
  Movement stops at each end. The command does not wrap because the equivalent
  drag cannot wrap.
  The product does not offer movement past an end.

- **FOCUS-004**: Extend a multi-window selection without a pointer. `covered`
  (2026-08-12)
  Each arrange command requires two or more selected windows.
  `window.focusDirection` calls `focusWindow`, which replaces the selection.
  Thus, the palette listed arrange commands that a keyboard user was unable to use.
  Ordinary focus still replaces the selection, as a click does.

  `selection.extendDirection` provides the second action. It adds the target to
  the selection before focus moves to that target.
  `focusWindowPreservingSelection` reads the active window from the selection
  anchor. This order prevents focus from staying on the former anchor.
  The same change added `selection.removeActive`. It removes an unwanted
  extension without clearing the selection.

  This command does not toggle membership. `applySelection` derives the active
  window from the selection anchor.
  A window cannot leave the selection and remain active.
  `normalizeSelection` selects `windowIds.at(-1)` as the next anchor.
  For insertion order, this is the window that the user added before the active
  window. Repeated removal retraces the extension order.

- **ACC-002**: Keep each ARIA relationship attached to an existing element.
  `covered` (2026-08-12, `accessibility-structure.test.tsx`)
  The test found the expected defect. A tab container renders only its active
  child.
  Each inactive tab had an `aria-controls` value for a panel that was absent
  from the document.
  The component emits the attribute only when the panel exists. The APG
  recommends the reference only when a target exists.

- **ACC-001**: Navigate an accordion with keys that match its orientation.
  `covered` (2026-07-08)
  Each accordion container has one roving tab stop. Its arrows follow
  `container.axis`.
  A vertical stack uses Up and Down. A horizontal stack uses Left and Right.

  A fixed Left and Right rule makes Down move across side-by-side headers. This
  is the diagonal movement that `window-focus.ts` prevents elsewhere.
  Home and End do not depend on the axis. Enter and Space use the existing
  `onClick` action.

- **FOCUS-001**: Prefer members of the same group during directional focus.
  `covered`
  The search examines members of the same group first. It examines the canvas
  when no member exists in that direction.
  An inactive tab and a collapsed fold are never focus targets because they do
  not render.
  The global search ranks "beside" above "close". This rule prevents diagonal
  movement.

- **FOCUS-002**: Use a group as the contextual parent of a floating window.
  `covered` (2026-07-08)
  A group becomes the contextual parent when the center of the floating window
  is inside its rectangle.
  Directional focus examines members of that group before the canvas. The
  floating window does not require a separate keyboard model.
  `research/state-focus-and-recipes.md` gives this rule as the mitigation for
  the "focus model fragments" risk.

  The smallest containing group wins because group rectangles can overlap.
  Equal areas use the group ID as the tie-breaker.
  This rule gives each arrow action one result. Group membership has priority
  and stops the contextual scan.
  `getInfiniteCanvasContextualGroup(state, point)` is public.

- **FOCUS-003**: Resolve "Left half"-style placement commands through the
  canonical placement engine. `covered` (2026-07-08)
  `window.place` accepts halves, quarters, `fill`, and `center`.
  `window-placement.ts` is the only owner of the "left half" definition.
  Thus, pointer and keyboard placement use the same definition.
  `Mod+Shift+Arrow` and `Mod+Shift+Enter` have default bindings.

  Center and quarter regions have no default binding. The canvas calls
  `preventDefault()` for each chord that it owns.
  The candidate chords belong to browser developer tools or browser tab
  switching.
  Placement does not call `applySnapToRect`. Drag snapping applies that function
  after it has a rectangle.

  A snap adjustment can move a left half away from the exact half. It can also
  return a different rectangle after the second shortcut press.
  Rectangle and Magnet do not snap tiles. The scenario prevents a second custom
  placement path, and the product has one path.
  Placement changes the active window. It does not apply one rectangle to the
  complete selection because that can hide selected windows.

  The command refuses a grouped window, as `interaction.startResize` does. The
  group projects each member rectangle.
  A region that is narrower than `minSize` grows away from its anchored edge. A
  narrow right half keeps its right edge on the screen.

## Persistence

- **PERSIST-001**: Save and restore floating windows and a multi-tab group.
  Positions, membership, and modes return. `covered`
  The `version: 2` envelope stores `groups`. A `version: 1` payload migrates to
  `groups: []`.
  No test completes a group round-trip.

- **PERSIST-002**: Save, reload, and compare the canonical state. Runtime
  previews, constraints, and hover state stay out of persistence. `covered`

- **PERSIST-003**: Tear out, move, re-dock, and undo each action as one
  transaction. `covered`
  P4 added undo and redo for `{ groups, windows }`. A drag creates one entry at
  its start.
  Before 2026-07-08, this entry had the status `open (undo/redo unbuilt)`. The
  complete transactional sequence still has no assertion.

## Columns mode

Status: `unbuilt`. This section stays last.

- **COL-001**: Add a column without resizing existing columns.

- **COL-002**: Keep scroll and pan inside the shell.

## Rendering and body mounts

- **RENDER-001**: Use live DOM for focus, a snapshot for background content,
  and a card for far content. Preserve identity during each transition.
  `partial`
  The far-card level exists, and tests cover it. The former note called it
  "RASTERIZATION*PLAN work" until 2026-08-12.
  A window definition supplies `renderSummary`. The hysteresis band in
  `detail-level.ts` uses the effective screen size.

  The policy does not use raw zoom alone. Thus, a large window stays legible
  longer than a small window.
  `detail-level.test.ts` covers the level for a rectangle, zoom value, and
  previous level.
  `window-raster-body.test.tsx` covers the body output from the selected level.
  A policy test cannot observe that output.

  The separate wiring test finds a `renderSummary` callback that never starts
  or always starts. All eleven policy tests can pass in those states.
  The policy was correct while the former defaults left each 300×210 window as
  a summary card at 100% zoom.
  A zoom out demoted the window, and a zoom in did not restore it. Product
  operation found this defect.

  Commit `aa5f085` fixed the defaults. The first wiring test prevents the
  defect from returning.
  The snapshot level keeps this scenario `partial`. Snapshots require the
  `rasterization` prop, and no default product path enables it.
  Thus, "background = snapshot" remains unexercised.

- **RENDER-002**: Drag a window that has a snapshot representation. The window
  stays coherent. `partial`
  Capture pauses during an interaction by design. This behavior requires an
  explicit test.
  The team deferred this test on 2026-08-12. The scheduler pauses when
  `interaction !== null`.

  A window in a `move` or `resize` interaction also becomes ineligible for a
  capture.
  The dragged window stays as live DOM. Other windows can use snapshots.
  An end-to-end test requires the rasterization provider and a snapshot fixture.
  The default disables rasterization. The project marks it experimental and
  plans its replacement.

  P7 rebuilds the capture path on `html-in-canvas`. It uses `@zumer/snapdom` as
  the fallback.
  Tests for the current scheduler will require changes with P7.
  The same effort added coverage to `group-layout.ts`. That solver supplies the
  rectangle for each grouped window and formerly had no coverage.

  The next test condition is the first of these events: P7 lands, rasterization
  becomes a default, or a snapshot defect appears in use.

- **RENDER-003**: Cull offscreen content without breaking selection or
  restoration. `unbuilt`
  The product has no culling. `visibility.tsx` is a diagnostics probe behind
  `/scene`.
  A culler does not read that probe. It can use
  `isWorldRectWithinViewport`.
  ROADMAP P2 tranche 2 explains why culling must keep body mounts.

## Failure-oriented scenarios

- **FAIL-001**: Keep screen-space behavior stable after a zoom during a drag.
  A source review found this defect on 2026-07-08. Each drag stored `zoom` at
  `startMove`.
  Each step calculated `screenDelta / interaction.zoom`. The wheel handler
  permits a zoom during an interaction.

  Thus, a zoom converted the complete accumulated screen delta with the old
  scale.
  Start at zoom 1 and drag 100px right. The world displacement is 100.
  Change to zoom 2 and drag another 100px. The accumulated `screenDelta` is 200.

  Division by the original zoom gives 200 world units. The correct total is 100
  plus 50, which is **+150**.
  The window moved 50 world units away from the cursor and continued to move
  away.
  The team fixed the defect on the same day. `getInteractionWorldDelta` uses
  two screen-to-world projections.

  It projects the origin pointer with the origin camera. It projects the current
  pointer with the current camera.
  `zoom` is absent from `move`, `resize`, `groupMove`, `groupResize`, and
  `groupGutter`.
  Each interaction stores `originCamera`, which `pan` already stored.
  `screenPointToWorldPoint` uses `center + (p - viewport/2) / zoom`.

  With an unchanged camera, the `center` and `viewport` terms cancel. The result
  is `(p - origin) / zoom`.
  Thus, a static camera has bit-identical behavior.
  Status: `covered` by `acceptance-scenarios.test.ts`. The test operates the
  real `camera.zoomAt` path.

  It also keeps the grabbed world point under the cursor after an arbitrary
  zoom.
  The product has no recorded live observation of this scenario. The note said
  "still unasserted" until test and observation status separated on 2026-08-12.

- **FAIL-002**: Move quickly between adjacent docking targets. The dock preview
  does not flicker. `covered` (2026-08-12, `dock-preview.test.tsx`)
  This behavior does not depend on timing. The interaction state stores one
  resolved preview.
  The overlay and `finishCanvasInteraction` read that stored value. They do not
  complete another hit test.

  The test covers preview resolution, overlay output, and creation of the named
  group after release.
  A pointer can move through one region and keep one result. The test found no
  product defect.
  The first test used an incorrect half-region assumption. A dock region is not
  a geometric half.

  `getInfiniteCanvasGroupDockEdgeAtPoint` returns `center` when all four
  normalized edge distances are at least 34%.
  This area is the tab-merge zone. In all other areas, the function returns the
  nearest edge.
  A point in the left half can resolve to `south` when the bottom edge is closer.

- **FAIL-003**: Open and close windows quickly without stale index or layout
  candidates. `unbuilt`
  This scenario applies after the spatial index exists.

## Dashboard isolation

- **DASH-001**: Keep dashboard-grid rules inside a dedicated group or mode.
  `unbuilt`
  This scenario applies only if a dashboard mode ships.
