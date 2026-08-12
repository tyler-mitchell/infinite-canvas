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
- **`hitRadius` documented** on the edge-target type — as world units at the time; changed to screen pixels on 2026-08-12, see the entry below.

## Open — high priority

- ✅ **Zooming mid-drag slid the window out from under the cursor (fixed 2026-07-08).** Every
  drag captured `zoom` at `startMove` and each step computed `screenDelta / interaction.zoom`.
  The wheel handler is not gated on an active interaction, so once the zoom changed the whole
  accumulated screen delta was converted at a stale scale.

  Grab a window at zoom 1, drag 100px right (world +100), zoom to 2, drag 100px more.
  `screenDelta` is 200; divided by the captured zoom 1 that is world +200, where the true
  displacement is 100 + 50 = **150**. The error was unbounded in the drag's remaining length,
  and it applied to `move`, `resize`, `groupMove`, `groupResize`, and `groupGutter` alike.

  `getInteractionWorldDelta` projects both ends — origin pointer under the origin camera,
  current pointer under the current camera — instead of dividing by one cached scalar. It is a
  strict generalization: `screenPointToWorldPoint` is `center + (p - viewport/2) / zoom`, so for
  an unchanged camera the difference is exactly `(p - origin) / zoom`, the expression it
  replaces, to the bit. `zoom` is gone from the five interaction types in favour of
  `originCamera`, which `pan` always carried.

  **This entry originally said the fix should wait for FAIL-001 as a regression test.** It
  landed without one, because the reduction above makes the static-camera case provably
  unchanged and tests are out of scope this session. The scenario remains unasserted, and the
  fix remains unobserved in a browser.

- ✅ **Pan had the sibling of that bug, and the sentence above missed it (fixed 2026-07-09).**
  "`pan` always carried `originCamera`" was true of pan's _delta_ — pan projects its center from
  the origin camera and never divided by a stale scalar, so it never slid a window. But the pan
  step wrote `camera: { ...interaction.originCamera, center }`, which spread the pan-start
  **zoom** into every frame's output. A wheel-zoom fired mid-pan — same ungated wheel handler —
  was overwritten on the very next pointermove, snapping the zoom back and discarding it.

  The step now anchors the world point grabbed at pan-start and re-projects it through the
  current zoom: `worldAtOrigin - (point - viewport/2) / camera.zoom`. Same strict-generalization
  argument as FAIL-001 — with the zoom unchanged the `viewport/2` terms cancel and it reduces to
  `originCamera.center - screenDelta / originCamera.zoom`, the old expression to the bit, so pan
  without a concurrent zoom is bit-identical. It differs only in the concurrent-pan-zoom case,
  which was the bug. Reachable through a held pan drag plus `Ctrl`/`Cmd`+wheel or a trackpad
  pinch; narrow, but real, and found by reading `stepCanvasInteraction` end to end. Unobserved
  in a browser, like its sibling.

- ~~**Interactive performance fails NFR-1 in practice.**~~ **Stale — corrected 2026-07-08.**
  This entry said `/stress` degrades "at even ~20 live windows during pan/zoom/move". It did,
  until `962e42c` restored body-content memoization on the afternoon of 2026-06-10: pan at 20
  windows went 15.6 fps → 96.9 fps, drag 4.4 fps → 58.3 fps. NFR-1's stated bar is ten
  windows, so it passes.

  What remains true, restated without the false headline: **P2's target is 100 windows at
  60 fps**, and 80 windows currently pan at 21.3 fps. The dominant remaining cost is
  frame-chrome reconciliation, which P2 tranche 1 attacked and **nobody has measured**. The
  candidates listed here are still the candidates — but the profile now says drag cost was
  bodies, confirmed, and snap-candidate rebuilds are explicitly _not_ the bottleneck at this
  N. Profile before prescribing, and read
  [performance-profile.md](performance-profile.md) first: it is measured, and this entry was
  not. Tracked as risk R15; html-in-canvas texture-mode remains the leading candidate
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

## Fixed 2026-07-08 (nudge detached a grouped window)

