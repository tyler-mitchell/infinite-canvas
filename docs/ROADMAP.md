# Roadmap

> Adopted on 2026-06-10 after the headless extraction and the first performance change.
> Each entry is a large, multi-session program with specifications, exit conditions, and dependencies.
> The precedence rules in [README.md](README.md) apply.
> A linked specification controls when it differs from this summary.

## Execution slate from 2026-08-12

This slate records the order selected on 2026-08-12. It does not replace programs P1 through P8. The prior
slate contained work that took one or two hours for each item. The new slate came from direct product use.

### Gate status at adoption

The documents recorded this state when the slate started:

| Gate               | State                   | Remaining action                                                                                   |
| ------------------ | ----------------------- | -------------------------------------------------------------------------------------------------- |
| Publish to npm     | Ready                   | The owner can enter `pnpm publish`.                                                                |
| Public repository  | Owner-gated             | The owner must approve one irreversible `git filter-repo` purge.                                   |
| "production" claim | One agent item remained | `focus-trap.ts` and the 221-line body-content route existed. C2 covered 9 of 15 planned scenarios. |

The P2 measurement required real hardware. A documented performance limit did not block version 0.2.0.

### Semantic LOD defect

Semantic LOD first shipped with 11 unit tests. The `/stress` route used windows that measured 300 by 210
pixels. The `extent` calculation used the smaller axis. The old restore threshold was 240 pixels.

A window moved to a lower detail level after zoom out. It did not return to full detail at 100 percent zoom.
Commit `aa5f085` corrected the threshold.

The tests asked "does the hysteresis band work" with synthetic values. They did not ask "is a real window full
detail at 100% zoom". The slate thus requires product registries and real window sizes in feature evidence.

### M1: close the missing C2 scenarios

Status: done on 2026-08-12.

The added scenarios were DOCK-003, SPLIT-001, ACC-001, FAIL-001, PERSIST-001, and the FOCUS family. They
joined the nine existing scenarios. All 17 scenario identifiers passed. The result contained 237 tests across
27 files.

This work removed the last agent-controlled production item from the adoption table. The P2 measurement still
required real hardware. That measurement did not block a documented 0.2.0 release.

ACC-001 required moving `getNextRovingIndex` from `group-layer.tsx` to `window-focus.ts`. The function
contains pure keyboard geometry. A render module was the wrong test boundary.

The first FAIL-001 test used the number from the document. That number assumed pointer-anchored zoom through
`camera.zoomAt`. The corrected test drives the real camera path. It also proves that the grabbed world point
stays below the pointer.

Exit status: met.

### M2: product-shaped evidence

Status: partial.

The planned suite uses playground registries and real window sizes. It covers these product facts:

- Each stock window uses full detail at zoom 1.
- Each arrange command is enabled only when its precondition holds.
- Each default chord resolves to a command.
- Each component token with the `--icx-*` prefix has a definition.

One stale command defect is closed. `window.__canvas.contextualCommands()` previously returned
`context.contextualCommands`. That array used the `state` value from the canvas render. The same handle
returned `context.state` through its state field.

The two reads described different moments. All six align commands reported `enabled: false`. The palette
enabled the same commands, and command execution moved a window.

The handle calculates commands from the same state value that it returns. `dev-handle.ts` records the
reason beside the change.

Exit conditions:

- The suite fails after a threshold makes a stock window leave full detail at zoom 1.
- The developer handle and palette report the same command state.

### M3: complete the theme system

Status: open under P3.

`theme.css` defines 65 tokens with the `--icx-*` prefix. The public `theme` prop exposes 11 of those tokens.
The remaining 54 tokens require direct CSS changes.

There is no `prefers-color-scheme` rule. There is no `[data-theme]` rule. The framework has no complete
light-theme example.

The audit covers snap guides, marquee selection, dock previews, gutters, tab strips, and accordion headers. It
also covers resize handles, the minimap, offscreen indicators, and HUD parts.

Exit conditions:

