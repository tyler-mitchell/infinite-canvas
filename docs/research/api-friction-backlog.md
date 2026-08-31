# API friction backlog

> Source: The 2026-06-10 showcase rebuild created four showcases from the
> public API. The work found defects and API friction.

Items marked **fixed** changed during the exercise. The remaining items are in
approximate priority order. Some items became unnecessary during the headless
extraction, and their status says so.

## Fixed during the exercise

- **Scene-layer boot paint race.** Demand-frameloop content did not paint after
  a cold load.
  The WebGPU renderer starts asynchronously, but the first invalidation used
  only a wall-clock schedule. The schedule starts again when the renderer
  instance becomes available.

- **Missing barrel exports.** Consumer overlays require
  `worldRectToScreenRect`, `worldPointToScreenPoint`, `rectsIntersect`, and
  related geometry helpers.
  The reference used a deep import from the geometry module. These helpers are
  public.

- **Canonical drop placement.** Consumers had separate preview and commit
  placement logic. This logic produced different "smart" placement results.
  `getInfiniteCanvasDropPlacement()` supplies pointer-anchored placement
  with snapping for both paths.

- **Pointer capture.** `capturePointer` threw for inactive or synthetic
  pointers. The handler stopped before the interaction started.
  Pointer capture is a best-effort operation.

- **Portable declaration output.** The input-policy cursor getters have
  explicit annotations.

## Fixed during the headless extraction (2026-06-10)

- **Frame-slot style conflicts.** This item dissolved during the extraction.
  Framework components emit no visual classes.
  Consumer `className` and `style` values control the output. A live
  verification in the custom-frames showcase shows these overrides.

- **HUD opt-out.** The HUD extraction added
  `hud?: boolean | { statusCard?, minimizedDock?,
pointerModeControls?, cameraControls?, zoomControls? }`.

- **Drop-drag listener gap.** The listeners remain mounted and use ref guards.
  `startDrag` writes the interaction ref synchronously.
  A synchronous pointer down, move, and up sequence commits a drop.

- **Move, resize, pan, and marquee listener gap (2026-07-08).** The drop fix
  did not cover the window and canvas interactions.
  Their listeners used `useEffect` with `state.interaction`. React attached them
  after the pointer-down commit.
  A pointer move in the same frame disappeared, and the window did not move.

  The one-frame delay was not visible to a person.
  Automation and browser tests use `down -> move -> up` in one synchronous
  block, so this delay stopped those inputs.
  The listeners remain mounted and read `store.state$.peek()` during each
  event. `commitInfiniteCanvasState` batches synchronously, so the read has the
  current state.
  The cost is one `peek()` for each idle pointer move. The drop path already
  has this cost.

- **Programmatic handle.** `createInfiniteCanvasHandle(store)` is an
  experimental export.
  It contains the command facade, a JSON-safe snapshot, and contextual command
  descriptors. Unit tests cover this programmatic consumer contract.

- **Window data guard.** The package exports
  `getInfiniteCanvasWindowData(window, guard)`.
  Generic threading through registry and render contexts remains open in the
  next section.

- **Edge-target radius documentation.** The edge-target type documents
  `hitRadius`.
  On 2026-06-10, the text specified world units. The API changed to screen
  pixels on 2026-08-12.

## Open: high priority

- ✅ **Zoom during a drag.** Status: fixed on 2026-07-08. C2 added coverage.
  The fix has no browser observation.
  Each drag stored `zoom` at `startMove`. Each step calculated
  `screenDelta / interaction.zoom`.

  The wheel handler permits a zoom during an interaction. Thus, a zoom converted
  the complete accumulated screen delta with the old scale.
  Start at zoom 1 and drag 100px right. The world displacement is 100.
  Change to zoom 2 and drag another 100px. The accumulated `screenDelta` is 200.

  Division by the original zoom gives 200 world units. The correct displacement
  is 100 plus 50, which is **150**.
  The remaining drag length did not limit the error. The defect affected `move`,
  `resize`, `groupMove`, `groupResize`, and `groupGutter`.
  `getInteractionWorldDelta` projects the origin pointer with the origin camera.

  It projects the current pointer with the current camera.
  `screenPointToWorldPoint` uses `center + (p - viewport/2) / zoom`.
  With an unchanged camera, the difference is `(p - origin) / zoom`. Thus, the
  former static-camera behavior stays bit-identical.
  The five interaction types no longer store `zoom`. They store `originCamera`,
  which `pan` already stored.

  The first fix had no FAIL-001 regression test because tests were outside that
  work session. C2 added the assertion.
  The sentence "the scenario remains unasserted" became stale and changed on
  2026-08-12.