- **`window.nudge` wrote a group member's `rect` directly.** A member's rect is the projection
  of its group's tree, and only `interaction.step` is wrapped in
  `syncInfiniteCanvasGroupWindowRects` — `command.execute` is not. So arrowing a selected pane
  slid it out of its shell and left it there until some unrelated mutation re-solved the tree
  and snapped it back without explanation.

  Nudging a member now translates the **shell**, as dragging that member's header does
  (DOCK-003), and each group moves once however many of its members are selected.

  **The rule was already there and one command broke it.** `close`, `maximize`, and `minimize`
  all call `detachInfiniteCanvasWindowFromGroups` before touching a rect. `nudge` neither
  detached nor deferred to the shell. Any future command that writes `window.rect` must do one
  or the other, and the invariant is worth stating that plainly: **nothing outside the group
  layer may write a member's rect.**

## Fixed 2026-07-08 (window portals painted behind their window)

- **`scope="window"` never worked, and the showcase built to prove it worked showed the bug.**
  Reported by the owner from a screenshot of `/portals`: only the deliberately-wrong in-body
  popover was visible; the portalled one was nowhere.

  The window portal root rendered _before_ the `<article>` and carried no `z-index`, while the
  frame carries `getWindowStackValue(window, stackBands)`. Both are positioned elements, so paint
  order is decided by `z-index` first and document order second — and the frame won on both
  counts. The portalled content mounted, laid out at the right screen rect, and painted entirely
  underneath the opaque window body.

  Fixed by rendering the root after the frame with the frame's own stack value. Equal `z-index`,
  later in document order, so it paints above its own window — and still below any window stacked
  higher, because a popover belongs to a window rather than to the world.

  **This is the failure mode `/portals` exists to catch, and it caught nothing**, because nobody
  looked at the route after building it. The commit that shipped portals says the framework
  "renders nothing until its root exists rather than falling back into the transformed subtree,
  because a popover that quietly appears in the wrong place is a bug the consumer will chase into
  their own code." It then quietly put the popover in the wrong place.

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

- ✅ **The pure core's import boundary was unenforced (fixed 2026-07-08).** Legend State is
  confined to `store`, `rasterization`, `visibility`, and `canvas-handle` — all at the React
  or programmatic boundary — and appears nowhere in derivation. That held by construction and
  by reading, and nothing stopped the next contributor from importing an observable into
  `reducer.ts`. `README.md` and `CONTRIBUTING.md` both claimed a test enforced it. **No such
  test existed**; only the _headless_ boundary was tested.

  `scripts/verify-pure-core.mjs` crawls the import graph from 29 pure-core roots — 33 modules
  reached — and fails when any can reach `react`, `react-dom`, `@legendapp/state`, `three`,
  `@react-three/fiber`, or `@zumer/snapdom`, reporting the full trail rather than just the
  offending package. In CI before the build, and in `prepublishOnly`.

  Two decisions worth keeping: **type-only imports are ignored**, because
  `import { type InfiniteCanvasStore } from "./store"` erases before runtime and must not drag
  `store.ts` into the core — a gate with false positives is a gate people learn to route
  around; and it carries a **coverage floor**, because `optional-peers.test.ts` shipped in this
  repo passing vacuously when its regex missed `export … from` and the crawl reached exactly
  one module. Both cases negative-tested, along with a stale root entry.

- ✅ **`docs/API.md` drifted silently, because nothing regenerated or checked it
  (fixed 2026-07-08).** `SHIP_PLAN.md` described it as "generated from the barrel"; it is
  hand-maintained. It was missing **43 public names** — undo/redo, layout recipes, and
  portals had no section in it _at all_, though each is a headline feature in
  `CHANGELOG.md`, and `README.md` points consumers there for "the full export surface".

  Reconciling by hand fixed the symptom. `scripts/verify-api-doc.mjs` fixes the cause: it
  extracts every name from `index.ts` / `scene.ts` and fails when one is absent from the
  doc. Wired into CI before the build — it reads source, so it needs none — and into
  `prepublishOnly`.

  Both assertions were negative-tested. Removing a documented name fails. So does adding an
  `export const` or an `export * from`, because the parser understands only re-export
  blocks and **refuses to run rather than pass vacuously** when the barrel grows a form it
  cannot see. That second guard is the one that matters: a drift gate blind to the export
  you just added is worse than no gate, because it reports success.

  It asserts presence, not quality — a name buried in the doc with no explanation still
  passes — and it does not check the reverse direction, since the doc legitimately names
  types and options that are not themselves exports.