- A playground control switches between two complete themes.
- Every framework part receives a theme value in both themes.
- The prop exposes the same token count that the stylesheet defines.

### M4: mounted window culling

Status: implementation done on 2026-08-12. Performance evidence remains open under P2.

Culling must keep window subtrees mounted. Removing an offscreen window from `visibleWindows` removes its DOM
subtree. Focus then moves to `<body>`. Portal roots detach.

Body scroll position, video playback, and uncontrolled input state are lost.

The implementation skips transform updates for offscreen windows. It also adds `content-visibility: auto`. The
predicate is `isWorldRectWithinViewport`. It first calls `isUsableViewport`.

A `0 × 0` viewport must not hide the first frame.

`window-frame.tsx` owns this behavior. A frame outside `CULL_MARGIN_PX` gets `content-visibility: auto`. The
margin is 480 screen pixels. `contain-intrinsic-size` matches the screen rectangle.

The active window is exempt. Keyboard focus and window commands target that window. Selected windows are not
exempt. A `Mod+A` selection is unbounded and must not disable culling.

The margin uses screen pixels. A world-unit margin becomes smaller after zoom out. Zoom out is the condition
that places more windows near the viewport edge.

`culling.test.tsx` proves that an offscreen window remains in the document. It also proves that a `0 × 0`
viewport hides nothing. The first test incorrectly read the body style. The body already used
`content-visibility` for raster policy.

The corrected test reads the `<article>` style. A mutant with no
culling makes the corrected test fail.

The same change added the transform skip. React continued to render each culled frame after every camera
change. That work rebuilt a style object for content that the browser did not paint.

A memo comparator stops only when both frame states are offscreen. It also requires equal non-projection
props. The previous transform can remain stale because the frame is not visible. The next visible state always
renders with the current camera.

The comparator examines all props instead of a manual list. A new prop thus participates without another
comparator edit. A manual list previously caused a related defect in `cloneInfiniteCanvasState`.

The 160-window performance exit remains unmeasured. The browser evidence covers mounted subtrees and the
initial 0 × 0 frame. The browser uses `content-visibility` to skip layout and paint for hidden frames. The
related suite had 469 tests when this status was recorded.

### M5: workspaces

Status: model, commands, and showcase implemented on 2026-08-12. The showcase had no visual review at that
time.

A workspace is a virtual desktop. It contains a named set of windows. It also stores camera state and
selection for that set.

The rejected label was "nested canvases". A nested canvas adds another camera and input plane. A workspace
uses one canvas and a membership filter.

The model added four reducer actions. Persistence moved to version 3. The window layer filters the render set.

Workspace switching keeps camera state and selection for each workspace. The state survives reload. One switch
creates one undo entry.

`activeWorkspaceId` and `workspaces` belong to the undo document. Camera movement alone does not belong to
that document. A switch stores the outgoing camera state and selection. Thus, workspace choice is an edit
while ordinary pan is not.

The command set includes `workspace.cycle`, `workspace.showAll`, and `workspace.removeActiveWindow`. The cycle
command wraps at both ends. The show-all command removes the filter without closing windows. The remove
command removes the active window from the current workspace without closing it.

The command layer was added with the model. This prevented another unreachable reducer API. Past examples
included `setInfiniteCanvasGroupAxis` and lifecycle behavior that existed only through `onClick`.

The "all windows" view is outside the workspace ring. A cycle from that view enters the first or last named
workspace. It does not add an extra item to the ring.

The `/workspaces` route shows two desktops. Each desktop has different work. One window belongs to neither
desktop. That window makes "show all" distinct.

The switcher uses existing commands. The playground palette uses `getInfiniteCanvasContextualCommands`.
Workspace commands thus appear without separate palette wiring.

Workspace creation and naming require consumer input. `workspace.create` and `workspace.close` remain
`parameterized`. The switcher supplies the required identifiers.

At this status point, the route typechecked and built. No one viewed the route.

A later source review found an open-window defect. A new window did not join the active workspace. The
membership filter removed that window in its first frame.