- ✅ **Zoom during a pan.** Status: fixed on 2026-07-09 and covered on
  2026-08-12. The fix has no browser observation.
  "`pan` always carried `originCamera`" was true only for the pan delta. Pan
  projected its center from the origin camera and did not move a window.

  The pan step still wrote `camera: { ...interaction.originCamera, center }`.
  This value included the zoom from the start of the pan.
  A wheel zoom during the pan disappeared after the next pointer move. The same
  wheel handler permits that concurrent input.
  The step anchors the world point from the start of the pan. It projects
  that point with the current zoom.

  The expression is `worldAtOrigin - (point - viewport/2) / camera.zoom`.
  With an unchanged zoom, the `viewport/2` terms cancel. The expression reduces to
  `originCamera.center - screenDelta / originCamera.zoom`.
  Thus, pan behavior without a concurrent zoom stays bit-identical.
  The defect is reachable with a held pan and `Ctrl` or `Cmd` plus a wheel
  event. It is also reachable with a trackpad pinch.

  A full review of `stepCanvasInteraction` found the defect.
  Three tests cover the correction. The new zoom survives the next pan step.
  The former result was `1`.

  The original world point stays under the cursor after the zoom. A pan without
  a zoom change moves the camera by `screenDelta / zoom`.

  The second assertion finds a step that keeps the new zoom but projects with
  the old zoom.

- **Interactive performance.** Status: corrected on 2026-07-08. The former
  NFR-1 failure claim is stale.

  The former entry said `/stress` degrades "at even ~20 live windows during
  pan/zoom/move".
  Commit `962e42c` restored body-content memoization on 2026-06-10.
  At 20 windows, pan performance changed from 15.6 fps to 96.9 fps. Drag
  performance changed from 4.4 fps to 58.3 fps.

  NFR-1 requires ten windows, so the current result meets that requirement.
  P2 targets 100 windows at 60 fps. At 80 windows, pan performance is 21.3 fps.
  The measured drag cost came from body content. Snap-candidate rebuilds were
  not the bottleneck at this window count.

  Frame-chrome reconciliation is the main remaining cost. P2 tranche 1 changed
  this area, but no measurement covers that change.
  New performance changes require the measurements in
  [performance-profile.md](performance-profile.md). Risk R15 tracks the work.
  Texture mode from [html-in-canvas.md](html-in-canvas.md) remains the leading
  candidate.

- ✅ **`window.data` generic threading.** Status: fixed on 2026-07-08.
  `defineInfiniteCanvasWindowRegistry<Kind, DataByKind>` types the payload for
  each kind while the consumer writes the registry. It then erases the type.
  `renderBody({ window })` returns `window.data` with the type for that kind.

  Consumer-owned data no longer requires `getInfiniteCanvasWindowData`.
  The framework erases the type for two reasons.
  First, `renderBody` takes a context. Thus,
  `InfiniteCanvasWindowDefinition<K, Data>` is contravariant in `Data`.
  A registry for one kind cannot assign to the erased registry.

  Second, further threading of `DataByKind` adds a type parameter to
  `InfiniteCanvasDesktop`, the viewport, the window layer, the frame, and each
  slot.
  At runtime, `window.data` is `unknown`. Hydration reads it through `JSON.parse`,
  and a user can edit the `localStorage` value.
  Persisted data requires validation with
  `getInfiniteCanvasWindowData(window, guard)`.
  A `renderBody` implementation that trusts `window.data` from `localStorage`
  trusts user-editable text. The public type must not make a stronger claim.

## Fixed 2026-07-08

- **Popover position.** A frame uses `transform: scale(zoom)`. This transform
  makes the frame the containing block for `position: fixed` descendants.
  Thus, floating UI uses the frame coordinate space and receives the frame
  scale.
  `src/portal.tsx` provides `<InfiniteCanvasPortal>`. The desktop root is at
  viewport level.

  The optional window root follows the screen rectangle of its window.
  `/portals` demonstrates both roots.