- ✅ **Slot layout rigidity — dissolved 2026-08-12, and not by the fix this entry expected.**
  Centring a header title needed "absolute-position hacks around `Controls`" because the header
  is a flex row with `justify-content: space-between`, so `Title` sat wherever `Controls` left
  room and pulling it to the centre meant taking it out of flow.

  This entry proposed "slot order/areas in the styled-distribution work" — a new mechanism. None
  was needed. The headless slot work closed it as a side effect: a slot's `children` replace the
  default arrangement, and a consumer `style` merges per-declaration over the framework's, so a
  three-column grid with the title in the middle column centres it against the **header** rather
  than against the space `Controls` happens to leave.

  Closed on evidence rather than by argument: `slot-render.test.tsx` builds exactly that header
  through the public API and asserts no absolute positioning is involved, and that the header's
  `data-infinite-canvas-control` drag surface survives the relayout — a centring trick that cost
  you window dragging would not be a fix.

  Worth recording as a pattern: a general capability retired a specific complaint, and building
  the proposed mechanism would have added a second way to do what one already did.

## Open — small / documentation

- ✅ **`Mod+0` reset the browser's zoom as well as the canvas's (fixed 2026-07-08).** Reset zoom
  is now **`Shift+0`**.

  This entry said the collision was "unverified, and worth ten seconds in a browser". It did not
  need a browser and it did not need ten seconds: the rule was already written down two entries
  below the offending descriptor, in this repository, by the person who shipped the offence.
  Browsers reserve `Mod` with `0`, `+`, and `-` above the page — the keydown is delivered,
  `preventDefault()` returns without error, and the zoom resets anyway — exactly as
  `Mod+Alt+Arrow` switches tabs and `Mod+Alt+C` opens DevTools. Waiting for an observation to
  confirm a rule you have already stated is not caution.

  `Shift+0` joins the view family it belongs to (`Shift+1` fits all, `Shift+2` fits the
  selection) and is unclaimed. That it survives keyboard layout was settled by **reading
  `@tanstack/hotkeys`' matcher** rather than assuming: a single-character hotkey is compared to
  `event.key` first, and when `Shift+0` yields `)` on a US layout it falls through to
  `event.code === "Digit0"`. `Shift+1` and `Shift+2` have always taken that same path, so the
  new chord is exactly as sound as the two beside it.

  What remains a browser task, and remains undone: auditing the _rest_ of
  `DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS` against real browsers. `Escape`, `Mod+A`,
  `Mod+Z`, `Mod+Shift+Z`, `Mod+Y`, `Shift+<digit>`, the arrow families, and `Mod+Shift+Enter`
  are all believed page-cancellable, but "believed" is the operative word. **`Mod+Y` is the one
  to check first**: it is the Windows redo convention, which is why it is bound here, and at
  least one desktop browser binds `Ctrl+Y` to a chrome-level action. Which one, and whether that
  binding is cancellable, is precisely the thing not to assert from memory.

- ✅ **`hitRadius` is screen pixels (decided and changed 2026-08-12).** This entry asked whether
  screen-pixel semantics "would serve consumers better". They do, and the case is stronger than
  a preference: `hitRadius` was the framework's **only** threshold measured in world units.
  Snap's `threshold` and `releaseThreshold`, the detail-level band, the offscreen inset and
  margin, the 6px tab-drag threshold, and the keyboard nudge step are all screen pixels mapped
  through the camera.

  World units make an edge's hit area shrink as you zoom out — at 25% zoom the default 10-unit
  radius is 2.5 screen pixels, so edges become unclickable exactly when you have zoomed out to
  see the whole graph and most want to click one, and balloon to a sloppy 40px at 400%. That is
  risk **R2** ("thresholds vary with zoom"), which the register records as _mitigated_ for
  snapping and which was live here, and it is the same defect as the low-zoom chrome stroke that
  rendered at a tenth of a pixel.

  The default stays 10, so behaviour at zoom 1 is unchanged and only the zoom curve differs —
  which is why every pre-existing test kept passing and why the new ones assert at 0.25 and 4,
  where the two conventions actually disagree.

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