Existing `workspaces` paths only removed identifiers through `detach` or `reconcile`. No path added a new
identifier. The user saw the new window only after entering "show all".

`window.open` adds a new window to the active workspace. It is the only window creation path. Drop behavior
dispatches `window.open`. Recipes only `map` over existing windows.

The correction thus covers all creation paths.

### Deferred work

- Columns mode remains deferred.
  It breaks the "only weight ratios matter" invariant in `group-tree`. A column uses an absolute extent and requires local shell
  scrolling. Risk R11 records this issue.
- P2 measurement remains deferred to real hardware.
  The benchmark works, but the embedded preview limits `rAF` under load.
- Texture capture remains deferred.
  It requires Chrome 148 or later with the Origin Trial flag.
- npm publication and the history purge remain owner actions.

## P1: grouping and docking

Status: the core capability landed on 2026-07-08. The later M1 work completed the scenario evidence.

Group shells are world objects in `InfiniteCanvasState.groups`. `group-tree.ts` stores the n-ary tree,
weights, and normalization. `group-layout.ts` calculates layout. `group-state.ts` writes the calculated
rectangles to each `window.rect`. Other framework modules can thus remain unaware of group structure.

The reducer has nine group actions. The facade covers create, close, dock, undock, rectangle changes, layout
mode, active child, weights, and reorder. Persistence first stored groups in `version: 2`. A `version: 1`
document migrated to `groups: []`.

`group-layer.tsx` renders shells, gutters, tab strips, and accordion headers. The `/groups` route demonstrates
the model.

Pointer behavior includes these paths:

- A grouped header moves the complete shell under DOCK-003.
- A split seam changes the related weights under SPLIT-001.
- Each seam calculation starts from the container state at drag start.
- A tab drag outside its strip removes the window under DOCK-004.
- The same pointer continues as a normal window move.
- A tab drag inside its strip reorders the tab under TAB-001.
- Alt with a floating-window drag docks onto a window or group member under DOCK-001 and DOCK-002.

Docking requires explicit intent. A normal drag keeps overlap behavior. The intent overlay shows the selected
dock region. Alignment guides are hidden while the overlay is active.

The overlay and reducer use the same calculated value.

A shell resize uses the `groupResize` interaction. It changes `group.rect` beside `groupMove` and
`groupGutter`. The group tree does not change. Member rectangles are calculated again.

Direct resize remains unavailable for grouped windows. A pane uses its seam. A shell uses its outer edge. The
frame hides handles that cannot work.

The shell minimum is structural. It includes gutters, strips, headers, and `MINIMUM_GROUP_PANE_EXTENT` for
each pane. It does not use each pane `minSize`. The solver never reads `minSize` because a tree member has no
independent rectangle.

Shell handles sit completely outside the shell rectangle. Member DOM covers the inside area above the group
layer. An inside handle area cannot receive pointer input.

Tab drag position selects the action. Movement within the strip reorders the tab. Movement outside the strip
removes the tab. The prior six-pixel threshold made `group.reorderChild` unreachable through pointer input.

At the initial P1 completion date, all gestures were present. The scenario states were `built` but had no
assertions. M1 later added the DOCK, SPLIT, TAB, ACC, FAIL, FOCUS, and PERSIST assertions.

The specification sources are:

- [research/grouping-and-docking.md](research/grouping-and-docking.md)
- [research/state-focus-and-recipes.md](research/state-focus-and-recipes.md)
- [research/snapping.md](research/snapping.md)
- [research/acceptance-scenarios.md](research/acceptance-scenarios.md).

The planned acceptance identifiers were DOCK-001 through DOCK-005, SPLIT-001 through SPLIT-003, TAB-001,
TAB-002, and ACC-001.

Exit conditions:

- Floating windows dock into split shells.
- Windows merge into tabs.
- Tabs can leave their group.
- Shells move as units.
- Scenario tests cover the behavior.

All exit conditions are met. P1 had no hard dependency. Early planning noted that frame memoization
reduced the extra shell cost.

## P2: performance at 100 or more windows

Status: partial.