## Fixed 2026-07-08 (continued)

- **Typed payload contexts.** `InfiniteCanvasOverlayRenderContext<K, Payload>`
  was invariant in `Payload` because `startDrag` accepts one.
  The intersection contained a contravariant member, so assignment failed in
  both directions. Each generic consumer utility carried both type parameters.
  The API separates `InfiniteCanvasOverlayReadContext<K, Payload>`. This
  context is covariant because `Payload` occurs only in output positions.

  The render context intersects it with the `startDrag` function. A read-only
  utility accepts only the read context.

- **Scoped storage key.** `getInfiniteCanvasScopedStorageKey` formerly returned
  `string | undefined` after a caller supplied `storageKey`.
  Both inputs are optional, so callers added `?? storageKey`.
  An overload returns a key for a supplied key. `/persistence` removed its
  workaround.

- **Handle change subscription.** `createInfiniteCanvasHandle` provides
  `subscribe(selector, listener)`. The call returns a disposer.
  A bare `onChange` action starts on each camera tick. The caller then
  compares the state.

  Reducers return the same array when no window changes. Thus,
  `subscribe((state) => state.windows, …)` reports only window changes.
  It does not report pan updates.
  The listener uses a microtask outside the Legend tracking context. An inline
  listener can add its reads to the dependency set of its observer.

  Those new dependencies can start the listener again.
  Spatial queries remain open and belong to the render layer.

## Fixed 2026-07-08 (nudge detached a grouped window)

- **Grouped-window nudge.** `window.nudge` wrote the `rect` of a group member.
  The group tree projects each member rectangle. Only `interaction.step` uses
  `syncInfiniteCanvasGroupWindowRects`.
  `command.execute` does not use that synchronization. Thus, an arrow action
  moved a selected pane out of its shell.

  A later unrelated group change solved the tree again and moved the pane back.
  A nudge translates the shell, as the DOCK-003 header drag does. Each group
  moves once when the selection contains several members.
  `close`, `maximize`, and `minimize` call
  `detachInfiniteCanvasWindowFromGroups` before they change a rectangle.
  `nudge` formerly did neither permitted action. A command that writes
  `window.rect` must detach the member or change the shell.

  Only the group layer can write a member rectangle.

## Fixed 2026-07-08 (window portals painted behind their window)

- **Window portal stack order.** The owner reported that `scope="window"` did
  not work.
  A screenshot of `/portals` showed only the intentionally incorrect in-body
  popover. The portalled popover was not visible.
  The portal root came before the `<article>` and had no `z-index`. The frame
  uses `getWindowStackValue(window, stackBands)`.

  Both elements have position. Their paint order uses `z-index` first and
  document order second.
  The frame won both comparisons. The portal content mounted at the correct
  screen rectangle but painted under the opaque body.
  The portal root follows the frame and uses the frame stack value. With an
  equal `z-index`, its later document position puts it above its own window.

  A window with a larger stack value still paints above the popover. The popover
  belongs to its window, not to the world.
  Nobody examined the route after the team built it, so `/portals` did not expose the
  fault during the first change.
  The portal commit says that it "renders nothing until its root exists rather than falling back into the transformed subtree,
  because a popover that quietly appears in the wrong place is a bug the consumer will chase into their own code."
  The first implementation still painted the popover in the wrong place.

## Fixed 2026-07-08 (grouped-window handles)

