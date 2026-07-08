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
- **`window.data` generic threading.** The helper removes the boilerplate,
  but threading `Data` through `defineInfiniteCanvasWindowRegistry` and the
  render contexts is the real fix.

## Fixed 2026-07-08

- **Popovers inside window bodies land in the wrong place.** A frame is
  `transform: scale(zoom)`, which makes it the containing block for
  `position: fixed`, so every floating-UI library resolves against the frame and
  gets scaled by the zoom. Fixed with framework-owned portal roots
  (`src/portal.tsx`, `<InfiniteCanvasPortal>`): a desktop root at viewport level,
  and an opt-in window-local root tracking the window's screen rect. `/portals`
  demonstrates both.

## Open — medium

- **Typed-payload contexts don't downcast** — `InfiniteCanvasOverlayRenderContext<K, Payload>`
  isn't assignable to the default-payload form (contravariant `startDrag`),
  so generic consumer utilities must carry both type params. Consider
  splitting read surface (covariant) from the drag-start function.
- **Slot layout rigidity** — centering a header title still requires
  absolute-position hacks around `Controls`; consider slot order/areas in the
  styled-distribution work.
- **Handle change-subscription** — `createInfiniteCanvasHandle` ships without
  `subscribe`; add once the Legend-State subscription surface to expose is
  settled (and consider spatial queries, which live in the render layer).

## Open — small / documentation

- **`hitRadius` semantics** — now documented as world units; still consider
  whether screen-pixel semantics would serve consumers better (matches the
  snap system's screen-space-threshold philosophy).
- **Snap guides for drops are consumer-rendered** — the built-in snap overlay
  only draws `state.snapPreview` (move/resize interactions). Now that drop
  placement returns a snap preview, consider letting the framework overlay
  render it.
- **Stress-scale raster defaults** — `maxPendingCaptures` defaults to
  `Infinity`; at 160 windows the capture queue churns for a long time.
  Revisit defaults with the perf deep-dive.

## Corrected observations (no action)

- ~~"Mount the overlay surface eagerly when sceneLayers declare overlay
  placement"~~ — already the behavior: surfaces mount from **declared layer
  placement**, not drag activity (verified: two canvases at idle on
  /drop-tray). The perceived first-drag preview lag was screenshot timing —
  DOM commits paint before the next invalidated R3F frame. Nothing to change.
