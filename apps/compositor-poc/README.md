# Compositor proof of concept

Throwaway. Imports nothing from `@hyphened/infinite-canvas`, and nothing here is
meant to survive except an answer and a number.

## The question

Not "can TypeGPU draw" — [the spike](../polkadot/SPIKES.md) already settled that
the field's shader compiles to correct WGSL and creates a pipeline against a real
device.

The question is the one that decides whether the compositor in
[`docs/compositor.md`](../../docs/compositor.md) is the right shape at all:

> **Is the workload really textured quads and full-screen passes?**

If drawing window proxies at a count that hurts — with real per-window textures,
a camera, and culling — needs something a scene graph provides, then `three` is
load-bearing after all and the plan is wrong. Better to find that here than
halfway through replacing a surface the framework ships.

## What it has to answer

1. **Frames at a window count that hurts.** Not 8 windows. Hundreds, then
   thousands, until it breaks — and _what_ breaks: draw calls, fill rate, or
   texture memory.
2. **Whether one instanced draw is enough.** If every quad can be one instance
   reading its rect from a storage buffer, there is no scene graph to miss. If
   per-window state forces a draw call each, that is the finding.
3. **What HTML-derived textures cost.** A window's pixels come from capture.
   Upload bandwidth and re-capture cadence are the parts a shader benchmark
   cannot fake.

Question 3 is deliberately last: 1 and 2 can invalidate the whole approach on
their own, and cost less to answer.

## What it is allowed to be

Ugly, hard-coded, and deleted. No React, deliberately — a reconciler is the thing
being removed, so bringing one in would prove nothing. No abstraction earned by
anything other than the measurement.

## Result — question 2 answered, question 1 answered for geometry

**One instanced draw is enough, by three orders of magnitude.**

Apple GPU (`metal-3`), Chrome 151, one `draw(6, n)` per frame, rects read from a
readonly storage buffer by `$instanceIndex`, **every quad sampling its own layer
of a texture array**:

| quads   | draw calls | GPU time | samples | frame           |
| ------- | ---------- | -------- | ------- | --------------- |
| 20 000  | 1          | 0.262 ms | 2       | 8.3 ms (120fps) |
| 100 000 | 1          | 1.180 ms | 99      | 8.3 ms (120fps) |
| 500 000 | 1          | 1.638 ms | 1186    | 8.4 ms (119fps) |

GPU time is a real timestamp query (`withPerformanceCallback`), not a frame
delta. Frame time is pinned at the display's 120 Hz throughout, so it says only
that nothing here comes close to the budget.

The sample column is there because it has already caught two mistakes. Early
readings showed `0.000 ms` and were briefly written up as "the instrument broke
when textures were added" — wrong twice over. The callback simply had not fired
yet in the seconds before the screenshot; once warmed it fires freely, 1186 times
at half a million quads. **A zero from this readout means no sample landed, never
that a frame was free**, and the counter is what makes the difference visible
rather than a matter of trust.

For comparison, the same counts before textures were added measured 0.131 ms at
20 000 and 0.918 ms at 100 000 — so sampling a per-window texture roughly doubles
a cost that was already negligible.

### What this settles

A workbench has hundreds of windows, maybe low thousands. **Half a million
textured quads cost 1.6 ms in a single draw call.** There is no scene graph to
miss, and `three`'s contribution to this workload is zero — which is what the
compositor plan assumed and had not proven.

## Result — question 3, and it inverts the picture

**Texture residency is the binding constraint, and it binds three orders of
magnitude earlier than geometry does.**

Each quad samples its own layer of a `texture_2d_array`, uploaded as one batched
write and timed to `queue.onSubmittedWorkDone()` rather than to the enqueue call:

| layers | size  | VRAM   | upload   | rate      |
| ------ | ----- | ------ | -------- | --------- |
| 64     | 256px | 16 MB  | —        | —         |
| 256    | 512px | 256 MB | 131.2 ms | 1951 MB/s |

And a hard wall sits right there: **`maxTextureArrayLayers` is 256.** An 8192²
atlas — the largest 2D texture the device allows — holds only **341** windows at
512×384.

### What this settles

Geometry was never going to be the problem. **256 windows cost 256 MB and 131 ms
of upload; 100 000 quads cost 0.9 ms of draw.** So the compositor's hard parts are
not the ones the plan was worrying about:

- **A single texture array cannot hold a canvas.** Past 256 windows it is
  multiple arrays, an atlas, or both — and an atlas caps out around 341 at
  readable resolution.
- **Residency has to be managed.** Windows far from the camera need smaller
  textures or none; offscreen windows need to give theirs back. This is what a
  browser compositor does with tiles, and it is not optional here.
- **Re-capture has a budget.** At 1951 MB/s, one 512² window costs about half a
  millisecond to upload. That affords a couple of dozen re-captures per frame at
  60 Hz, not hundreds — so capture cadence is a scheduling problem, not a
  fire-and-forget one.

None of that argues against the compositor. It argues that the interesting design
work is the **resource** half of the contract — `scale`, residency, eviction —
rather than the pass ordering, which was the easy part to write down.

## What is still not settled

- **Fill rate.** Every run above is at zoom 0.35 with most quads small or
  offscreen. The instance count was never the bottleneck, so these are
  instance-count and upload results, not fill results. Windows filling the
  viewport is a different test and has not been run.
- **Culling.** Not implemented. The GPU processes all N instances every frame,
  including those far offscreen — so the geometry numbers are a conservative
  worst case, but no real compositor would do this.
- **Real HTML capture.** The layers are painted with 2D canvas calls, which is a
  fair stand-in for the _upload_ (snapdom hands back a canvas either way) but
  says nothing about what rasterising real DOM costs, or how often it must happen.
