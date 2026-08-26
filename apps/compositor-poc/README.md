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
readonly storage buffer by `$instanceIndex`:

| quads   | draw calls | GPU time    | frame           |
| ------- | ---------- | ----------- | --------------- |
| 2 000   | 1          | 0.066 ms    | 11.9 ms         |
| 20 000  | 1          | 0.131 ms    | 8.7 ms (115fps) |
| 100 000 | 1          | 0.918 ms    | 8.2 ms (122fps) |
| 500 000 | 1          | _see below_ | 8.3 ms (120fps) |

GPU time is a real timestamp query (`withPerformanceCallback`), not a frame
delta. Frame time is pinned at the display's 120 Hz throughout, so it says only
that nothing here comes close to the budget.

**The 500 000 row reads `0.000 ms` and that number is not real.** The query set
skips a frame when a previous read is still in flight — the docs say to gate on
`querySet.available` — so the callback simply did not land in the sampled frame.
It rendered at 120 Hz; its GPU cost was not captured.

### What this settles

A workbench has hundreds of windows, maybe low thousands. At 100 000 the geometry
costs under a millisecond in a single draw. **There is no scene graph to miss**,
and `three`'s contribution to this workload is zero — which is what the
compositor plan assumed and had not proven.

### What it does not settle

- **Fill rate, which is the real constraint.** Every measurement above is at
  zoom 0.35 with most quads small or offscreen. The instance count was never the
  bottleneck, so this is an instance-count result, not a fill result. Windows
  filling the viewport is a different test.
- **Question 3, textures.** Every quad here samples nothing; the fragment does a
  cheap procedural edge instead. Real per-window textures from HTML capture bring
  upload bandwidth, atlas or array management, and re-capture cadence — none of
  which a tint can stand in for.
- **Culling.** Not implemented. The GPU is processing all N instances every frame,
  including those far offscreen. That is the honest worst case, so the numbers are
  conservative — but a real compositor would not do this.
