# API Friction Backlog

> Source: the 2026-06-10 showcase-rebuild exercise — four showcases written
> from scratch against the public API specifically to surface defects and
> ergonomic gaps. Items marked **fixed** landed during the exercise; the rest
> are tracked improvements, roughly ordered by how soon they'll bite.
> Several items dissolve naturally inside the headless extraction; they're
> marked accordingly.

## Fixed during the exercise

- **Scene-layer boot paint race** — demand-frameloop content never painted on
  cold load because the WebGPU renderer initializes asynchronously and the
  boot invalidation schedule was wall-clock only. Fixed: schedule re-arms when
  the renderer instance lands.
- **Missing barrel exports** — consumer overlays need the pure projection/rect
  helpers (`worldRectToScreenRect`, `worldPointToScreenPoint`,
  `rectsIntersect`, …); the reference deep-imported the geometry module. Now
  public.
- **No canonical drop placement** — every consumer hand-rolled divergent
  preview/commit placement, producing cursor-defying "smart" placement.
  `getInfiniteCanvasDropPlacement()` now provides pointer-anchored,
  snap-integrated placement shared by preview and commit.
- **`capturePointer` threw on inactive/synthetic pointers**, killing the
  handler before interaction state started. Now best-effort.
- **Non-portable dts emit** in input-policy cursor getters. Annotated.

## Fixed during the headless extraction (2026-06-10)

