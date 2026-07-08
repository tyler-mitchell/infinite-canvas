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
   still render frames. _Corrected 2026-07-08: "the visibility subsystem exists
   but the layer maps all windows" was wrong._ `visibility.tsx` is written only
   by the R3F frustum probe, which ships behind the optional `/scene` entry and
   runs only under `diagnostics.frustum` — culling on it would cull nothing for
   any consumer without `three` installed, and would re-couple rendering to the
   3D peer the `/scene` seam exists to keep out. The culling predicate is
   `isWorldRectWithinViewport` in `geometry.ts`: pure, camera-derived, no peer.
   **And culling must not unmount** — dropping an offscreen window from the
   layer tears down its subtree, so DOM focus on the active window falls to
   `<body>` and silently kills every hotkey, portal roots unmount, and body
   scroll, video, and uncontrolled input state come back blank on pan-in.
   Skipping a _transform update_ for an invisible window is unobservable;
   unmounting is not.
4. Snap candidate indexing ([snapping.md](snapping.md)) — NOT currently a
   bottleneck (drag cost was bodies, confirmed), revisit at larger N.

Re-measure on real hardware (the embedded browser underclocks rAF under load)
before declaring absolute numbers.

## The harness (added 2026-07-08)

This document used to close by saying the protocol was "reproducible via the
synthetic drivers in this doc's history" — which meant the drivers were **not in
the tree**, and every number above was produced by code nobody could re-run.
That is why tranche 1 sat landed and unmeasured: re-deriving the harness costs
more than reading the diff, so nobody did, so the tables stayed stale.

The harness now lives at `apps/playground/src/showcases/benchmark.ts` and mounts
on `/stress` in dev:

```js
// http://localhost:5173/stress?count=40
await window.__canvasBench.table(); // pan, zoom, drag — markdown, ready to paste
await window.__canvasBench.run({ gesture: "pan" }); // one gesture, structured
```

One input event per animation frame, as in the 2026-06-10 runs. Frame duration is
the delta between successive `requestAnimationFrame` timestamps, so it measures
the whole frame — handlers, reconciliation, style, layout, paint — because that is
what a user feels. The first frame of a gesture is discarded: it carries
`startPan`/`startMove` and is not steady state.

**It reports `p95` alongside the mean, and `p95` is the number that matters.** A
pan averaging 12 ms that spikes to 40 twice a second feels broken, and the mean
will not say so. The tables above predate the harness and carry means only.

Two properties worth keeping. A drag dispatches `pointermove` on `window`, not on
the header, because the framework's interaction listeners are mount-scoped there —
a driver that moved the header would measure nothing and pass. And the wheel is
dispatched on the viewport element rather than a window body, because an
unmodified wheel over a scrollable body belongs to the body, by design.

**Building the harness needed no browser. Running it does.** That asymmetry is the
point: the numbers are now one console call away rather than one archaeology
session away.

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