The P2 plan corrected its culling and raster scope on 2026-07-08.

Body memoization changed 20-window pan from 15.6 fps to 96.9 fps. The cost model lives in
[research/performance-profile.md](research/performance-profile.md).

`NFR-1` requires ten windows without visible loss. Commit `962e42c` met that limit on 2026-06-10. P2 requires
100 windows at 60 fps. An 80-window pan measured 21.3 fps. The two limits are separate.

### Tranche 1

Frame-chrome memoization is implemented and unmeasured. The frame no longer receives `state`. Chrome, body
content, and resize handles use window identity for memoization. A CSS variable carries handle geometry.
Camera zoom no longer rebuilds that geometry.

### Tranche 2

The early note said "subsystem exists, layer ignores it". The plan incorrectly treated `visibility.tsx` as a culling source. That module receives data only from
the R3F frustum probe. The probe exists behind the optional `/scene` entry. It operates only under
`diagnostics.frustum`.

`useInfiniteCanvasWindowFramed` returns its `true` fallback without the probe. A consumer without `three`
thus receives no culling data from this hook. Using it for window rendering also restores a dependency on
the optional `/scene` package.

The correct predicate is `isWorldRectWithinViewport(camera, viewport, rect,
marginPx)` in `geometry.ts`.
The current implementation uses that pure camera calculation.
It calls `isUsableViewport` before culling.
A `0 × 0` viewport must render all frames.

Culling cannot remove entries from `visibleWindows`. Removal unmounts the subtree. Focus moves to `<body>`. A
`portalRoot` detaches. Scroll, media, and uncontrolled input state are lost.

Skipping an offscreen transform is safe. The stale transform is not visible. The frame renders the current
transform when it returns.

### HTML-in-Canvas tier

The planned texture mode captures windows during camera motion. WebGPU quads replace live DOM during pan and
zoom. Live DOM returns after motion stops.

See [research/html-in-canvas.md](research/html-in-canvas.md). This work requires Chrome 148 or later with the
Origin Trial flag.

### Benchmark gate

The benchmark uses synthetic wheel, drag, and pan input through Vite+. Performance regressions
must fail the gate. This work also supplies C4 in the ship plan.

No tranche-1 number is valid until this benchmark finishes on real hardware.

### Raster defaults

A finite `maxPendingCaptures` previously left refused windows without a raster. The body recorded a capture
that never occurred. The correction does not record a refused request. A waiting body tries again after the
queue drains.

The defaults remain unbounded. Both `maxPendingCaptures` and `viewportMarginPx` use `Infinity`. A measured
profile must select finite defaults.

Exit conditions:

- Pan, zoom, and drag hold 60 fps with 100 windows on real hardware.
- A benchmark guards the recorded values.
- Measured evidence selects or rejects texture mode.

P2 remains open because these measurements do not exist.

## P3: styled distribution

Status: open.

The program adds a Tailwind Variants layer over the `data-slot` contract. The Phase 3 attribute list is the
slots map. Themes become complete distributions instead of token-only changes.

The program also adds an original dynamic-grid scene layer under the goal "build something better". The target includes a 40-pixel lattice, local
pointer luminance, and node influence fields. The motion study supplies visual reference. The implementation
must be original.

The selection work deferred shader sheen and additional input polish. This program includes that work.

The token system requires a complete light theme. That theme proves that all visual values use tokens. The
distribution must include the current dark theme and one different complete theme. It also requires theme
documentation.

Exit conditions:

- Consumers can replace an `@infinite-canvas` theme package or subpath.
- A playground control demonstrates both complete themes.

P3 has no hard dependency. It builds on the headless contract.

## P4: undo, redo, transactions, and recipes

Status: undo, redo, and recipes implemented on 2026-07-08. Per-window history remains open.

`history.ts` stores past and future arrays of `{ groups, windows }`. This is the editable document portion of
the canvas. Camera pan is not a document edit. Undo thus does not move the view.

