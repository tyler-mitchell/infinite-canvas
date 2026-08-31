# Performance profile for the R15 stress stage

> Measurements from 2026-06-10 used the embedded preview with Electron 41 and Chrome 146.
> The viewport was 1600×1000, and the browser supplied 120 Hz `rAF` callbacks.
> `/stress` received one synthetic input event per frame for pan, zoom, and header drag.
> Each result is the mean frame time from an approximately 1.5-second run.
> Absolute values depend on the machine. Ratios and scaling slopes are the useful results.

## Baseline before body memoization

| windows | idle    | pan             | zoom            | drag                     |
| ------- | ------- | --------------- | --------------- | ------------------------ |
| 20      | 120 fps | 15.6 fps (64ms) | 14.2 fps (70ms) | 4.4 fps (225ms)          |
| 40      | —       | 8.2 fps (121ms) | —               | ~14 fps (70–90ms, noisy) |

The following observations identify the main cost:

- Pan cost increased with the window count from 64ms at 20 windows to 121ms at 40 windows.
- Pan changed approximately one style per window in each frame.
  This change was the required transform.
- Zoom changed approximately 15 styles per window in each frame because chrome metrics depended on zoom.
- Raster mode represented 39 of 40 bodies with `<img>` snapshots.
  In this mode, pan decreased from 121ms to 23ms.
  Live body reconciliation was the largest cost.
- Drag took 225ms per frame with approximately eight style changes.
  JavaScript reconciliation caused this cost because each pointer move rendered every body again.

## Cause

`InfiniteCanvasWindowBody` called `definition.renderBody({ …, state, … })` during each render.
The render context contained all canvas state.
Thus, each camera or interaction update reconciled every live body in the document.

The kek predecessor memoized body content.
It described the invariant as "shell movement does not imply body subtree churn" in `desktop-window-body-content.tsx`.
The framework port did not preserve that invariant.

## Body memoization fix

Status: Landed.

`useRenderedWindowBody` memoizes rendered output with `[actions, definition, isActive, isSelected, window]`.
Camera changes and unrelated state no longer invalidate body output.
A ref-backed getter supplies current `state` when the body renders for another reason.
The complete `state` value does not invalidate the body.

A body that needs live state uses `useInfiniteCanvasSelector` inside its component.
This subscription limits invalidation to the values that the body reads.

## Result after body memoization

| windows | pan                   | zoom            | drag            |
| ------- | --------------------- | --------------- | --------------- |
| 20      | **96.9 fps** (10.3ms) | 66.7 fps (15ms) | 58.3 fps (17ms) |
| 40      | **52.1 fps** (19.2ms) | 32 fps (31ms)   | 38 fps (26ms)   |
| 80      | 21.3 fps (47ms)       | 16.6 fps (60ms) | —               |

NFR-1 requires at least ten windows without obvious degradation.
The measured result meets this requirement with 20 windows.
Tyler reported the previous problem at 20 windows.
The corrected result was approximately 97 fps during pan and 58 fps during drag.

## Remaining cost

Pan at 80 windows took 47ms.
This result gives an approximate per-window cost of 0.5ms, plus the fixed frame cost.
Each camera update renders every `InfiniteCanvasWindowFrame` with a new screen transform.
React then reconciles its chrome tree of approximately 15 elements, although only the outer transform changes.

## Work sequence

### 1. Inner frame chrome memoization

Status: Landed and unmeasured. The next sections describe this change.

### 2. Texture mode during camera motion

Cached window textures appear on the WebGPU plane during pan and zoom.
Live DOM returns after motion stops.
This html-in-canvas path removes DOM from the camera loop.
The raster experiment gives a 5× lower-bound improvement.

Tests require Chrome 148 or later with the Origin Trial or flag.
See [html-in-canvas.md](html-in-canvas.md).

### 3. Visibility culling

Off-screen windows currently render their frames.
**Correction 2026-07-08:** The statement "the visibility subsystem exists but the layer maps all windows" was wrong.
The R3F frustum probe is the only writer for `visibility.tsx`.
It belongs to the optional `/scene` entry and operates only with `diagnostics.frustum`.
Thus, consumers without `three` have no frustum visibility data.
For those consumers, this data culls no windows.

Culling cannot depend on this optional 3D entry.
This rule keeps rendering independent from the `/scene` peer.
`isWorldRectWithinViewport` in `geometry.ts` supplies a pure predicate from the camera.