- **Grouped-window resize handles.** The gutter worked only at high zoom, and
  the outer group edges did not resize.
  `interaction.startResize` refuses a grouped window because its seam changes
  the pane size. The frame still drew resize handles for each pane.
  These handles cross the frame edge through
  `RESIZE_HANDLE_OVERHANG = calc(extent / -2)`.

  The window plane is above the group layer. Handles from two adjacent panes
  covered the gutter and consumed its `pointerdown`.
  The handle extent stays constant in screen pixels through
  `chrome.resizeHandleSize / scale`. The gutter width stays constant in world
  units.
  At high zoom, the screen gutter remains exposed. At low zoom, the two handle
  areas cover it.

  A grouped window no longer draws resize handles. The window layer derives
  `isGrouped` from the `windowRects` keys in the group projection.
  These keys identify the windows that a tree places.
  A group shell has edge handles. This status was stale until 2026-08-12.

  A `groupResize` interaction exists beside `groupMove` and `groupGutter`. It
  changes `group.rect`, and the solver projects each member rectangle again.
  `getInfiniteCanvasGroupMinimumSize` follows each solver branch.
  A split sums child sizes along its axis and adds one gutter between adjacent
  children.
  Tabs add a strip above the tallest child. An accordion adds `n` headers and
  uses the widest child across all members.

  The minimum does not use member `minSize`. The group tree owns member
  geometry, so a floating-window property cannot control the group minimum.

## Fixed 2026-07-08 (dock intent)

- **Dock-intent dispatch.** `Alt`+drag did not dock because three handlers
  processed one pointer move. The report came from `/groups`.
  The window header dispatched `interaction.step` with
  `dockIntent: event.altKey`.
  The canvas root is an ancestor of each frame. The event reached the root,
  which dispatched the same step without `dockIntent`.

  `action.dockIntent === true` then returned `false` and cleared the
  `dockPreview` from the header.
  The mounted `window` listener dispatched a third step with the modifier.
  Thus, handler order controlled dock intent. `dockPreview` changed from a
  value to null and back within one frame.
  The dock overlay reads that value.

  The root `onPointerMove` became obsolete after the "Move/resize/pan/marquee
  listener gap" fix.
  The mounted `window` listener already owned captured pointer movement. The
  first correction removed the React handler.
  Pan and marquee call `capturePointer` on the root. Their events still get to
  the root and then the `window` listener.

  One owner must dispatch an interaction step that contains a modifier. Two
  dispatchers can have different facts about the same event.
  The last dispatcher then controls the result.
  The first correction remained incomplete until 2026-08-12. Four local
  handlers still dispatched `interaction.step`.

  They were the window header, window resize handle, group resize handle, and
  group gutter.
  Each pointer move during a drag still caused two dispatches. Three local
  handlers omitted `dockIntent`.
  The comment called the mounted listener "the single source for interaction
  steps", but four source calls contradicted it.
  The correction removed all four calls.

  `single-dispatcher.test.ts` reads the source and permits
  `stepInteraction` only in `infinite-canvas.tsx`.
  One product question remains. `resolveInfiniteCanvasDockPreview` examines the
  pointer inside the target rectangle.
  It does not compare the dragged rectangle with the target rectangle. The
  documentation says "drag a floating window _over another_", which can imply
  rectangle overlap.

  The pointer rule matches VS Code and Dockview. The wording remains stronger
  than the behavior.

- ✅ **Ambient Node type leak.** Status: fixed on 2026-08-12. The package had
  leaked a `@types/node` requirement to consumers and broke the playground
  build.
  `packages/infinite-canvas/tsconfig.json` contains `"types": ["node"]`. Tests
  require this entry because they read package source from disk.

  These tests enforce invariants that a type cannot express.
  The playground source-links the package and typechecks it with the playground
  tsconfig.
  One `process.env.NODE_ENV` reference in `infinite-canvas.tsx` passed the package
  build but caused `TS2591: Cannot find name 'process'` in the playground.
  The package `vp check` cannot find this leak because the package has Node
  types. The error appears on the consumer side.

  The playground build found the error after a showcase change. A stash and
  rebuild showed that the error existed before that change.
  The module declares `process` locally. This declaration shadows a typed
  global and supplies the type when the global type is absent.
  It also keeps the literal `process.env.NODE_ENV` token that bundlers replace.

  The team rejected `import.meta.env.DEV` because it adds a Vite requirement to
  the library.
  The team tried `"types": []` and restored the Node types. Tests import
  `node:fs`, `node:path`, and `node:url`.
  The tsconfig records the reason for the entry. It also states that shipped
  source must not depend on it.

  Enforcement remains open. The four surface gates cover exports, documents,
  the pure-core import graph, and semver tiers.
  No gate finds an ambient global in shipped source.
  A fifth gate can forbid Node built-in imports and bare `process` references
  outside `*.test.*` files.

## Open: medium priority