`Mod+Z` and `Mod+Shift+Z` use `canUndoInfiniteCanvas` and `canRedoInfiniteCanvas`. They use the same command
vocabulary as other mutations. History lives in `InfiniteCanvasState` so command state can include it.

A transaction starts when a mutating drag starts. `interaction.step` does not record history. A drag with many
frames creates one entry. A canceled drag can return to the initial document.

History keeps 100 entries. It removes the oldest entry after that limit. Hydration and reset clear history.
History is session-scoped and is not serialized.

The document called serialized history "put it in the envelope". The selected policy is to keep it out. The
edit log is not part of a saved layout.

`recipes.ts` stores named arrangements. A recipe can use the selection, a named set, or the complete canvas.
The stored origin is `(0, 0)`. The stored `size` permits placement in another world region.

A group enters a recipe only when every member enters. A partial group cannot preserve a valid tree.
Application changes only windows that still exist. `reconcileInfiniteCanvasGroups` removes invalid group
references.

Consumers own and store recipe values. `parseInfiniteCanvasRecipe` treats stored values as untrusted input.
One recipe application creates one undo entry.

Recipes translate without scaling. Scaling can put a window below its `minSize`. Placement into a `rect`
centers the recipe at its natural size.

Open work includes the last floating rectangle and last dock path for each window. The plan also records an
open question about recipes and history in a future envelope.

The planned persistence work covered PERSIST-001 through PERSIST-003. Later scenario work covered the
applicable current behavior.

Exit conditions:

- Undo and redo cover all mutations.
- The `/groups` route can save and apply recipes.
- A remove, move, dock, and three-step undo sequence remains coherent.

The implemented behavior covers each window and group mutation. Each drag is one transaction. The showcase
contains recipe save and apply behavior. Later scenario work supplies transaction evidence.

Recipes depended on the P1 group model. Window-only history did not require that model.

## P5: keyboard, focus, and accessibility

Status: partial.

FOCUS-002, FOCUS-003, roving focus, and keyboard resize landed on 2026-07-08.

Directional focus uses `Alt+Arrow`. It searches the current group first. A global geometry search is the
fallback. Close and minimize restore focus. FOCUS-001 is done.

FOCUS-002 defines a contextual parent. A floating-window center inside a group selects that group. The
smallest containing group wins. An identifier breaks a tie. This rule closed risk R9.

FOCUS-003 defines named placement. `Mod+Shift+Arrow` selects halves. `Mod+Shift+Enter` fills the viewport.
Quarter and center commands have no default chord.

The command surface calls `preventDefault()` for owned chords. Common unused chords belong to browser
developer tools or tab navigation. `window-placement.ts` is the only module that defines a "left half" and other named rectangles.
Named placement does not snap after calculation.

Group tabs and accordions use roving focus. Accordion arrows use `container.axis`. ACC-001 covers this rule.

Keyboard resize uses `Alt+Shift+Arrow`. It changes the east and south edges. The window origin stays fixed.
The step is ten screen pixels at each zoom.

The command calls `resizeRectFromHandle`. It does not duplicate resize rules. `interaction.startResize` and
keyboard resize both reject a grouped window. A nudge on a grouped window moves its shell.

The chord families are:

- A bare arrow moves a window.
- `Shift` increases the move distance.
- `Alt` changes focus.
- `Alt+Shift` changes window size.
- `Mod+Shift` places a window.

Focus trapping is implemented in `focus-trap.ts`. An older status said "still open". The frame calls `trapInfiniteCanvasTabKey`. Content entry
calls `focusInfiniteCanvasContent`.

Tabs use `role="tab"`. The active panel reference uses `aria-controls`. The `aria-controls` value points to
the mounted panel. `getInfiniteCanvasWindowFrameElementId` supplies the frame `id`.

FOCUS-004 permits selection without a pointer. Earlier commands only supported "clear" and "select all visible".
`selection.extendDirection` adds the directional target.
Arrange commands require two or more selected windows.

`window.focusDirection` normally calls `focusWindow`. That mutation replaces the selection. The extension
command adds the target before focus. `focusWindowPreservingSelection` then uses the selection anchor.