- **Frame-slot styling conflicts** — dissolved: framework components emit no
  visual classes; consumer `className`/`style` always wins (verified live —
  the custom-frames showcase's previously-losing overrides now apply).
- **HUD opt-out** — `hud?: boolean | { statusCard?, minimizedDock?,
pointerModeControls?, cameraControls?, zoomControls? }` landed with the HUD
  extraction.
- **Drop-drag listener gap** — listeners are now mount-scoped with ref
  guards; `startDrag` writes the interaction ref synchronously, so same-frame
  pointer events are heard. Verified: a full down/move/up sequence in one
  synchronous block commits a drop.
- **Move/resize/pan/marquee listener gap (2026-07-08)** — the same defect, left
  behind when the drop path was fixed. The window/canvas interaction listeners
  were `useEffect`-gated on `state.interaction`, so they attached only after
  React committed the pointerdown; a pointermove arriving in the same frame was
  dropped and the window never moved. Invisible to humans (one frame), fatal to
  every synthetic driver — `down -> move -> up` in one synchronous block is
  exactly how automation and browser-mode tests drive this canvas, and it
  silently did nothing. Now mount-scoped, reading `store.state$.peek()` at event
  time: `commitInfiniteCanvasState` batches synchronously, so that read is never
  a frame stale. Costs one `peek()` per idle pointermove, which is the trade the
  drop path already accepted.
- **Agent handle promoted** — `createInfiniteCanvasHandle(store)` is an
  experimental export (commands facade + JSON-safe snapshot + contextual
  command descriptors), unit-tested as the programmatic consumer contract.
- **`getInfiniteCanvasWindowData(window, guard)`** helper exported (full
  generic threading through registry/render contexts remains open, below).
- **`hitRadius` documented** as world units on the edge-target type.

## Open — high priority

- **Interactive performance fails NFR-1 in practice.** Both this playground's
  /stress stage and the kek implementation degrade at even ~20 live windows
  during pan/zoom/move. A dedicated performance deep-dive is planned (profile
  before prescribing: candidate suspects include per-window React re-renders
  on camera change, full-window-array signal subscriptions in the frame path,
  and per-pointer-move snap candidate rebuilds — see
  [snapping.md](snapping.md) on spatial indexing). Tracked as risk R15;
  html-in-canvas texture-mode is the leading candidate
  ([html-in-canvas.md](html-in-canvas.md)).
- ✅ **`window.data` generic threading (2026-07-08).**
  `defineInfiniteCanvasWindowRegistry<Kind, DataByKind>` types each kind's payload
  while the registry literal is written, then erases it. `renderBody({ window })`
  hands back `window.data` typed by kind, and `getInfiniteCanvasWindowData` is no
  longer needed for data the consumer put there themselves.

  Erased on purpose, twice over. `renderBody` _takes_ a context, so
  `InfiniteCanvasWindowDefinition<K, Data>` is contravariant in `Data`: a per-kind
  registry is not assignable to the erased one, and threading `DataByKind` onward
  would force `InfiniteCanvasDesktop`, the viewport, the window layer, the frame,
  and every slot to carry a type parameter. And it would buy nothing — `window.data`
  really is `unknown` at runtime. It round-trips through `JSON.parse` on hydration,
  and a tampered `localStorage` entry can put anything there.

  **So the guarantee stops where the framework's knowledge stops.** For persisted
  canvases, validate on read: `getInfiniteCanvasWindowData(window, guard)` exists for
  exactly that, and a `renderBody` that trusts `window.data` out of `localStorage` is
  trusting a string the user can edit. Making the type imply otherwise would have
  been the more comfortable lie.

## Fixed 2026-07-08

- **Popovers inside window bodies land in the wrong place.** A frame is
  `transform: scale(zoom)`, which makes it the containing block for
  `position: fixed`, so every floating-UI library resolves against the frame and
  gets scaled by the zoom. Fixed with framework-owned portal roots
  (`src/portal.tsx`, `<InfiniteCanvasPortal>`): a desktop root at viewport level,
  and an opt-in window-local root tracking the window's screen rect. `/portals`
  demonstrates both.

## Fixed 2026-07-08 (continued)

- **Typed-payload contexts don't downcast.** `InfiniteCanvasOverlayRenderContext<K, Payload>`
  was invariant in `Payload` because `startDrag` takes one — an intersection with a
  contravariant member is assignable in neither direction — so every generic consumer
  utility had to thread both type parameters. Split into
  `InfiniteCanvasOverlayReadContext<K, Payload>` (covariant: `Payload` appears only in
  output positions) intersected with the `startDrag` function. A utility that only
  reads takes the read context and stops caring.
- **`getInfiniteCanvasScopedStorageKey` widened to `string | undefined`** even when a
  `storageKey` was supplied, because both inputs are optional — so callers wrote
  `?? storageKey` to take it back. Now overloaded: give it a key and you get a key.
  `/persistence` drops its workaround.

- **Handle change-subscription.** `createInfiniteCanvasHandle` now exposes
  `subscribe(selector, listener)`, returning a disposer. Selector-based rather than
  a bare `onChange`: a bare one fires on every camera tick and the caller ends up
  diffing anyway. Because the reducers return the _identical_ array when they change
  nothing, `subscribe((state) => state.windows, …)` fires exactly when the windows
  change and never during a pan. The listener runs on a microtask, outside Legend's
  tracking context — called inline, anything it read would be recorded as a
  dependency of its own observer and could re-trigger it. Spatial queries remain
  open: they live in the render layer.

## Fixed 2026-07-08 (grouped-window handles)

- **The gutter seam dragged only when zoomed in, and the outer edges did nothing.** Two
  symptoms, one cause. `interaction.startResize` refuses a grouped window (a pane is resized
  by its seam), but the frame kept drawing its resize handles. Those handles straddle the
  frame edge — `RESIZE_HANDLE_OVERHANG = calc(extent / -2)` — and the window plane draws
  above the group layer, so two adjacent panes blanketed the gutter between them with
  controls that were guaranteed to do nothing, and swallowed its `pointerdown`.

  The intermittency was **zoom**, not focus: handle extent is constant in screen pixels
  (`chrome.resizeHandleSize / scale`), while gutter width is fixed in world units. Zoomed in,
  the seam is wide in screen pixels and its centre stays exposed; zoom out and the two
  handles close over it. Same click, different zoom, different outcome.

  A grouped window now draws no resize handles at all. The window layer passes `isGrouped`
  from the group projection's `windowRects` keys, which is precisely the placed-by-a-tree set.

  **Not fixed, and worth building: a group shell has no edge handles.** The outer border of a
  group cannot be dragged. Removing the dead handles makes that honest rather than broken, but
  the capability is still missing. Sketch: a `groupResize` interaction alongside `groupMove`
  and `groupGutter`, stepping `group.rect`; the solver re-projects members for free, because
  the group owns the layout and a member's `rect` is its projection. The open question is the
  shell's minimum size — it is a function of every pane's `minSize` and the gutters between
  them, not a constant.

## Fixed 2026-07-08 (dock intent)

- **`Alt`+drag never docked, because three handlers stepped one pointermove.** Reported
  against `/groups`. The window header dispatched `interaction.step` with
  `dockIntent: event.altKey`; the canvas root — an **ancestor of every window frame**, so
  a header drag bubbles into it — dispatched the same step with no `dockIntent` at all,
  and `action.dockIntent === true` resolved it to `false`, nulling the `dockPreview` the
  header had just resolved; the mount-scoped `window` listener then dispatched a third
  time, with the modifier. Dock intent was decided by handler ordering for a single
  physical event, and `dockPreview` flapped null↔set within one frame — which the dock
  overlay reads.

  The root's `onPointerMove` was vestigial: the "Move/resize/pan/marquee listener gap"
  fix above made the mount-scoped `window` listener the source of truth for every
  captured pointer, and did not remove the React handler it replaced. Removed. Pan and
  marquee both `capturePointer` on the root, so their moves still retarget there and
  bubble to `window`.

  **The lesson is structural, not local:** an interaction step carrying a modifier must be
  dispatched from exactly one place. Two dispatchers with different knowledge of the same
  event is a race, and the one that knows less wins whenever it runs last.

  Still worth deciding: `resolveInfiniteCanvasDockPreview` hit-tests the **pointer**
  against the target's rect, not the dragged window's rect against it. Docs say "drag a
  floating window _over another_", which reads as rect overlap. Cursor semantics match
  VS Code and Dockview and are probably right, but the wording oversells it.

## Open — medium

- **The pure core's import boundary is unenforced.** Legend State is confined to
  `store`, `rasterization`, `visibility`, and `canvas-handle` — all at the React or
  programmatic boundary — and appears nowhere in derivation. That holds today by
  construction and by reading, and nothing stops the next contributor from importing
  an observable into `reducer.ts`. `README.md` and `CONTRIBUTING.md` both claimed a
  test enforced this. **No such test exists**; only the _headless_ boundary is
  tested. The docs now say so. An import-graph assertion over the pure-core modules
  (the shape of `optional-peers.test.ts`) is the fix.
- **`docs/API.md` drifts silently, because nothing regenerates or checks it.**
  `SHIP_PLAN.md` described it as "generated from the barrel"; it is hand-maintained.
  By 2026-07-08 it was missing **43 public names** — undo/redo, layout recipes, and
  portals had no section in it _at all_, though each is a headline feature in
  `CHANGELOG.md`, and `README.md` points consumers there for "the full export
  surface". Reconciled by hand that day, which fixes the symptom and not the cause.
  The fix is a gate shaped like `scripts/verify-artifact.mjs`: extract every name
  from `index.ts` / `scene.ts`, assert each appears in `docs/API.md`, fail otherwise.
  Same shape as the pure-core import-boundary assertion below, and worth doing in the
  same pass.
- **Slot layout rigidity** — centering a header title still requires
  absolute-position hacks around `Controls`; consider slot order/areas in the
  styled-distribution work.

## Open — small / documentation

- **`hitRadius` semantics** — now documented as world units; still consider
  whether screen-pixel semantics would serve consumers better (matches the
  snap system's screen-space-threshold philosophy).
- ✅ **Snap guides for drops are consumer-rendered (fixed 2026-07-08).** The snap
  overlay drew `state.snapPreview` only, so every consumer redrew the drop's guides
  themselves, slightly differently, against the same `data-slot` contract the
  framework was already styling. The guides were being computed inside
  `getInfiniteCanvasDropPlacement` and thrown away.

  `dropPolicy.placement` now tells the framework how big the payload will be; the
  viewport snaps the drop against the same candidates a window move snaps against
  and exposes the result as `drag.placement`. `InfiniteCanvasDropSnapOverlay` draws
  it with the same layer the move overlay uses. Omit `placement` and drops behave
  exactly as before.

  `onDrop` now receives **that same placement object**, rather than the consumer
  calling `getInfiniteCanvasDropPlacement` a second time to find out where the ghost
  was. Two calls can disagree, and when they do the card lands somewhere other than
  where the preview promised. `/drop-tray` lost eighteen lines of guide meshes and a
  duplicate placement call.

- **Stress-scale raster defaults** — `maxPendingCaptures` defaults to `Infinity`, and so
  does `viewportMarginPx`; at 160 windows the capture queue churns for a long time.
  Revisit defaults with the perf deep-dive. Deliberately not changed alongside the
  liveness fix below: picking a bound without profiling would be a guess wearing a
  measurement's clothes. Rasterization is `enabled: false` by default, so these bind
  only on consumers who opted in.

## Fixed 2026-07-08 (raster queue)

- **`maxPendingCaptures` was a knob that broke the thing it bounded.** Setting it to any
  finite value made every window it refused go permanently un-rasterized. `queueCapture`
  returned `void` and simply dropped the request when the queue was full, while the body
  had _already_ written `lastRequestedSignatureRef.current = signature` before the call —
  and `shouldQueueCapture` tests `lastRequestedSignatureRef.current !== signature`. So the
  body recorded a request it never made, went quiet, and nothing ever asked again. The one
  configuration where the bound mattered — stress scale — is the one where it silently
  produced blank windows.

  `queueCapture` now returns `boolean`, and the body records the signature only when the
  queue accepted. Refusal (`false`) is distinguished from _already satisfied_ (`true`, when
  an equivalent snapshot is queued/capturing/ready): conflating them the other way turns the
  skip path into a re-arm loop.

  Liveness needs a wake-up too, and the effect's deps do not move on their own — a refused
  body keeps `wantsCapture === true` across the refusal. `useInfiniteCanvasRasterCaptureCapacity`
  selects the full ↔ not-full crossing as a boolean, so a drain re-arms the waiting bodies.
  It subscribes **only while a body is waiting**: the selector returns before touching
  `state$`, Legend records no dependency, and a completed capture does not wake the other
  159 windows. At the default `Infinity` the value is a constant `true` and the whole
  mechanism costs nothing.

## Corrected observations (no action)

- ~~"Mount the overlay surface eagerly when sceneLayers declare overlay
  placement"~~ — already the behavior: surfaces mount from **declared layer
  placement**, not drag activity (verified: two canvases at idle on
  /drop-tray). The perceived first-drag preview lag was screenshot timing —
  DOM commits paint before the next invalidated R3F frame. Nothing to change.
