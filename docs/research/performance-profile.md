# Performance Profile: Stress Stage (R15)

> Measured 2026-06-10 in the embedded preview browser (Electron 41 /
> Chrome 146, 1600×1000, 120Hz-capable rAF) on `/stress`, driving synthetic
> wheel-pan, ctrl-wheel zoom, and header-drag at one input event per
> animation frame. Numbers are frame-time averages over ~1.5s runs;
> machine-relative, but the ratios and scaling slopes are the findings.

## Before (as ported)

| windows | idle    | pan             | zoom            | drag                     |
| ------- | ------- | --------------- | --------------- | ------------------------ |
| 20      | 120 fps | 15.6 fps (64ms) | 14.2 fps (70ms) | 4.4 fps (225ms)          |
| 40      | —       | 8.2 fps (121ms) | —               | ~14 fps (70–90ms, noisy) |

Attribution evidence:

- Pan cost scaled linearly with window count (64→121ms for 20→40).
- Style-mutation counts: pan rewrote ~1 style per window per frame (the
  transform — necessary); zoom rewrote ~15 styles per window per frame
  (zoom-dependent chrome metrics).
- **The decisive experiment**: with rasterization on (39/40 bodies as
  `<img>` snapshots), pan dropped 121ms → 23ms. The dominant cost was
  live window **body subtree reconciliation**, not chrome, not snap.
- Drag's catastrophic 225ms/frame had only ~8 style writes — JS-side
  reconciliation, same root cause (every body re-rendered per pointermove).

## Root cause

`InfiniteCanvasWindowBody` invoked `definition.renderBody({ …, state, … })`
inline on every render, and the render context carried the full canvas
state — so every camera/interaction tick reconciled every live body
subtree in the document. The kek predecessor explicitly memoized body
content ("shell movement does not imply body subtree churn",
`desktop-window-body-content.tsx`); the framework rewrite lost that
property.

## Fix (landed)

`useRenderedWindowBody` memoizes the rendered body on
`[actions, definition, isActive, isSelected, window]` — camera and
unrelated state changes no longer invalidate bodies. `state` is provided
through a ref-backed getter: fresh whenever the body re-renders for its own
reasons, but not an invalidation source. Bodies that need live state should
subscribe via `useInfiniteCanvasSelector` inside their own components,
keeping invalidation scoped to what they read.

## After

| windows | pan                   | zoom            | drag            |
| ------- | --------------------- | --------------- | --------------- |
| 20      | **96.9 fps** (10.3ms) | 66.7 fps (15ms) | 58.3 fps (17ms) |
| 40      | **52.1 fps** (19.2ms) | 32 fps (31ms)   | 38 fps (26ms)   |
| 80      | 21.3 fps (47ms)       | 16.6 fps (60ms) | —               |

NFR-1 (≥10 windows without obvious degradation) is now met with headroom;
the 20-window experience Tyler flagged is at ~97fps pan / ~58fps drag.

## Remaining cost model and next tranches

Per-window per-frame cost is now ~0.5ms (pan @ 80: 47ms ≈ 80 × 0.55 + base),
which is **frame-chrome reconciliation**: each camera tick re-renders every
`InfiniteCanvasWindowFrame` (new screen transform) and reconciles its
~15-element chrome subtree even though only the outer transform changed.
In rough order of leverage:

1. ~~**Memoize the frame's inner chrome**~~ — **landed, unmeasured.** See
   below.
2. **Texture-mode-during-camera-motion** (html-in-canvas, owner directive):
   present cached window textures on the WebGPU plane during pan/zoom and
   swap live DOM back on settle — removes DOM from the camera loop entirely;
   the rasterization experiment above (5×) is its lower bound. Requires
   Chrome 148+ with the Origin Trial / flag
   ([html-in-canvas.md](html-in-canvas.md)).
3. **Visibility culling in the window layer** — offscreen windows currently
   still render frames; the visibility subsystem exists but the layer maps
   all windows. Pairs naturally with (1).
4. Snap candidate indexing ([snapping.md](snapping.md)) — NOT currently a
   bottleneck (drag cost was bodies, confirmed), revisit at larger N.

Re-measure on real hardware (the embedded browser underclocks rAF under
load) before declaring absolute numbers; the protocol above is reproducible
via the synthetic drivers in this doc's history.

## Tranche 1: frame chrome memoization (landed, NOT YET MEASURED)

> No numbers in this section. The change is argued structurally; the table
> above still describes the pre-tranche-1 runtime. Re-run the protocol on
> real hardware before quoting any figure.

The rule the frame is now built around: **only the outer transform may
change per camera tick.**

- `InfiniteCanvasWindowFrame` no longer receives `state`. It takes `camera`
  and `viewport` — what the transform needs — and reads everything else
  through the store at call time. Threading `state` down was what forced
  every memo beneath it to churn.
- The frame's runtime context, its rendered chrome node, and its eight
  resize-handle elements are each memoized on the window's own identity.
  On pan they are all referentially stable, so React bails out of the
  subtree and the work collapses to one inline-style write per window.
- The runtime context no longer carries canvas state at all, which removes
  the last per-tick invalidation source from the slot subtree.
- `InfiniteCanvasWindowBody` stopped taking `state` as a prop and now
  subscribes to the two booleans it actually reads (raster eligibility, and
  whether the canvas is idle). A pan recomputes both every tick and
  re-renders nothing, because neither answer changed.

**Zoom should no longer be structurally costlier than pan.** The previous
per-zoom cost was `getResizeHandleDescriptors(size / zoom)` allocating eight
fresh inline styles per window per frame. Handle geometry is now expressed
against a `--icx-resize-handle-size` custom property published on the frame,
whose inline style is rewritten every tick regardless — so the handle
elements are constant across zoom. `chrome` metrics are zoom-independent.

The prediction to test: pan and zoom both approach the cost of one style
write per window, and drag cost stays proportional to the _dragged_ window
only (its `window` identity changes; the others' does not).