Camera commands include `view.pan` and `view.zoomBy`. Earlier commands only fit all, fit selection, or reset
zoom.

Selection extension and the camera commands landed on 2026-08-12.

Open work includes IME behavior, text selection, and a screen-reader review.

The practical session must cover open, focus, move, resize, arrange, and close. Each listed action is
available through a chord or palette except `open`. The consumer defines window kinds and their initial
content.

`accessibility-structure.test.tsx` is the structural checklist. It renders a real tab group.
`accessibility.test.tsx` did not create that group.

The structural test proves these facts:

- Each ARIA identifier resolves.
- No element has a positive `tabindex`.
- Each tab belongs to a tab list.

The first use found references from inactive tabs to absent panels. Only the active tab panel is mounted. A
missing target makes `aria-controls` invalid. An absent `aria-controls` value is correct for an unmounted
panel.

The implementation adds the reference only when the panel exists.

Some command families still have empty `hotkeys` arrays. These include arrange, dock, group shape, lifecycle,
camera, and selection extension. All arrow combinations already have owners. The browser also owns common zoom
chords.

Palette access makes these commands reachable. A practical keyboard-only session still needs better default
chord coverage.

P1 supplied group-local focus. The remaining work is window-level.

## P6: body content platform

Status: partial. See [research/body-content-contract.md](research/body-content-contract.md).

Portals, input ownership, chrome strokes, and typed window data landed on 2026-07-08. Proxy chrome was partial
on 2026-08-12.

`portal.tsx` creates two roots outside the zoom transform. One root belongs to the desktop. A window-local
root follows a window screen rectangle.

`<InfiniteCanvasPortal scope="window">` mounts into the local root. A popover then stays at natural size and
remains next to its anchor. The root is optional for each window kind through `portalRoot: true`.

A root for every window adds a style write after each camera change. The opt-in rule protects frame
memoization. The `/portals` route compares transformed and untransformed popovers.

Input ownership work is implemented. Wheel `deltaMode` normalization changed line mode from 16 pixels to 40
pixels. Firefox and Chrome then produce closer movement for one notch.

Modifier zoom over a window body controls the canvas. Plain wheel input can still scroll the body. Trackpad
pinch uses the Ctrl-wheel path. Safari evidence remains open. See [zoom-policy.md](zoom-policy.md).

Proxy chrome at far zoom is partly implemented. At `summary` detail, a frame removes resize handles. Each
handle uses a constant screen size. At far zoom, eight constant-size handles can cover the window.

This chrome rule is not optional for a window kind. The framework owns chrome. The consumer owns body content
and its summary.

Group shells also remove their eight handles at `summary`. Each handle extent uses `resizeHandleSize / scale`.
The same far-zoom problem applies to shells and gutters.

Tab strips and accordion headers remain visible at every zoom. Their world-unit sizes shrink with the group.
They also provide roving `tabIndex` and the only tab or fold controls.

The default title and four control buttons leave the frame at summary detail. `detailLevel` lives on
`InfiniteCanvasWindowFrameRuntimeContextValue`. That type is internal, so the change did not change a public
contract. The old "public-surface change" claim was false.

Consumer `children` in the title stay visible. Only the framework default title changes. The title and control
containers remain mounted. Consumer `render` functions and styles still have an element.

Removing buttons also removes them from the accessibility tree at far zoom. Keyboard commands and the palette
still provide each window action. The body `renderSummary` lane already changes DOM content by zoom. A browser
and screen reader must examine this trade.

Low-zoom chrome strokes are implemented. A world-unit border that uses `1 × zoom` becomes smaller than one
screen pixel below full zoom. The variable `--icx-chrome-stroke` increases world width as zoom decreases. It
never renders thinner than one screen pixel.

The design record said "a stroke that survives is not the same as chrome that is legible".

It does not change above 100 percent zoom.

The registry types each kind payload through `defineInfiniteCanvasWindowRegistry<Kind, DataByKind>`. Inside
`renderBody({ window })`, `window.data` uses the related kind type. The typed `window.data` value exists only
at the registry boundary. The registry then removes that type information at runtime. The rejected request was
"the real fix beyond the helper".

