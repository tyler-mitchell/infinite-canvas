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

## Open — high priority

- **Interactive performance fails NFR-1 in practice.** Both this playground's
  /stress stage and the kek implementation degrade at even ~20 live windows
  during pan/zoom/move. A dedicated performance deep-dive is planned (profile
  before prescribing: candidate suspects include per-window React re-renders
  on camera change, full-window-array signal subscriptions in the frame path,
  and per-pointer-move snap candidate rebuilds — see
  [snapping.md](snapping.md) on spatial indexing). Tracked as risk R15.
- **`window.data` is `unknown` at render time.** The `Data` generic exists on
  `createInfiniteCanvasWindow` but doesn't survive into registry/render
  contexts, so every consumer hand-rolls guard-and-cast helpers. Thread the
  generic through `defineInfiniteCanvasWindowRegistry` and the render
  contexts, or ship a `getInfiniteCanvasWindowData(window, guard)` helper.
- **Frame-slot styling conflicts resolve by stylesheet order.** Slot
  `className`s concatenate (no merge), so a consumer's `normal-case` may
  silently lose to the baked-in `uppercase`. Dissolves with the headless
  extraction (data-slot attributes + stylesheet); until then it's a known
  trap. Slot layout is similarly rigid (centering a header title requires
  absolute-position hacks around `Controls`).

## Open — medium

- **HUD title/subtitle cannot be disabled** — every desktop renders the HUD
  block; defaults apply even when props are omitted. Wants `hud={false}` or a
  render slot (naturally part of the headless surface).
- **Typed-payload contexts don't downcast** — `InfiniteCanvasOverlayRenderContext<K, Payload>`
  isn't assignable to the default-payload form (contravariant `startDrag`),
  so generic consumer utilities must carry both type params. Consider
  splitting read surface (covariant) from the drag-start function.
- **Drop-drag listeners attach in `useEffect`** — pointermoves landing in the
  same frame as the starting pointerdown are dropped, and automated drivers
  must yield between down/move/up. Attaching window listeners synchronously
  inside `startDrag` removes the gap.
- **The agent/dev handle is playground glue** — `window.__canvas` is wired
  through `renderOverlay` (must return null, reassigns per render, stale
  after unmount). The contract already exists (commands facade + serializer +
  spatial queries); promote to `createInfiniteCanvasHandle()` when ready.

## Open — small / documentation

- **`hitRadius` on edge targets is in world units** — undocumented; easy to
  assume screen pixels (which would also be the more useful semantic given
  the screen-space-threshold philosophy of the snap system — consider).
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