- ✅ **Pure-core import boundary.** Status: fixed on 2026-07-08.
  Legend State belongs only in `store`, `rasterization`, `visibility`, and
  `canvas-handle`.
  These modules are at a React or programmatic boundary. Derivation modules do
  not import Legend State.

  The source structure had this property, but no gate prevented an observable
  import in `reducer.ts`.
  `README.md` and `CONTRIBUTING.md` both claimed that a test enforced it. Only
  the headless boundary had a test.
  `scripts/verify-pure-core.mjs` starts from 29 pure-core roots and reaches 33
  modules.
  It reports an error when a root reaches `react`, `react-dom`,
  `@legendapp/state`, `three`, `@react-three/fiber`, or `@zumer/snapdom`.

  The error includes the complete import path to the forbidden package.
  CI operates the script before the build. `prepublishOnly` also operates it.
  The script ignores type-only imports.
  `import { type InfiniteCanvasStore } from "./store"` disappears before runtime
  and does not add `store.ts` to the core.

  The script also has a coverage floor. This prevents a parser error from
  producing a successful one-module crawl.
  `optional-peers.test.ts` had this exact defect. Its regular expression missed
  `export … from`, and the crawl reached one module.
  Negative tests cover both cases and a stale root entry.

- ✅ **API document drift.** Status: fixed on 2026-07-08.
  `SHIP_PLAN.md` called `docs/API.md` "generated from the barrel", but
  maintainers update the document by hand.
  It omitted 43 public names. Undo, redo, layout recipes, and portals had no
  section.

  `CHANGELOG.md` described each capability. `README.md` linked to the document
  for "the full export surface".
  A manual edit restored the names.
  `scripts/verify-api-doc.mjs` extracts each name from `index.ts` and
  `scene.ts`.
  It reports an error when the document omits a public name.

  CI operates the script before the build. The script reads source and requires
  no build output. `prepublishOnly` also operates it.
  Negative tests remove a documented name and add `export const` or
  `export * from`.
  The parser accepts only supported re-export blocks. An unknown barrel form
  causes an error, so the gate cannot pass with an incomplete parse.

  The gate proves name presence. It does not prove explanation quality.
  The gate does not enforce the reverse direction because the document also
  names options and related types.

- ✅ **Slot layout rigidity.** Status: dissolved on 2026-08-12 through the
  existing headless slot contract.
  Centering a title formerly required "absolute-position hacks around
  `Controls`".
  The header is a flex row with `justify-content: space-between`. Thus, `Title`
  used the space that `Controls` left.

  Moving the title to the center required removal from the normal flow.
  The backlog proposed "slot order/areas in the styled-distribution work" as a
  new mechanism.
  The headless slot work already supplied the required control. Slot `children`
  replace the default arrangement.
  Consumer `style` declarations override matching framework declarations.

  A three-column grid can put the title in the middle column. This layout
  centers the title against the complete header. The space `Controls` leaves
  does not affect it.
  `slot-render.test.tsx` creates this header through the public API. The test shows
  that the layout uses no absolute positioning.
  The test also preserves `data-infinite-canvas-control` as the drag surface.

  No second slot-layout mechanism is necessary.

## Open: small items and documentation

- ✅ **Reset-zoom shortcut.** Status: fixed on 2026-07-08. `Mod+0` also reset
  browser zoom, so the canvas binding is `Shift+0`.
  The former entry called the collision "unverified, and worth ten seconds in a
  browser". The repository already recorded the browser rule.

  Browsers reserve `Mod` with `0`, `+`, and `-` above the page.
  The browser receives the keydown. `preventDefault()` returns without an error,
  but the browser zoom still resets.
  Similarly, `Mod+Alt+Arrow` switches tabs, and `Mod+Alt+C` opens DevTools.
  `Shift+0` joins the existing view bindings. `Shift+1` fits all content, and
  `Shift+2` fits the selection.

  The `@tanstack/hotkeys` matcher first compares a one-character hotkey with
  `event.key`.
  On a US layout, `Shift+0` produces `)`. The matcher then compares
  `event.code === "Digit0"`.
  `Shift+1` and `Shift+2` already use this path.
  A browser audit of `DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS` remains open.

  The candidate chords are `Escape`, `Mod+A`, `Mod+Z`, `Mod+Shift+Z`, `Mod+Y`,
  `Shift+<digit>`, the arrow families, and `Mod+Shift+Enter`.
  These bindings are "believed" to be cancelable at the page level.
  The first audit target is `Mod+Y`. It is the Windows redo convention, and at least one
  desktop browser uses `Ctrl+Y` for a browser action.
  The browser and the cancelable state of that binding remain unknown.