The window layer must keep off-screen windows mounted.
Unmounting moves focus to `<body>`, which disables every hotkey.
It also removes portal roots, body scroll, video state, and uncontrolled input state.
These values return empty when the window enters the viewport again.
Skipping its transform update has no visible effect while it remains off-screen.

### 4. Snap-candidate indexing

Larger window counts must show a measured need before this work starts.
[snapping.md](snapping.md) describes the candidate design.
Snap candidates did not cause the measured drag cost.

Measure again in a standard browser on physical hardware.
The embedded preview decreases its callback rate under load, so it cannot supply useful absolute values.

## Benchmark driver (added 2026-07-08)

The earlier document said that the protocol was "reproducible via the synthetic drivers in this doc's history".
Those drivers did not exist in the repository.
As a result, another run required reconstruction of the benchmark.
The memoized chrome change remained unmeasured.

The benchmark is in `apps/playground/src/showcases/benchmark.ts`.
It mounts on `/stress` during development:

```js
// http://localhost:5173/stress?count=40
await window.__canvasBench.table(); // pan, zoom, drag — markdown, ready to paste
await window.__canvasBench.run({ gesture: "pan" }); // one gesture, structured
```

The driver sends one input event per animation frame, as the 2026-06-10 measurements did.
It measures the interval between consecutive `requestAnimationFrame` timestamps.
This interval includes handlers, reconciliation, style, layout, and paint.
The first frame contains `startPan` or `startMove`.
The driver excludes this frame from steady-state results.

The output reports the mean and `p95`.
For interaction quality, `p95` is the primary value.
A 12ms mean can hide two 40ms frames each second.
The earlier tables contain only means.

A drag sends `pointermove` to `window` because the framework mounts its interaction listeners there.
Sending it to the header does not drive the framework.
The driver sends wheel input to the viewport.
An unmodified wheel event over a scrollable body belongs to that body.

Building the benchmark code did not require a browser.
Collecting measurements requires a browser.

## Frame chrome memoization

Status: Landed. The embedded preview measurement did not complete.
The result tables predate this change and do not describe its runtime.
New published numbers require a completed run on physical hardware.

Only the outer transform changes during a camera update.
The implementation enforces this rule:

- `InfiniteCanvasWindowFrame` receives `camera` and `viewport`.
  It does not receive `state`.
  It reads other values from the store when required.
  Passing all state through the frame prevented memoization below it.
- The frame memoizes its runtime context, chrome node, and eight resize handles by window identity.
  These values remain identical during pan.
  React can then limit the update to one inline transform style per window.
- The runtime context does not contain canvas state.
  Thus, camera state cannot invalidate slot content through this context.
- `InfiniteCanvasWindowBody` does not receive `state`.
  It subscribes to raster eligibility and the canvas idle state.
  Pan recalculates these booleans, but unchanged values do not render the body again.

Before this change, zoom called `getResizeHandleDescriptors(size / zoom)`.
This call allocated eight new inline styles for each window in each frame.
Handle geometry uses the `--icx-resize-handle-size` custom property on the frame.
The frame already changes its inline style in each camera frame.
Thus, the handle elements remain stable during zoom, and `chrome` metrics no longer depend on zoom.

Target result: Pan and zoom approach one style change per window.
Drag cost grows with the changed window because other window identities remain stable.
Only the changed window receives a new `window` identity.

## Embedded preview measurement on 2026-07-09

The attempt called `window.__canvasBench.baseline()` on `/stress?count=20&raster=false` in the embedded preview.
That session supplied only the sanctioned `preview_*` browser tools.
The `baseline()` call covers pan, zoom, and drag.

The benchmark mounted on `/stress` and drove pan, zoom, and drag at one input per `rAF`.
The page reported no errors and remained responsive.
State reads returned without delay at each observation point.

The preview did not finish three gestures with 90 measured frames each.
After more than 280 seconds at 20 windows, the command was still active.
The effective callback rate during drag was near 1 fps.
A 20, 40, and 80-window set requires much of an hour in this environment.
Its absolute values remain unreliable.

This result proves the "re-run on real hardware" requirement.
The preview changes `rAF` timing under the same load that the benchmark applies.

Thus, its wall time and frame values describe the preview sandbox.
They do not describe the framework.
C4 requires a standard browser on physical hardware, where `baseline()` completes in seconds.
The benchmark is ready for that measurement.