The project rejected full generic propagation. `renderBody` accepts a context. Thus,
`InfiniteCanvasWindowDefinition<K, Data>` is contravariant in `Data`.

Passing `DataByKind` through `Desktop`, viewport, layers, frame, and slots adds no runtime safety. Hydration
makes `window.data` an `unknown` value. It crosses `JSON.parse`. Modified `localStorage` can contain another
value.

`getInfiniteCanvasWindowData(window, guard)` validates this boundary.

The body-content exit requires "zero consumer workarounds" for forms, popovers, scrolling lists, and selectable
text. The `/body-content` route covers forms, selectable text, and a scrolling list. The list uses
`wheelBehavior: "native-scroll"`. The `/portals` route covers a popover outside the zoom transform.

Direct use must prove the absence of consumer workarounds.

## P7: rasterization and semantic detail

This program has two independent parts.

### P7a: capture modernization

Status: blocked on Chrome 148 or later with the Origin Trial flag.

The current `rasterization.tsx` adapter type contains only `"snapdom"`. Its capture path calls
`import("@zumer/snapdom")`. The string "html-in-canvas" appears once under `src/`. That source comment describes
future work.

Risk R12 records a decision that is not implemented. The remaining adapter must use `captureElementImage`
first. Snapdom remains the detected fallback.

Captures become ImageBitmaps or GPU textures. This combines old slices 4 and 5.

The `onpaint` event must replace idle-callback recapture estimates.

The `renderIcon` lane is not implemented. `grep renderIcon src/` returns no result. `renderSummary` is
implemented. The project still needs a decision about an icon lane below the summary band.

RENDER-003 needs the culling implementation. RENDER-001 covers the far-card lane. RENDER-002 covers pause
during input. `acceptance-scenarios.md` records those states.

### P7b: semantic detail

Status: done on 2026-08-12 in commit `1545636`.

Raster snapshots reduce cost but do not make small text readable. A paragraph at 15 percent zoom remains
unreadable after capture.

`detail-level.ts` and `renderSummary` provide semantic detail. The threshold uses effective screen size
instead of zoom alone. A hysteresis band prevents changes near one continuous threshold.

Exit conditions:

- At 12 to 25 percent zoom, each window remains identifiable.
- Capture changes automatically with browser capability.

The capture condition remains open. P2 texture mode and P7a share capture code. The first program to start
this work owns the shared path.

## P8: quality and release engineering

Status: partial.

The remaining browser work includes Vitest interaction tests with real pointer input. These tests must replace
one-time manual sessions. The computed-style fingerprint can become a visual-regression tool. The kek
visual-parity tool is another option.

P2 must supply performance benchmarks for CI.

The package rename to `@infinite-canvas/*` is done. README and API documentation exist. The repository
contains LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, and SECURITY files.

Open release work originally included a changeset or version flow. The project later adopted Bumpy. The
documentation application slot at `apps/website` still does not exist.

The package includes its license. The package manifest uses `files` with `["dist"]`. npm searches beside
`package.json` for the license.

`npm pack --dry-run` includes `LICENSE README.md package.json`. It also includes seven distribution files.
The package previously omitted the license text. `verify-artifact.mjs` guards this requirement.

Exit conditions:

- `npm install @hyphened/infinite-canvas` works in an external consumer.
- The quick start describes that installation.
- CI starts tests, benchmarks, and visual evidence.

P8 has no hard dependency. A complete P3 theme gives external users a better demonstration.

## Recorded sequence

The 2026-06-10 plan used this order:

1. P2 tranche 1.
2. P1 grouping.
3. P4 transactions and recipes.
4. P5 accessibility.

P3 was the parallel visual program. P6 entered the order when body-content problems appeared. P7 required a
compatible Chrome build and Origin Trial flag. P8 became urgent before external publication.

Each program adds its acceptance scenarios to the test suite. The acceptance document is the shared list.
