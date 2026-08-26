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

Ugly, hard-coded, and deleted. No abstraction earned by anything other than the
measurement.

The geometry results below were taken with no React at all, deliberately: a
reconciler driving GPU objects is the thing being removed, so those numbers had
to stand without one. React arrived later for the opposite end of the pipe — it
renders the source DOM that gets captured, which is the job React has always had
and the one the real app needs. The two never meet.

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
- ~~**Live-editing a window cannot go through capture.**~~ **Wrong, and only ever
  true of the fallback.** At snapdom's 16 ms a keystroke drops a frame, so this
  file concluded the edited window had to stay real DOM floating above the
  canvas. On the native lane a burst of thirty-six keystrokes costs 5.1 ms, and
  text editing inside a captured window is measured working further down. The
  hybrid may still be wanted for other reasons; this is no longer one of them.

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

### `changedElements` narrows exactly

`?dirty=N` edits N of the 64 windows and takes one paint. The event reported the dirty count every
single time — **1, 5, 20, 64** — never more, never fewer. The browser scopes invalidation precisely,
so a compositor must not keep its own dirty set; the engine already has one and hands it over.

### The budget, measured across the curve

| dirty windows | one coalesced paint | per window | fits in a 60 Hz frame? |
| ------------- | ------------------- | ---------- | ---------------------- |
| 1             | 3.70 ms             | 3.70 ms    | yes                    |
| 5             | 9.00 ms             | 1.80 ms    | yes                    |
| 20            | 11.20 ms            | 0.56 ms    | yes                    |
| 64            | 32.30 ms            | 0.50 ms    | no — about two frames  |

**Roughly twenty windows can be re-captured inside a single 60 Hz frame.** Past about thirty the
budget is gone and the work has to spread across frames, which is what makes this a scheduler
rather than a policy.

The marginal cost keeps falling as the batch grows — 3.70 ms for one, 0.50 ms each for
sixty-four — which is the fixed round trip being amortised, and the reason coalescing is the whole
design.

> **The "all 64" control is noisy and should not be quoted.** Across runs it read 43, 88 and 67 ms
> for identical work, because it includes first layout and a cold start. The `dirty` rows are
> steady-state and are the ones to trust.

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

## Result — fill rate

`?overdraw=1` stacks every quad over the whole visible world, so each is drawn full-viewport and
every fragment is written `n` times. Fifty layers of full-screen textured overdraw:

**0.240 ms.**

Fill is not a constraint either. Both halves of the geometry question are now answered and neither
is anywhere near the budget.

## Result — interaction, and this is the finding that matters most

A captured window is a texture. What decides whether this is a **compositor** or a gallery of
screenshots is whether a pointer reaches the DOM that made it.

It does. Hovering a button inside a captured window lights it up; clicking it flips its state, and
the change shows up on the canvas:

| interaction                 | hit-test → DOM change → paint → copy |
| --------------------------- | ------------------------------------ |
| hover enter / leave         | 2.50 ms                              |
| click (state + text change) | 4.10 ms                              |

Both sit inside a 60 Hz frame, and both are the _entire_ round trip, timed to
`queue.onSubmittedWorkDone()` rather than to the enqueue call.

### Picking needs no GPU pass

The surface is flat and the camera transform affine, so inverting it on the CPU is exact: screen
point → world point → which quad (last match wins, since later instances draw over earlier) → local
pixel via the quad's UV × `textureSize`. No ID buffer, no readback, no extra pass. A _deforming_
surface would need one; a flat one never does.

### `elementFromPoint` cannot see into a `layoutsubtree` canvas

The first attempt routed the hit through `document.elementFromPoint`, which returned nothing —
consistently, for every point inside every captured window. Children of a `layoutsubtree` canvas are
laid out and painted by that canvas rather than composited into the page's normal hit-test tree.

**So the compositor owns hit-testing.** It already has the window rects; what it additionally needs
is each window's _interior_ geometry, and that comes from `getBoundingClientRect` on the source
elements — free and exact, precisely because the browser really did lay them out.

Two consequences, both architectural:

- **The source subtree must stay attached and laid out.** Detaching the layout host after the first
  capture looked harmless and silently broke everything downstream: no layout means
  `getBoundingClientRect` reports zeros, so every control's box collapsed to a point and no click
  could ever land. It is parked behind the opaque surface instead.
- **Hover cannot come from CSS.** The source DOM is never under the user's pointer — the pointer is
  over the WebGPU canvas the whole time — so `:hover` can never fire on it. The compositor resolves
  what is under the pointer, marks it on the source element, and repaints. That is why hover appears
  in the table above as a measurable cost at all.

