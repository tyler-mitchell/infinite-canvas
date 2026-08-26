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

## Result — real HTML capture, and it dwarfs everything else

`?html=1` rasterises an actual DOM subtree per window — a styled note with a
heading, paragraphs and a list, laid out by the browser — instead of painting
shapes. The heading is mutated per layer so nothing can be cached away.

**16.0 ms per window.**

Which puts the whole pipeline in proportion, per window at 512²:

| stage                           | cost per window |
| ------------------------------- | --------------- |
| **capture** (snapdom, real DOM) | **16.0 ms**     |
| upload (1 MB at ~1500 MB/s)     | ~0.7 ms         |
| draw (amortised over 500 000)   | ~0.000003 ms    |

Capture is **twenty times** the upload and six orders of magnitude past the draw.
One window re-capture costs a whole frame at 60 Hz. Everything the earlier
sections agonised over — instance counts, fill rate, even texture residency —
is noise next to this.

### What this changes

- **Capture cadence is the design.** Re-capturing on a schedule is impossible;
  it has to be event-driven, on actual content change, and coalesced. A window
  being dragged must not re-capture at all — its texture is still valid, only its
  transform changed, which is exactly what the compositor is for.
- **Live-editing a window cannot go through capture.** At 16 ms a keystroke would
  drop a frame. The window being edited stays real DOM on top of the canvas;
  capture is for the ones you are _not_ touching. That is the html-in-canvas
  hybrid, and this number is why it has to be one.

## Result — native html-in-canvas, measured

`?native=1`, run in a Chrome that has the primitives. **TypeGPU's texture array with DOM written
straight into it, one instanced draw.** No canvas backing store, no `ImageBitmap`, no upload step.

| path                                                 | per window  | upload   |
| ---------------------------------------------------- | ----------- | -------- |
| snapdom → `ImageBitmap` → `write`                    | 16.0 ms     | +0.7 ms  |
| native `drawElementImage` → `ImageBitmap` → `write`  | 4.10 ms     | +0.7 ms  |
| **native `copyElementImageToTexture` → array layer** | **4.06 ms** | **none** |

**Four times faster than the fallback, and the upload disappears.**

### The 4 ms was mostly round trip, not rasterisation

Those numbers give each window its own `requestPaint` → `paint` cycle. Hosting all 64 windows as
siblings of **one** canvas and taking a single paint gives a very different shape:

| arrangement                         | total   | per window  |
| ----------------------------------- | ------- | ----------- |
| one paint cycle per window          | —       | 4.06 ms     |
| **all 64 in one canvas, one paint** | 45 ms   | **0.70 ms** |
| one window changed, one paint       | 3.70 ms | 3.70 ms     |

Which resolves into a straightforward cost model:

```
paint round trip   ~3.0 ms   fixed, per paint — not per window
rasterisation      ~0.7 ms   marginal, per window actually repainted
transfer            0        copyElementImageToTexture — no upload step at all
```

**So "the 4 ms is rasterisation" was wrong.** Rasterising a window is ~0.7 ms; the rest was paying
a fixed round trip 64 times over. The design consequence inverts with it: do not paint per window,
**coalesce every dirty window into one paint**. One dirty window costs 3.7 ms; twenty cost about
`3 + 20 × 0.7 ≈ 17 ms`. The fixed cost is the thing to amortise, and batching is what amortises it.

### `changedElements` narrows correctly

Editing one heading among 64 and asking the paint event what changed: **1 element reported.** The
browser scopes invalidation to the element that actually changed, so a compositor does not need to
track dirtiness itself — the engine already knows and says so.

Together those give the capture budget its real shape at 60 Hz: one paint round trip plus roughly
nineteen re-rasterised windows fits in a frame. A window that merely _moved_ costs nothing at all,
because it never enters this path.

### What the API actually requires

```ts
queue.copyElementImageToTexture(
  { source: element },
  { destination: { texture, origin: [0, 0, layer] } },
);
```

Learned by probing rather than from docs, because both constraints are load-bearing:

- **The element must be an immediate child of a `layoutsubtree` canvas.** The error says so
  outright. But this is a _layout_ requirement, not a texture one — **one canvas can host every
  window's subtree**, each copying into its own array layer. This corrects an earlier note in this
  file: the native lane does **not** force one canvas per window. The `CanvasTexture` route does;
  this route does not.
- **That canvas needs a rendering context** even though nothing is ever drawn into it, or the copy
  fails with "containing canvas does not have a rendering context". It is a layout host that still
  has to be a canvas.

### Why the fallback is not the plan

snapdom was a baseline, not a candidate — it existed here to establish that the native path is
worth having, which at 4× it is. Nothing in the compositor design should be shaped around it.

### The native lane is not a faster capture — it is not a capture at all

**Everything above measures the fallback.** The primary lane is Chrome's
HTML-in-canvas, and it is a different mechanism rather than a quicker version of
the same one.

The API shape below is taken from a reference in
`agentic-tooling/plugins/codex/react-three-fiber/examples/src`. What is borrowed
is the _contract_ — which is Chrome's and therefore holds regardless of the code
wrapped around it — not that implementation's structure, which is not a model to
follow:

```ts
canvas.toggleAttribute("layoutsubtree", true); // canvas lays out its children
canvas.append(windowElement); // source is a DIRECT child
canvas.addEventListener("paint", (event) => {
  // browser says what changed
  ctx.drawElementImage(windowElement, 0, 0); // browser paints its own layout
});
canvas.requestPaint();
// the canvas itself is then the texture source — no readback
```

The differences that matter:

- **No rasterisation step to pay for.** snapdom walks the DOM, inlines computed
  styles, builds an SVG foreign object and rasterises that — reconstructing a
  layout the browser already has. The native lane has the browser paint the
  layout it already computed, straight into the canvas.
- **No readback, no blob, no `ImageBitmap`.** The canvas _is_ the texture source.
  The 16 ms above includes a round trip this path does not make.
- **Invalidation is browser-driven.** The `paint` event carries
  `changedElements`, so "what needs re-capturing" is answered by the engine
  rather than guessed at by watching state.
- **The source must be a direct child of the canvas**, and the canvas must carry
  `layoutsubtree`. That is a real structural constraint, not a detail: it means
  **one canvas per window**, not one texture array with a layer per window — so
  the 256-layer cap above does not apply to this path, and the residency model
  is different in kind.

Probed here with the correct names, all absent in this Chrome 148 build:

| feature                                     | present |
| ------------------------------------------- | ------- |
| `layoutsubtree` attribute settable          | yes     |
| `HTMLCanvasElement.requestPaint`            | **no**  |
| `CanvasRenderingContext2D.drawElementImage` | **no**  |
| `HTMLCanvasElement.captureElementImage`     | **no**  |
| `onpaint` handler slot                      | **no**  |

The attribute being settable is meaningless on its own — any attribute can be
set — and the reference's own probe says exactly that.

**So the 16 ms is an upper bound on the wrong path.** It is the right number to
plan against _today_, and the wrong one to design the architecture around. What
is still missing is the native cost, and getting it needs a Chrome launched with
the feature enabled.

## What is still not settled

- **Fill rate.** Every run above is at zoom 0.35 with most quads small or
  offscreen. The instance count was never the bottleneck, so these are
  instance-count and upload results, not fill results. Windows filling the
  viewport is a different test and has not been run.
- **Culling.** Not implemented. The GPU processes all N instances every frame,
  including those far offscreen — so the geometry numbers are a conservative
  worst case, but no real compositor would do this.
- **The native capture lane.** Measured above with snapdom only;
  `ctx.drawElement` needs a flagged Chrome and is the number that matters most.