- ✅ **`hitRadius` units.** Status: changed to screen pixels on 2026-08-12.
  The former entry asked whether screen-pixel semantics "would serve consumers better".
  `hitRadius` was the only framework threshold in world units.
  The snap `threshold`, `releaseThreshold`, and detail-level band already use
  screen pixels through the camera.

  The offscreen inset, margin, 6px tab-drag threshold, and keyboard nudge step
  also use screen pixels.
  At 25% zoom, the former default radius of 10 world units became 2.5 screen
  pixels. At 400% zoom, it became 40px.
  This behavior was risk **R2**, "thresholds vary with zoom". The risk register
  marked the snapping case as mitigated.

  The same type of defect made the low-zoom chrome stroke one tenth of a pixel.
  The default remains 10. Thus, behavior at zoom 1 is unchanged.
  Existing tests did not find the change because they used zoom 1. New tests
  use 0.25 and 4, where the two unit models differ.

- ✅ **Drop snap guides.** Status: fixed on 2026-07-08.
  The overlay formerly drew only `state.snapPreview`. Each consumer then drew
  drop guides from the same `data-slot` contract.
  Their output differed. `getInfiniteCanvasDropPlacement` already calculated
  the guides and then discarded them.

  `dropPolicy.placement` describes the payload size.
  The viewport snaps the drop against the window-move candidates and exposes the
  result as `drag.placement`.
  `InfiniteCanvasDropSnapOverlay` draws the result with the move-overlay layer.
  When a consumer omits `placement`, drop behavior remains unchanged.
  `onDrop` receives the same placement object as the preview.

  A second call to `getInfiniteCanvasDropPlacement` can return a different
  position. The card can then land away from its preview.
  The `/drop-tray` route removed 18 lines of guide meshes and one duplicate
  placement call.

- **Stress-scale raster defaults.** Status: open.
  `maxPendingCaptures` defaults to `Infinity`. `viewportMarginPx` has the same
  default.
  At 160 windows, the capture queue stays active for a long period.

  The performance investigation must measure a useful bound before these
  defaults change.
  Rasterization uses `enabled: false` by default. These values affect only
  consumers that enable it.

## Fixed 2026-07-08 (raster queue)

- **Finite capture queue.** A finite `maxPendingCaptures` value formerly left
  each refused window without a raster.
  `queueCapture` returned `void` and discarded a request when the queue was full.
  The body had already written
  `lastRequestedSignatureRef.current = signature`.
  `shouldQueueCapture` requires
  `lastRequestedSignatureRef.current !== signature`. Thus, no later call retried
  the discarded request.

  Thus, the stress configuration produced blank windows.
  `queueCapture` returns `boolean`. The body records the signature only after
  the queue accepts the request.
  A `false` result means refusal. A `true` result means acceptance or an
  equivalent satisfied request.

  The satisfied states are queued, capturing, or ready. This distinction
  prevents the skip path from starting a retry loop.
  A refused body keeps `wantsCapture === true`, so its effect dependencies do
  not change after refusal.
  `useInfiniteCanvasRasterCaptureCapacity` observes the transition between a
  full queue and a queue with capacity.
  That transition starts the waiting bodies again.

  The hook subscribes only while a body waits. Otherwise, the selector returns
  before it reads `state$`, so Legend records no dependency.
  A completed capture does not start the other 159 windows. At the default
  `Infinity`, the hook returns a constant `true` and adds no work.

## Corrected observations (no action)

- ~~"Mount the overlay surface eagerly when sceneLayers declare overlay
  placement"~~ already describes current behavior.
  Surfaces mount from declared layer placement. Drag activity does not control
  the mount.
  A live verification observed two idle canvases on /drop-tray.
  The perceived delay on the first drag came from screenshot timing. The DOM
  commit painted before the next invalidated R3F frame.

  This observation requires no code change.
