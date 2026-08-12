# Changelog

All notable changes to `@hyphened/infinite-canvas` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the package is `0.x`, minor releases may contain breaking changes. Breaking changes are always
called out under a `Changed` or `Removed` heading.

## [Unreleased]

<!--
Add entries here as you land user-facing changes. Use the Keep a Changelog
sections, in this order, omitting the ones that don't apply:

### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security
-->

### Added

- **Arrange verbs: `window.align` and `window.distribute`.** The action vocabulary had 48 types
  and no arrange family. `window-arrange.ts` is pure geometry —
  `getInfiniteCanvasAlignedRects` and `getInfiniteCanvasDistributedRects` — sibling to
  `window-placement.ts`, and the split matters: placement answers "where does _one_ window go
  inside a region", arrange answers "how do _these_ windows relate to each other". Alignment is
  relative to the windows' own collective bounds, never the viewport.

  **They translate and never resize**, which is what makes them safe: a window cannot be pushed
  below its `minSize` by an arrange, so there is no clamping pass and no constraint to violate.
  Distribute evens the _gaps_ rather than the centres — with windows of differing size those are
  different arrangements — and degrades to even overlap rather than refusing when they do not
  fit. **No default chords**: eight commands would need eight, the unclaimed space is nearly
  exhausted, and design tools do not agree on bindings for these. Bind through `hotkeyBindings`.

  One-shot commands over an explicit selection, never a layout mode: a canvas that keeps windows
  aligned as they move is a tiling manager, which risk R5 exists to prevent. Grouped windows are
  skipped, as `window.place` refuses one, because a member's rect is its group's projection.

- **Semantic LOD: `renderSummary` on the window definition.** What a window shows once it is too
  small on screen to read. **Rasterization cannot solve this and never could — a rasterized
  paragraph is still a paragraph**, only blurrier; at far zoom a window has to say something
  _different_. Opt-in per kind, and inert without it: the framework cannot invent a meaningful
  summary for content it does not understand.

  `getInfiniteCanvasWindowDetailLevel` thresholds on **effective screen size, not zoom** — at 20%
  zoom a 200px window is illegible and a 1200px window is fine, so thresholding on zoom would
  demote both or neither. The two thresholds form a **hysteresis band**, which is not optional:
  zoom is continuous, so a window at a single threshold flickers between body and summary for
  every pixel. `previousLevel` keeps the function pure while the band works.

- **Six semantic theme tokens.** `--icx-color-{foreground,accent,shadow,surface-raised,accent-muted,accent-surface}`.
  Most of the 48 previously-unbridged `--icx-*` tokens were the same white or the same accent at
  varying alpha, so restyling meant editing 48 values to change six. They now derive, value-preserving
  to the bit (`color-mix(…, transparent)` is exactly the `rgba()` it replaces). Six do **not**
  derive and are marked `NOT DERIVED (n/6)` in `theme.css`: the host chrome's near-accent tint
  family, its own near-black fill, and the active HUD button's foreground. Those six encode
  "light tint over a dark surface" in their values rather than in a token, and are therefore
  exactly what a light theme will fight.