The same reasoning rules out **CSS transitions and animations inside a captured window**: a captured
surface only advances when it is repainted, so an animated state freezes at whatever frame the paint
happened to catch. Motion on the canvas belongs to the shader, not to the captured pixels.

### Text editing works, and the caret survives capture

Clicking a text field inside a captured window focuses it, typing reaches it, and the characters
appear on the canvas — **including the caret**, which is in the captured pixels rather than drawn
over them.

The compositor's whole contribution is deciding _which_ field. After `focus()`, keystrokes,
selection and IME are the platform's, through channels the compositor never touches. This is the
part that could most easily have been a wall and is not one.

Two things it does have to own, and both are the same shape of problem:

- **The focus ring.** Browsers paint focus rings on their own compositor, above the page, so a
  capture does not contain one. It has to be drawn in CSS on the source element.
- **The caret's blink.** The caret is captured, but a captured surface only advances when it is
  repainted — so between keystrokes the blink freezes at whatever phase the last paint caught. An
  idle focused field needs either a repaint tick of its own or a caret the compositor draws.

### Per-event capture does not work; per-flush coalescing does

The first version repainted per interaction and measured **15.9 ms a keystroke** against 4.2 ms for
a single paint — fast typing put several paints in flight and each waited behind the last. Same
fixed round trip this file already identified, arriving through a door nobody was watching.

The fix is not a fixed cadence. While a paint is in flight, further changes only mark layers dirty;
when it lands, one more paint covers everything that accumulated:

| interaction         | coalesced cost                    |
| ------------------- | --------------------------------- |
| hover enter / leave | 1.90 ms (1 event → 1 layer)       |
| click               | 4.10 ms (1 event → 1 layer)       |
| **typing burst**    | **5.10 ms (36 events → 1 layer)** |

**Thirty-six keystrokes for the price of one paint.** Capture rate self-tunes to whatever the
pipeline can sustain, so cost is bounded by the paint rate rather than the event rate — which is
what makes input cost independent of how fast the user is.

## Result — React renders the windows, and owns their state

Every window is now a real React component with real `useState`. One root renders straight _into_
the layout canvas, so each `.note` is still an immediate child and the layout rule holds unchanged.
`flushSync` on mount, because the elements have to exist before the first paint is asked for.

The loop closes: **state → render → browser paint → GPU texture.**

| interaction  | React                       | static HTML (before) |
| ------------ | --------------------------- | -------------------- |
| hover        | 2.70 ms (1 event → 1 layer) | 1.90 ms              |
| click        | 5.40 ms (1 → 1)             | 4.10 ms              |
| typing burst | **9.90 ms (31 → 1)**        | 5.10 ms              |

React roughly doubles the coalesced cost and stays comfortably inside a frame. The typed text and
the character count both appear on the canvas, and the count is the tell — it is rendered from
state, so a controlled input echoing keystrokes could not produce it.

### The compositor dispatches events; it does not set state

The click handler resolves which element the pointer landed on and then dispatches a **real**
`MouseEvent`, which bubbles to React's delegated listener on the root container exactly as a click
on an ordinary page would. The component's own handler runs and the component decides what happens.

This is the boundary the whole architecture rests on. Synthesising the state change instead would
have made the compositor a second authority over window content, and every window in the app would
then have to be written expecting one. As it stands, `Note` does not know it is being captured —
which is the only version of this that survives contact with a real codebase.

Focus works the same way: the compositor calls `focus()` and stops. Keystrokes, selection and IME
reach the field through the platform's own channels with nothing of ours in the path.

### Why the layout host stays one canvas

Earlier notes in this file claimed the direct-child rule forces **one canvas per window**. It does
not, and the interaction work is what makes the difference concrete: every window is a sibling child
of a single `layoutsubtree` canvas, each copying into its own texture-array layer, and each
answering `getBoundingClientRect` in the same coordinate space. One canvas, one paint, N layers, one
hit-test space.

## What is still not settled

- **Culling.** Not implemented. The GPU processes all N instances every frame, including those far
  offscreen — so the geometry numbers are a conservative worst case, but no real compositor would do
  this.
- **Selection and IME.** Typing and the caret are measured working; dragging a selection across
  captured text, and composing with an IME, are not. Selection in particular needs pointer _drag_
  routed into the field, which the hit-test can do but does not yet.
- **Transform synchronisation.** Captured windows are drawn at the compositor's transform, not the
  browser's. Nothing here checks what the browser believes a captured element's on-screen box is,
  which matters for accessibility and for anything the engine positions itself.
- **React.** Every window here is static HTML cloned N times. Rendering real components into the
  layout host is the next step, and is not proven.