- **Focus containment inside a window body** (FR-9's last structural piece). `Tab` at the desktop
  enters the **active** window's content and only its content; inside, it cycles that window's
  controls and wraps at the edges; `Escape` returns focus to the command surface, which is what
  makes the canvas hotkeys live again. `Shift+Tab` from the command surface is deliberately **not**
  claimed — backing out of the canvas to the rest of the page is the one direction a user cannot
  achieve any other way, and swallowing it would make the canvas a keyboard trap for the document.

- **A group's `role="tab"` now carries `aria-controls`** naming the window panel it reveals
  (FR-9). A window frame gains a real DOM `id`, namespaced by a per-canvas token minted with
  React's `useId()` at the desktop root and shared by the window and group layers, so
  `${instanceId}-window-${windowId}` stays unique even with two canvases on one page — the
  uniqueness problem that had kept this open. Browser-verified: every tab emits a correctly-formed
  reference and the active tab's resolves to its rendered frame; inactive-tab panels are lazily
  mounted, so their reference resolves on activation (the standard lazy-tabpanel pattern). The
  frame-id helper is internal for now — it ships public with the focus-trapping work it supports.

- **Every public name now carries a stability tier**, classified per module in
  `scripts/api-stability.json` and enforced by `scripts/verify-api-stability.mjs` in CI, in
  `prepublishOnly`, and on `pre-push`. **374 names shipped with no tier at all, which is not
  "no promise" — it is an implicit promise of stability on all 374, made by silence**, including
  on modules nobody has ever watched run. Now 312 stable and 42 experimental.

  Classification is per **module**, and the asymmetry is deliberate: a new export inside
  `geometry.ts` inherits stable without a manifest edit, and a new module in a barrel fails the
  build until someone decides what it promises. Every experimental entry names one of three
  reasons, each a fact about the repo rather than a feeling about the code — `unobserved`,
  `off-by-default`, `r3f-canary`.

  Auditing to write it produced a finding, and the finding produced a removal rather than a
  tier: **`window-scene-shell` exported fifteen names nothing called, and `scene-model` was a
  re-export of `window-proxy` under pre-proxy names nothing imported.** An export nobody uses is
  not a feature awaiting a consumer, it is a promise awaiting a break; both were unexported the
  same day, along with the `@deprecated` `getWindowSceneModel` / `InfiniteCanvasWindowSceneModel`
  aliases on the scene-layer context. The package has never been published, so the removal broke
  no one. Meanwhile `scene-layer-geometry`, `spatial-target`, and `window-proxy` sound like 3D,
  are pure-core roots that cannot reach `three`, and have real consumers — so they are stable and
  stay on the main entry. Purity is not a stability argument; size is not either; and
  _unconsumed_ is not a tier, it is a delete.

- **Group shells resize by their outer edge.** Eight handles around the shell, a `groupResize`
  interaction beside `groupMove` and `groupGutter`, and the `startGroupResize` command. The tree
  is never touched: the shell's `rect` changes and every member re-projects from it, which is the
  same invariant that lets snapping, camera framing, and persistence stay group-blind. One undo
  entry per drag, checkpointed at drag start.

  The shell's minimum size is **structural** — gutters, tab strips, accordion headers, and
  `MINIMUM_GROUP_PANE_EXTENT` per pane — exposed as
  `getInfiniteCanvasGroupMinimumSize(tree, metrics)`. It is deliberately **not** a member
  window's `minSize`, which the solver has never consulted: inside a tree a member has no rect
  of its own, so letting one stubborn window veto a resize of the group it merely belongs to
  would contradict the gutter drag, which already floors panes by share and extent. An
  accordion is sized against its **widest** child rather than the expanded one, because
  `setGroupActiveChild` is a command — a shell sized to the open fold would squeeze itself the
  moment a larger one expanded.

  `startGroupResize` takes that `minSize` as an argument, exactly as `startGroupGutterDrag`
  takes `availableExtent`: group metrics live in the render layer, and a pure reducer that
  guessed at them would hand a consumer with custom metrics a floor disagreeing with the
  layout in front of them.

  The handles sit entirely _outside_ the shell rect, unlike a window frame's, which straddle the
  edge. Everything inside a shell is member-window DOM and the window plane draws above the group
  layer, so an inward half would be buried under a pane and never receive a `pointerdown`.

- **`isWorldRectWithinViewport(camera, viewport, rect, marginPx)`** and `isUsableViewport` are
  public geometry helpers. The framework's frustum test: pure, synchronous, camera-derived, and
  free of the optional 3D peers. This is the predicate to build culling or virtualization on —
  **not** `useInfiniteCanvasWindowFramed`, whose store is written only by the R3F probe behind
  `@hyphened/infinite-canvas/scene` and returns its `true` fallback for every consumer who has not
  installed `three` and enabled `diagnostics.frustum`. Rasterization eligibility now shares it.

- **Resize by keyboard** (`Alt+Shift+Arrow`). `window.nudge` moved a window and nothing resized
  one; a keyboard-only session could open, focus, move, arrange, and close, but never reshape.
  Right and Down grow the window, Left and Up shrink it, and the origin never moves — only the
  east and south edges do, which is what "resize" means when there is no handle under a cursor
  to say otherwise. Ten screen pixels, converted through the camera as a nudge is, so the step
  stays ten screen pixels at any zoom; ten _world_ units would vanish zoomed out and fly off the
  screen zoomed in. It reuses `resizeRectFromHandle` rather than restating what a resize means,
  so it clamps against `minSize` exactly as a pointer resize does, and it refuses a grouped
  window for the same reason `interaction.startResize` refuses it.

  The chord vocabulary now reads: bare arrow moves a little, `Shift` moves a lot, `Alt` moves
  _focus_, `Alt+Shift` changes the shape, `Mod+Shift` tiles.

- **A command palette on every playground canvas** (`Mod+K`), built entirely on
  `getInfiniteCanvasContextualCommands` — a function public since the agent handle landed that
  **nothing consumed**. Its result already carried `label`, `description`, `hotkeys`, `group`,
  and `enabled` computed against the live state, so the palette is about sixty lines over an API
  that existed. The command layer was documented and undiscoverable; now it is only the former.
  Unavailable commands are shown greyed and inert rather than hidden: hiding them makes the
  palette lie about what the framework can do, and running them makes it lie about what it can do
  _now_. Playground glue, not a framework export — a palette is UI, and this framework is
  headless. What the framework owes it is the vocabulary, and it already had that.

  Reading the function directly rather than taking `context.contextualCommands` is what let one
  component mount on all eight routes: `InfiniteCanvasOverlayRenderContext<Kind, Payload>` is
  invariant in both parameters, because its `actions` _take_ windows of that kind, so `/drop-tray`
  could never have passed its context to a component typed for another. Nothing subscribes while
  the palette is closed, either — `useInfiniteCanvasState()` re-renders on every camera tick, and
  a palette nobody has opened has no business reconciling sixty times a second while you pan.

- **A world overview, as geometry rather than as a widget.** An infinite canvas has a failure
  mode nothing bounded does: you can pan into empty space and lose everything. Fit-all,
  directional focus, and recipes all recover you _after_ you are lost; an overview is the only
  affordance that answers "where is everything, and where am I in it" continuously.

  `getInfiniteCanvasMinimapLayout` projects windows, groups, and the camera's visible rect into
  a box of overview pixels; `getInfiniteCanvasMinimapWorldPoint` is its exact inverse, for
  click-to-navigate. Both pure. **The framework draws nothing** — a minimap is almost entirely
  a projection problem, and the projection is the part a consumer cannot easily get right; the
  rounded corners are the part they can. The same bargain `data-slot` strikes.

  The camera's visible rect is **unioned into the bounds**, so panning away from every window
  shrinks the content rather than pushing the viewport indicator out of the box — precisely the
  moment you reached for the overview. Scale is uniform on both axes, because a map that lies
  about aspect ratio is worse than no map. Windows behind an inactive tab or a collapsed fold
  are omitted, as are minimized ones: an overview maps what is on screen to be found. `/stress`
  draws one.

- **Offscreen indicators**, the peripheral half of that problem: `getInfiniteCanvasOffscreenIndicators`
  returns everything that does not overlap the viewport, nearest first, each carrying the `point`
  on the inset viewport edge where an arrow belongs, the `angle` to rotate it by, the `distancePx`
  it sorts on, and the `rect` to navigate to. Pure, like the minimap, and drawing nothing for the
  same reason. The minimap answers "where am I" and you look at it; this answers "where did my
  window go" and you don't.

  **A group is one indicator, not one per pane.** Four panes docked together share a bearing and a
  distance, and four arrows on one pixel is not information — so grouped windows fold into their
  group's rect, the same rule the rest of the framework follows. Minimized windows are omitted;
  windows behind an inactive tab are omitted individually and counted through their group, which is
  the thing you would navigate to.

  `options.limit` is **unbounded by default**, because only the consumer knows how big their canvas
  is — and a consumer who caps should say so, since a silent cap reads as "that's everything" when
  it isn't. `/stress` and `/groups` draw them, capped at twelve, with the count rendered.

- **A floating window over a group gets that group as its contextual parent** (FOCUS-002).
  Directional focus searches the group's members before the rest of the canvas, so a floating
  window needs no separate keyboard model — the mitigation the focus model was designed around.
  The smallest group whose rect contains the window's centre wins, since group rects may overlap
  and the tighter one is the one it is really in; area ties break on group id, so an arrow key is
  never ambiguous. Actual membership still takes precedence.
  `getInfiniteCanvasContextualGroup(state, point)` is public.
- **Keyboard window placement** (FOCUS-003). `Mod+Shift+Arrow` puts the active window in a half of
  the visible canvas and `Mod+Shift+Enter` fills it. Centring and the four quarters are commands
  without a default chord — every obvious candidate for centring (`Mod+Alt+C`, `Mod+Shift+C`)
  opens browser devtools, and the canvas `preventDefault()`s any chord it owns, so a default
  binding that shadows a browser shortcut is theft rather than a nuisance. `Mod+Alt+Arrow` was
  ruled out for the same reason: on macOS it switches browser tabs, and browsers do not let the
  page cancel it, so the tab would have changed _and_ the window moved.
  `getInfiniteCanvasWindowPlacementRect(bounds, region, size, minSize)` is public and is the only
  thing that knows what "left half" means, so pointer and keyboard placement cannot disagree.

  **Placement never snaps.** A left half nudged to align with the window beside it is no longer a
  left half, and the shortcut pressed twice would give two different rects. It acts on the
  **active** window rather than the selection — tiling three selected windows into one rect
  buries two of them — and refuses a grouped window, whose rect belongs to its tree. A tile
  narrower than the window's `minSize` grows away from the edge it is anchored to, so a
  too-narrow right half keeps its right edge instead of sliding off screen.

- **Tabs reorder by dragging them** (TAB-001). Where the pointer goes decides what the drag is:
  inside the strip it reorders, leaving the strip tears the window out. Until now _any_ six
  pixels of travel tore the tab out, which made `group.reorderChild` unreachable by pointer no
  matter how carefully you slid a tab sideways — the command existed and nothing compiled to it.
  Leaving the strip costs the same six **screen** pixels that entering the drag did: the strip's
  height is fixed in world units, so at low zoom a bare "below the strip" test would tear a tab
  out on the first downward wobble of a sideways drag. A tab whose child is a nested container
  still cannot float, and can now still be reordered.

- **Anything with a title can be renamed.** `window.setTitle`, `group.setTitle` and
  `workspace.setTitle`, with `setWindowTitle` / `setGroupTitle` / `setWorkspaceTitle` on the
  actions facade. Nothing in the model could be renamed before: five types carried a `title`
  and none had an action to change it, so a consumer building an inline rename had to close
  the entity and recreate it — losing its id, z-index, group membership and place in the undo
  stack. Deliberately no commands: a palette cannot invent a title. An empty or
  whitespace-only rename is refused, because a title is an accessible name before it is a
  label, and renaming to the same text returns the identical state so it never reaches undo.

- **Workspaces.** Virtual desktops — a named set of windows carrying the camera and selection
  you left it at, and deliberately _not_ nested canvases, which would need a second camera and
  a second input plane. Opt-in like groups: with none active, nothing is filtered. Switching
  saves the outgoing workspace and restores the incoming one, and is one undo entry;
  `activeWorkspaceId` and `workspaces` are part of the undo document while the camera is not.
  Reached by `workspace.cycle`, `workspace.showAll` and `workspace.removeActiveWindow`;
  creating and naming a set stays the consumer's. Membership is edited as a delta —
  `workspace.addWindow` / `workspace.removeWindow`, with `addWindowToWorkspace` /
  `removeWindowFromWorkspace` on the actions facade — because the replacement form makes a
  caller read the list, edit it and write it back, discarding anything that changed in
  between. `workspace.setWindows` remains for a restore, which genuinely does own the whole
  list. Persistence envelope moves to version 3,
  and versions 1 and 2 migrate to no workspaces rather than being rejected.

- **Every pointer gesture now has a keyboard form.** Docking was the largest of them: the whole
  group model — the library's biggest feature — was reachable only by drag, because
  `resolveInfiniteCanvasDockPreview` reads a world point. `window.dockDirection` and
  `window.undock` close that, and `resolveInfiniteCanvasDockPreviewForTarget` produces the
  _same_ `InfiniteCanvasDockPreview` a drop produces, committed through the same
  `applyInfiniteCanvasDockPreview` — so a keyboard dock and a dropped drag are one operation
  with two ways in rather than two implementations to keep agreeing. Direction names where the
  window travels and it lands on the far side's near edge, matching a drag onto that half.

  Alongside it: `group.setLayout` (split / tabs / accordion), `group.flipAxis`,
  `group.dissolve`, `group.moveChild`, `group.resizePane`, `group.equalizeChildren`, and
  `window.swap`. Several of these existed in the reducer and reached no user at all —
  `setInfiniteCanvasGroupAxis` had no action, no store method and no command since the day it
  was written, so a split's orientation could never be changed.

- **Window lifecycle commands: `activeWindow.close`, `.minimize`, `.toggleMaximized`,
  `.togglePinned`.** These lived only as `onClick` handlers on the chrome buttons, so no chord
  could be bound to them, no palette could list them, and a consumer replacing the header slot
  lost the capability. `activeWindow.*` rather than `window.*` because `window.close` is
  already an _action_ type and the two vocabularies are otherwise disjoint. There is
  deliberately no `activeWindow.restore`: minimizing hands the active window to the next
  visible one, so it could never be enabled.

- **Camera commands: `view.pan` and `view.zoomBy`.** The camera had fit-all, fit-selection and
  reset-zoom, so a keyboard user could jump the view but not move or scale it — on an infinite
  canvas, the primary interaction. Pan shares `window.nudge`'s direction-to-delta mapping so the
  two cannot disagree about which way is up; zoom anchors on the viewport centre, there being no
  pointer to anchor on.

- **`selection.extendDirection`** — the keyboard's Ctrl+click. Every arrange verb needs two or
  more selected windows, and `window.focusDirection` _replaces_ the selection with the window it
  focuses, so the arrange family was listed in the palette and unusable without a pointer.

- **Window capabilities.** `capabilities` on a window declares which chrome affordances it
  supports — `closable`, `maximizable`, `minimizable`, `resizable`, AppKit's vocabulary. Every
  field is optional and **absent means permitted**, so nothing existing changes and no persisted
  document migrates; read them through the new `isInfiniteCanvasWindowCapable`. They are
  **enforced by the reducer**, not merely respected by the chrome: `actions.closeWindow` on a
  `closable: false` window returns state unchanged. An advisory flag would be a lie the UI
  tells. Withheld buttons render `disabled` with `data-disabled`; resize handles are withheld
  outright, an invisible hit target having no useful disabled state.

- **`InfiniteCanvasProvider` accepts a `store`.** `createInfiniteCanvasStore` and
  `createInfiniteCanvasHandle` were public exports no consumer could reach: the provider minted
  its own store and the handle's only argument source was a hook inside the tree, while its
  stated audience — agents, E2E drivers, command palettes — is all parent-side. Either
  `initialState` or `store`, never both; supplying both is a compile error. Persistence follows
  `storageKey`, not store ownership.

### Changed

- **`hitRadius` on an edge target is screen pixels, not world units.** It was compared against a
  raw world distance, so an edge that was easy to click at 100% became unclickable as you zoomed
  out — the threshold shrank with the canvas. It now converts through the camera, the same way
  `snap-resolver` treats its own thresholds, so the two subsystems answer "close enough to
  catch" the same way. Consumers who tuned a value against the old behaviour will want to
  re-check it.

- **Semantic LOD defaults are `fullAbovePx: 160` / `summaryBelowPx: 120`,** down from 240 / 180.
  The old restore threshold sat above the extent of an ordinary window: a 300×210 window at 100%
  zoom measures 210, under 240, so it demoted to its summary on any zoom-out and never came
  back. The band now sits below the sizes windows actually are.

- **Frame slots take `render` and arbitrary consumer props.** Each slot merges them with
  Base UI's semantics, transplanted rather than depended on: consumer event handlers run first
  and can suppress the framework's, `className` concatenates, `style` merges per declaration
  with the consumer last, and `data-slot` stays framework-owned.

- **`isInfiniteCanvasCommandEnabled` and `getInfiniteCanvasContextualCommands` take an optional
  zoom policy.** A zoom step is offered only when it would move, and whether it moves depends on
  the policy's floor — computing enablement against the default while executing against a custom
  policy would grey out a step that works.

- **Reset zoom is `Shift+0`, not `Mod+0`.** Breaking for anyone who learned the old chord, and
  the old chord never worked the way it looked. The browser reserves `Mod` with `0`, `+`, and
  `-` above the page: the keydown arrives, `preventDefault()` returns without error, and the
  page zoom resets anyway. So `Mod+0` reset the canvas _and_ the browser — two surprises for
  one keypress, and the canvas's was the one the user could not see happen.

  This is the rule this repository already wrote down when it rebound the placement chords off
  `Mod+Alt+Arrow`: **a default chord that shadows a browser shortcut is theft, not a nuisance,
  because the canvas `preventDefault()`s every chord it owns.** The rule was stated two entries
  below the descriptor that broke it. `Shift+0` joins the view family (`Shift+1` fits all,
  `Shift+2` fits the selection) and is unclaimed; it survives keyboard layout because
  `@tanstack/hotkeys` falls back to `event.code === "Digit0"` when `Shift+0` yields `)`, which
  is the path `Shift+1` and `Shift+2` have always taken. Rebind through `hotkeyBindings`.

- **`DOCK-004`'s tear-out trigger is now "leave the strip", not "travel 6px".** TAB-001 needed
  those pixels. Dragging a tab out of its strip still undocks the window and hands the same
  pointer to a normal window move.
- **Every drag interaction stores `originCamera` instead of a cached `zoom` scalar**
  (`move`, `resize`, `groupMove`, `groupResize`, `groupGutter`). `pan` already did, because a
  pan _is_ a camera change and could not have been written any other way. Consumers reading
  `interaction.zoom` should read `interaction.originCamera.zoom`.

### Fixed

- **`interaction.step` was dispatched twice for every pointermove of every drag.** A comment in
  `infinite-canvas.tsx` claimed the mount-scoped `window` listener was "the single source for
  interaction steps"; it was false the day it was written. Four React `onPointerMove` handlers
  survived the fix that comment describes — the window header, the window resize handle, the
  group resize handle, and the group gutter — and three of the four omitted `dockIntent`, which
  is the modifier race the friction backlog had already recorded a lesson about. Removed, and
  `single-dispatcher.test.ts` now enforces by reading the source what the comment could only
  assert.

- **An inactive tab's `aria-controls` pointed at a panel that was not in the document.** A tabs
  container renders only its active child, so every other tab named a frame id that did not
  exist. A dangling reference is worse than an absent one: assistive technology follows it,
  finds nothing, and says nothing. The attribute is now emitted only where the panel exists.

### Removed

- **The pre-proxy scene-model surface.** `getInfiniteCanvasWindowSceneModel`,
  `getInfiniteCanvasWindowSceneModels`, the `InfiniteCanvasWindowSceneModel` type, and the
  `@deprecated` `getWindowSceneModel` field on the scene-layer render context — all aliases of
  the `window-proxy` vocabulary that superseded them, each marked deprecated or re-exported under
  an old name, and **none of them called by anything**. Use `getInfiniteCanvasWindowProxy`,
  `getInfiniteCanvasWindowProxies`, `InfiniteCanvasWindowProxy`, and `context.getWindowProxy`.
- **The `window-scene-shell` barrel exports** (fifteen names: the scene-shell projections, local
  frame-rect helpers, and their types). Nothing outside the module's own test imported them. The
  module stays on disk — `window-proxy` uses one of its functions internally — so this is an
  export removal, not a deletion, and it is re-exportable in a minor if a consumer ever needs it.

- **Arrow-nudging a grouped window detached it from its shell.** A group member is selectable,
  and `window.nudge` wrote straight to `window.rect` — but a member's rect is the _projection_
  of its group's tree, and `command.execute` is not re-projected the way `interaction.step` is.
  The pane slid out of the shell and stayed there until some later mutation re-solved the tree
  and silently snapped it back. Nudging a group member now translates the **shell**, exactly as
  dragging that member's header does, and each group moves once however many of its members are
  selected. `close`, `maximize`, and `minimize` already detached the window from its group first;
  `nudge` was the one command that did neither.
- **Zooming mid-drag slid the window out from under the cursor** (FAIL-001). Each drag cached
  `zoom` at its start and divided the whole accumulated screen delta by that one scalar, and the
  wheel handler is not gated on an active interaction. Grab a window at zoom 1, drag 100px right
  (world +100), zoom to 2, drag 100px more: `screenDelta / 1` claims +200 where the pointer has
  really travelled 100 + 50 = **150**. The error grew without bound in the remaining length of the
  drag, and it applied to every drag the framework has. The world delta is now derived from two
  screen→world projections — the origin pointer under the origin camera, the current pointer under
  the current camera — which is correct across a zoom _and_ a pan. It reduces exactly to the old
  expression when the camera has not moved.
- **Panning discarded a zoom performed mid-pan** — the sibling of the bug above, on the one drag
  that "carried `originCamera` all along" was said to be immune to. Pan's _delta_ was always
  correct; its _output_ was not. Each pan step wrote `camera: { ...originCamera, center }`, so it
  spread the pan-start zoom back over the live one every frame, and a `Ctrl`/`Cmd`+wheel or
  trackpad pinch during a held pan was undone on the next pointermove. The step now anchors the
  world point grabbed at pan-start and re-projects it through the current zoom; with the zoom
  unchanged it is bit-identical to the previous behaviour, and it differs only in the
  concurrent-pan-zoom case that was broken.
- **Every `scope="window"` portal painted underneath the window it belonged to.** The window
  portal root rendered _before_ the frame and carried no `z-index`, while the frame carries its
  stack value. Both are positioned, so paint order falls to `z-index` first and document order
  second, and the frame won both. A portalled popover was mounted, laid out, and completely
  hidden behind the opaque window body — present in the DOM, invisible on screen.
  `scope="window"` had never worked since it shipped in `0.1.0`, and `/portals` demonstrated the
  bug rather than the feature. The root now renders after the frame and shares the frame's stack
  value: above its own window, still below any window stacked higher, which is what "belongs to
  this window" has to mean. The root stays `pointer-events: none`, so interactive portalled
  content sets `pointer-events: auto` on itself, the same contract `renderOverlay` uses.
- **A grouped window's dead resize handles ate the gutter drag.** `interaction.startResize`
  refuses a grouped window outright — a pane is resized by its seam — but the frame drew its
  resize handles anyway. Handles straddle the frame edge, hanging half their extent outside
  it, and the window plane draws above the group layer, so two adjacent panes covered the
  gutter between them with controls that could not do the thing their cursor promised, and
  swallowed the seam's `pointerdown`. Handle extent is constant in _screen_ pixels while the
  gutter is fixed in _world_ units, so the seam dragged when you were zoomed in and quietly
  stopped as you zoomed out — which reads as "sometimes it works". A grouped window now
  draws no resize handles; the **shell** carries them instead, on its outer edge (see Added).
- **`Alt`+drag to dock did nothing.** One physical `pointermove` during a window drag
  dispatched `interaction.step` three times: from the window header (carrying
  `dockIntent: event.altKey`), from the canvas root (carrying nothing), and from the
  mount-scoped `window` listener (carrying the modifier again). The canvas root is an
  ancestor of every window frame, so a header drag bubbles into it, and its step resolved
  `dockIntent` to `false` and wiped the `dockPreview` the header had just resolved.
  Whether docking worked came down to which handler ran last. The root's `onPointerMove`
  was a leftover from before interaction listeners became mount-scoped; the `window`
  listener is now the single source for interaction steps. Also cuts the reducer work per
  pointermove from three passes to one.
- **An accordion's headers had no keyboard navigation between them** (ACC-001). They were
  focusable `<button>`s that activated on Enter/Space, but nothing moved focus from one to the
  next. Each accordion container is now one roving tab stop, and **its arrows follow the
  container's axis** — a vertical accordion answers `Up`/`Down`, a horizontal one
  `Left`/`Right`. Hard-coding `Left`/`Right` the way a tablist does would make `Down` walk a
  row of side-by-side headers, which is the diagonal drift directional focus refuses
  everywhere else. `Home`/`End` are axis-independent. `InfiniteCanvasGroupAccordionHeader`
  gains an `axis` field so the keyboard handler reads the solver's answer instead of
  re-deriving geometry the solver owns.
- **A group's tab strip was one tab stop per tab.** Every tab is a `<button>`, so Tab walked
  all of them — three groups of four tabs put twelve stops between a keyboard user and anything
  else on the page. The tablist now carries a roving `tabIndex` and moves between tabs with
  `Arrow` / `Home` / `End`, per the ARIA Tabs pattern. Activation stays manual (`Enter` /
  `Space`, through the same `onClick` the pointer uses): arrowing across a strip under automatic
  activation would mount and discard a window body per tab. Focus moves with `preventScroll`,
  because the strip lives inside the shell's `transform: scale(zoom)` and a plain `focus()`
  scrolls ancestors to reveal a tab that is already in view.
- **`diagnostics.frustum` swept its whole tracked window set every frame.** The probe layer
  re-renders on each camera tick and rebuilt its window-id array per render, so the effect that
  drops departed windows re-fired on every pan step — and its membership test was a linear scan
  inside a filter, so the sweep was quadratic in window count. The instrument was perturbing the
  frame cost it exists to measure. Memoized on the window list, and the scan is now a `Set`.
- **`rasterization.maxPendingCaptures` bounded the queue by breaking it.** Any finite value
  left every refused window permanently un-rasterized: the queue dropped the request, but the
  window body had already recorded the capture as requested and never asked again. A bound is
  only reached at stress scale, which is precisely where the blank windows appeared. Capture
  requests now report whether they were accepted, a refused request is not recorded, and a
  window waiting on a full queue re-arms when the queue drains. Bodies subscribe to that
  full/not-full edge only while they are actually waiting, so finishing one capture does not
  re-render every other window. The default queue is unbounded, where this changes nothing.

## [0.1.0] - 2026-06-24

Initial release.

### Added

- **Infinite 2D canvas.** Pan and zoom over an unbounded workspace under an orthographic camera,
  with a configurable zoom policy and a canvas-space grid backdrop.
- **First-class window management.** Windows are the primitive, not an afterthought: open, close,
  focus, pin, minimize, maximize, restore, move, resize, and explicit z-order control.
- **Pure reducer core.** Every state transition is a plain `(state, action)` function over
  serializable data — no React, no `three`, no observable runtime. Geometry, selection, snapping, and
  the command layer all live below the renderer and can be driven headlessly.
- **Selection model.** Multi-select with marquee, an anchored selection with union bounds, and group
  move across the whole selection.
- **Snapping with visual guides, and hysteresis.** Edge, center, and gap alignment resolved against
  live snap candidates during move and resize, with preview guides rendered as the drag happens. A
  guide that has caught holds until the pointer travels `releaseThreshold` away, while an idle guide
  still engages at `threshold` — so the pointer crosses a band, not a line, and a window parked on the
  boundary no longer shivers between snapped and free. Hysteresis is per guide, not per axis: two
  guides on the same axis release independently.
- **Undo and redo.** `Mod+Z` and `Mod+Shift+Z` (or `Mod+Y`) across every window and group mutation.
  History is over the _document_ — the windows and the groups — because everything else is a view onto
  it. Panning is not an edit, and undo never scrolls the canvas out from under someone who just wanted
  their window back. A drag is one entry, not one per frame: the checkpoint is taken when a mutating
  drag begins, so a cancelled drag still has somewhere to return to. Bounded at 100 entries; discarded
  on hydrate and reset; session-scoped and never serialized, because a layout is a document, not its
  edit log.
- **Layout recipes.** `captureInfiniteCanvasRecipe` saves a named arrangement — the selection, a named
  set, or the whole canvas — relative to its own origin, so it drops into any region of an unbounded
  world. `applyInfiniteCanvasRecipe` puts it back: windows it does not name are untouched, windows the
  canvas has lost are skipped, and any group holding a recipe window is dissolved first so two things
  never claim to own the same window's rect. A group is captured only when every one of its members
  is. Recipes translate rather than scale — fitting an arrangement into a smaller region would push
  windows below their own `minSize`. They are plain values the consumer owns and persists, and
  `parseInfiniteCanvasRecipe` treats one crossing storage as untrusted input. Applying one is a single
  undo entry.
- **Portal roots.** A window frame is `transform: scale(zoom)`, which makes it the containing block for
  `position: fixed` — so a popover, menu, or tooltip inside a window body resolves against the _frame_,
  lands in the wrong place, and is scaled by the zoom. `<InfiniteCanvasPortal>` mounts content into a
  root outside every transform: `scope="desktop"` for overlays that escape the window entirely, and
  `scope="window"` for content that must track its window at natural size. The window root is opt-in
  per window kind (`portalRoot: true`) — mounting one for every window would cost a style write per
  window per camera tick. The portal renders nothing until its root exists rather than falling back
  into the transformed subtree, because a popover that quietly appears in the wrong place is a bug the
  consumer will chase into their own code.
- **Input ownership, decided rather than incidental.** Wheel deltas are normalized through
  `event.deltaMode`. The line-mode calibration was 16px, which made one Firefox notch travel about
  half as far as the same notch in Chrome; it is now 40, the value `normalize-wheel` settled on. A
  zoom gesture outranks a scrollable window body — pinching inside a long list zooms the desktop
  rather than doing nothing — while the plain wheel still belongs to the body. Trackpad pinch is
  Ctrl+wheel, which is why it and Ctrl+wheel have always shared one code path.
- **Chrome that survives zooming out.** Window strokes are drawn in world units inside a zoom-scaled
  frame, so a 1px border rendered as `1 × zoom` screen pixels — a tenth of a pixel at 10% zoom.
  Borders, the header rule, and the inner frame thinned to nothing exactly when the user zoomed out to
  see how their windows relate. Every stroke now reads `--icx-chrome-stroke`, published by the frame
  and clamped so nothing renders below one screen pixel. Above 100% zoom it changes nothing.
- **Keyboard command layer.** Hotkeys bound to the same command vocabulary the pointer interactions
  use, so anything the mouse can do the keyboard can express. Includes **directional window focus**
  (`Alt+Arrow`): the nearest window strictly ahead along the arrow wins, and one whose span overlaps
  yours on the cross axis beats one that is merely closer — so arrow keys never drift diagonally and
  Right-then-Left returns you where you started. A chord the command surface owns is swallowed even
  when its command is unavailable, so a focus move at the edge of your windows cannot fall through to
  the browser's Back and take the document with it.
- **Camera navigation commands.** Programmatic camera moves — focus a window, frame the selection,
  fit the world, zoom to a point — as commands rather than imperative camera pokes.
- **Versioned, document-scoped persistence.** Canvas state serializes to a versioned envelope, keyed
  per document, and is validated and recovered on read: unknown window kinds and stale references are
  dropped rather than crashing the canvas. The envelope is at `version: 2`; a `version: 1` payload
  (which predates groups) still parses and migrates to `groups: []`. Making `groups` an optional field
  on `version: 1` would have looked backward-compatible right up until an older build read a newer
  payload, dropped the field it did not know, and wrote back a layout with every group deleted.
- **Typed drag and drop, snapped and previewed.** A drop-target contract with spatial resolution, so a
  payload dropped on the canvas resolves to the window (or the empty canvas region) actually underneath
  it, in canvas coordinates. Tell the framework how large the payload will be with
  `dropPolicy.placement` and the drop snaps against the same candidates a window move snaps against —
  the framework draws the guides itself, instead of every consumer redrawing them. `onDrop` receives
  the _same_ placement object the preview was drawing, not a second computation: two calls can
  disagree, and when they do the payload lands somewhere other than where the ghost promised.
- **Read-only R3F / WebGPU scene layers, as an opt-in entry.** `sceneLayers` render React Three
  Fiber content above or below the DOM window plane on a transparent WebGPU surface, in camera-owned
  world space or DOM-aligned screen space, backed by projected window proxies. The surface itself
  ships from `@hyphened/infinite-canvas/scene` and is injected via the `sceneSurface` prop, which makes
  `three` and `@react-three/fiber` genuinely optional peers: the main entry never reaches them, so a
  consumer who does not render scene content can leave both uninstalled. Passing `sceneLayers`
  without a `sceneSurface` warns in development rather than silently rendering nothing.
- **Window groups.** Windows compose into a group shell: a world object that owns a local layout and
  moves as one thing. Inside, an n-ary container tree arranges them as a `split` (weighted panes with
  draggable seams), `tabs` (one visible child behind a tab strip), or an `accordion`. Nine canonical
  mutations — create, close, dock, undock, move/resize the shell, change layout mode, activate a
  child, reweight children, reorder — so pointer, keyboard, and programmatic drivers compile to the
  same vocabulary.

  **The group is the source of truth and a member's `rect` is its projection.** Every mutation
  re-solves the tree and writes the result back onto `window.rect`, which is what keeps snapping,
  selection bounds, camera framing, persistence, and the scene-layer window proxies group-blind. A
  window belongs to at most one tree; closing or minimizing one detaches it; removing the last member
  destroys the shell.

  Dragging a grouped window's header moves its shell as one world object. Dragging the seam between
  two split panes reweights them — every step recomputes from the container as it stood when the drag
  began, so the seam stays under the cursor rather than drifting as rounding accumulates. Dragging a
  tab out of its strip tears the window free and hands the same pointer to a normal window move; it
  keeps the rect the solver gave it, which for a hidden tab is the size it would have been revealed
  at. Docking by drag is not built yet; its command and hit-test exist. Resizing a grouped window
  directly is refused: a pane is resized by its seam.

- **Custom window chrome.** Replace the default header, controls, and corners wholesale via
  `renderFrame`, or slot into the existing frame. `renderFrame` is memoized on the window's own
  identity and is **not** re-invoked when the camera moves — a window's chrome must not reconcile on
  every pan frame. Its `context.state` is live at call time; implementations that need to re-render
  when state changes should subscribe with `useInfiniteCanvasSelector` inside their own components,
  so invalidation stays scoped to what they read. This is the contract `renderBody` already has.
- **Headless styling contract.** Framework components emit a stable `data-slot` attribute
  vocabulary and no visual identity; `@hyphened/infinite-canvas/theme.css` is an opt-in cascade layer
  over that contract, so consumer styles always win. Enforced by a boundary test.
- **Accessibility contract.** Windows expose `role="group"`, an accessible name, and
  `aria-roledescription="window"`; the active window is marked with `aria-current`. Every
  framework-rendered button has an accessible name, and unavailable commands are `disabled`.
  The Close and Minimize controls return DOM focus to the command surface before they unmount,
  because focus falling to `<body>` silently kills every hotkey with nothing to tell the user why.
- **Packaging gate.** `scripts/verify-artifact.mjs` asserts, on every build and before publish, that
  the JS entry is marked `"use client"` and the declaration files are _not_ (a directive prologue is
  a statement, and would fail every consumer without `skipLibCheck`), that `@zumer/snapdom` stays
  dynamically imported, that `three` and `@react-three/fiber` are reachable only from `./scene` and
  never from the main entry — not even through a dynamic `import()`, which bundlers resolve eagerly —
  that every top-level import in every chunk is a declared dependency or peer, and that the type
  declarations emit.
- **Experimental programmatic handle.** `createInfiniteCanvasHandle(store)` exposes a state
  snapshot, the typed command facade, and contextual command descriptors for automation and testing.
- **Drivable by synthetic input.** Every pointer interaction — move, resize, pan, marquee, and drop —
  listens from mount rather than attaching after React commits the pointerdown. A
  `pointerdown → pointermove → pointerup` sequence dispatched in one synchronous block does what it
  says, which is how automation and browser-mode tests drive a canvas.

[Unreleased]: https://github.com/tyler-mitchell/infinite-canvas/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tyler-mitchell/infinite-canvas/releases/tag/v0.1.0
