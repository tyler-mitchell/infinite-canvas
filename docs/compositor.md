# Compositor

Status: contract proposed, nothing built (2026-08-26). Proved in an isolated
proof of concept before any framework code changes — see "This is proved in
isolation first".

## What this replaces, and what it is called

The framework currently paints scene content through
`InfiniteCanvasWebGpuSurface`, which is built on `three` and `@react-three/fiber`.
Replacing it is often described as "replacing R3F with TypeGPU". That phrasing
skips the layer that actually has to be designed, because R3F is two things
stacked and TypeGPU is neither of them:

| Thing                      | What it is                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `three`                    | A **renderer** — scene graph, camera, materials, draw calls. Its own word for itself.          |
| `@react-three/fiber`       | A **React reconciler** — a "React renderer" in React's vocabulary, peer of `react-dom`.        |
| The role they jointly play | The **render backend** behind the `InfiniteCanvasSceneSurface` seam.                           |
| TypeGPU                    | A **GPU abstraction layer** — typed WebGPU. It sits where WebGPU sits, not where `three` sits. |

So TypeGPU does not replace R3F. It is the substrate a replacement is built on,
and the replacement is a **compositor**: it takes surfaces and geometry and
composes them into one frame through an ordered set of **passes**, organised as
a **render graph**. That is the browser's own vocabulary for this exact problem —
layer trees, textured quads, compositing — and it is the correct one here because
the workload is not 3D. It is textured quads, full-screen passes, and effects.

This matters more, not less, as HTML-in-canvas becomes the direction. When a
window's pixels are a texture captured from HTML, "the scene" stops being a scene
graph and becomes a composite: a background pass, a set of quads, connector
geometry, and post effects. A scene graph contributes nothing to that, which is
precisely the part of `three` being paid for today.

## The gap, precisely

`InfiniteCanvasSceneSurface` is described in its own source as "the contract
between the viewport and **whatever** paints scene layers", and its inputs live up
to that. `InfiniteCanvasSceneLayerRenderContext` is entirely engine-free: camera,
viewport, chrome, device pixel ratio, theme, the visible world and screen rects,
and window proxies carrying both world and screen geometry. None of it mentions
`three`. It can be kept wholesale.

The output does not:

```ts
type InfiniteCanvasSceneLayer = Readonly<{
  render: (context: InfiniteCanvasSceneLayerRenderContext) => ReactNode;
  // …
}>;
```

`ReactNode` is engine-neutral as a type and engine-bound in fact: the only nodes
that mean anything here are R3F's (`<mesh>`, `<planeGeometry>`), and the only
thing that can interpret them is R3F. **A layer cannot express what it draws
except as R3F JSX.** That single return type is the whole coupling, and it is the
only part of the seam that has to change.

Two facts make the change cheaper than it looks:

- **The scene layer is already WebGPU-only.** `WebGpuGuard` throws when
  `webGPUSupported === false`. There is no WebGL fallback to preserve, so the
  usual objection to TypeGPU does not apply here.
- **The camera and geometry are already pure.** `worldPointToScreenPoint`,
  `getVisibleWorldRect`, `isWorldRectWithinViewport`, and the window proxies are
  framework code with no renderer in them. A compositor inherits them.

### A fork that was considered and is closed

`@typegpu/three` compiles TypeGPU functions to TSL nodes inside Three.js
materials — keep `three`, keep R3F, still write shaders in TypeScript. It was a
real alternative while the workload was unproven.

It is closed now. The proof of concept measured the thing it hung on: the scene
graph contributes nothing, and native html-in-canvas writes DOM **straight into a
TypeGPU texture array** with `copyElementImageToTexture`. Routing that through
three's material system would add a layer to get back to where the direct path
already is. The decision is TypeGPU plus html-in-canvas, and this fork is
recorded as considered rather than left open.

## The contract

A layer stops returning nodes and starts **declaring draw work**. The unit is a
pass; the graph orders passes and owns the resources they share.

### Pass

A pass declares what it reads, what it writes, and what it needs. It never
acquires its own device, canvas, or texture — the graph supplies them, which is
what makes ordering and resource lifetime knowable ahead of execution rather than
discovered during it.

```ts
type CompositorPass = Readonly<{
  id: string;
  /** Named resources this pass samples. The graph orders producers before consumers. */
  reads?: readonly string[];
  /** Named resources this pass renders into. */
  writes: readonly string[];
  /** Where in the frame this sits, relative to the window plane. */
  placement: "overlay" | "underlay";
  /** Whether geometry is expressed in world units or screen pixels. */
  space: "screen" | "world";
  /** Built once against the device; the returned function runs per frame. */
  build: (context: CompositorBuildContext) => CompositorDraw;
}>;

type CompositorDraw = (context: InfiniteCanvasSceneLayerRenderContext) => void;
```

`build` separates one-time cost from per-frame cost — pipelines, layouts, and
buffers are created once, and the returned closure only writes uniforms and
records draws. The current seam has no such split, which is why a scene layer
today re-runs React reconciliation on every camera tick.

### Resource

Textures and buffers are declared, not allocated by whoever happens to need them
first. The graph owns their lifetime and their size relative to the viewport.

**This is the half that matters, and the proof of concept is why.** Geometry was
never going to be the constraint — 100 000 quads draw in 0.9 ms in a single
instanced call. Texture residency binds three orders of magnitude earlier: 256
windows at 512² is 256 MB and 131 ms of upload, and `maxTextureArrayLayers` is
**256**, so a single array cannot even hold a canvas's worth. An 8192² atlas holds
about 341 windows at readable resolution.

So the resource contract has to carry residency, not just size: which windows
have textures right now, at what scale, and what gets evicted when the budget is
gone. That is what a browser compositor does with tiles. Pass ordering was the
easy part to write down; this is the part that decides whether it works.

### Where the pixels come from

A window's texture is captured HTML, and the capture path is not a detail the
resource contract can stay neutral about — it is the most expensive thing in the
frame by two orders of magnitude.

Measured: **16 ms per window** through the fallback (`snapdom` — a DOM walk,
style inlining, and SVG foreign-object rasterisation), against ~0.7 ms to upload
and effectively zero to draw. One re-capture costs a whole frame at 60 Hz.

The [WICG html-in-canvas proposal](https://github.com/WICG/html-in-canvas)
replaces that path rather than speeding it up:

| primitive                            | what it gives the compositor                        |
| ------------------------------------ | --------------------------------------------------- |
| `layoutsubtree` + `drawElementImage` | browser paints its own layout into a canvas         |
| `paint` event / `requestPaint`       | **browser-driven invalidation** — `changedElements` |
| `copyElementImageToTexture` (WebGPU) | **DOM straight into a GPU texture, no canvas hop**  |
| `captureElementImage`                | a snapshot handle rather than a live surface        |
| transform synchronization            | source DOM stays hit-testable and accessible        |

Two of those change the design rather than its performance:

- **`copyElementImageToTexture` is the path this compositor wants.** The
  canvas-as-`CanvasTexture` route forces one canvas per window, which is
  incompatible with an array or atlas; a direct copy into a layer is not. Every
  window can be a sibling child of one canvas — verified with 64 of them — so the
  immediate-child rule costs nothing structurally.
- **Transform synchronization is what keeps windows real.** The source DOM stays
  the authority for layout, focus, and accessibility while its pixels live on the
  GPU. For a workbench — where windows are edited, not decorative — that is the
  difference between a compositor and a screenshot gallery. The window being
  edited stays live DOM; capture is for the ones nobody is touching.

**All of these now measured, in a Chrome 151 that has them.** DOM written straight
into a TypeGPU texture array layer, one instanced draw over the lot:

| path                                       | per window  | upload   |
| ------------------------------------------ | ----------- | -------- |
| snapdom fallback                           | 16.0 ms     | +0.7 ms  |
| native `copyElementImageToTexture` → layer | **4.06 ms** | **none** |

Four times faster, and the upload step disappears entirely.

Hosting every window as a sibling in **one** canvas and taking a single paint
changes the shape again, and yields the real cost model:

```
paint round trip   ~3.0 ms   fixed, per paint — not per window
rasterisation      ~0.7 ms   marginal, per window actually repainted
transfer            0        copyElementImageToTexture — no upload step
```

Measured: 64 windows in one paint cost 45 ms total, 0.70 ms each; one changed
window costs 3.70 ms. **The 4.06 ms above was mostly a fixed round trip paid 64
times over**, not rasterisation.

So capture is a **batching** problem rather than a per-window one, and the curve
gives the scheduler its budget directly:

| dirty windows | one coalesced paint | fits a 60 Hz frame? |
| ------------- | ------------------- | ------------------- |
| 1             | 3.70 ms             | yes                 |
| 5             | 9.00 ms             | yes                 |
| 20            | 11.20 ms            | yes                 |
| 64            | 32.30 ms            | no — about two      |

**Roughly twenty windows re-capture inside a single frame.** Past about thirty
the work must spread across frames — which is what makes capture a scheduler
rather than a policy, and it is the one component the compositor has to own that
a renderer would not.

`changedElements` reported the dirty count exactly at every point on that curve
(1, 5, 20, 64), so the engine already keeps the dirty set and the compositor must
not keep a second one. A window that merely _moved_ never enters this path at
all.

Two constraints the API imposes, both structural:

- The element must be an **immediate child of a `layoutsubtree` canvas** — but
  that is a layout requirement, not a texture one. One canvas hosts every
  window's subtree, each copying into its own array layer. It does **not** force
  a canvas per window; only the `CanvasTexture` route does that.
- That canvas needs a rendering context even though nothing draws into it, or the
  copy refuses. It is a layout host that still has to be a canvas.

```ts
type CompositorResource = Readonly<{
  id: string;
  kind: "texture" | "buffer";
  /** Fraction of the viewport, so a pass can render at reduced cost deliberately. */
  scale?: number;
  format?: GPUTextureFormat;
}>;
```

`scale` is in the contract rather than left to each pass because it is a
correctness concern, not an optimisation: the field's cost turned out to be
entirely per-pixel, and the difference between one device pixel per CSS pixel and
the display's native ratio was fourfold. A pass that decides this privately is a
pass whose cost nobody can see.

### Frame gating

The graph decides whether to execute at all. A canvas at rest must cost nothing,
and that cannot be each pass's private business — one pass animating forever
defeats every other pass's restraint.

```ts
type CompositorDraw = (context: InfiniteCanvasSceneLayerRenderContext) => void;
/** Passes report whether anything they own has changed since the last frame. */
type CompositorInvalidation = () => boolean;
```

This is load-bearing and was learned the hard way in `apps/polkadot`: a
time-driven shimmer meant the field repainted the viewport forever, so reading a
note cost exactly as much as dragging a window. The gate has to be **change**,
not presence — an "is the pointer over the canvas" flag latches true on first
move and never idles.

## This is proved in isolation first

**No framework changes until a standalone proof of concept answers the
load-bearing question**, which is not "can TypeGPU draw" — the spike already
showed it can — but _is the workload really quads and passes?_ If window proxies
at real counts, with real HTML-derived textures, need something a scene graph
provides, that is discovered in a throwaway, not halfway through replacing a
surface the framework ships.

The proof of concept lives outside `packages/infinite-canvas` and imports
nothing from it. It is allowed to be ugly, hard-coded, and deleted. What it owes
is one honest answer and one number: frames at a window count that matters.

Only two things carry over from it: the pass and graph contracts, if they
survived contact, and the measurement.

## Structure, once it graduates

Where this lands **if** the proof of concept earns it — not a directory to create
now:

```
packages/infinite-canvas/src/compositor/
  graph.ts        the render graph: ordering, resource lifetime, frame gating
  pass.ts         the pass and resource contracts (pure types, no GPU import)
  passes/         the passes the framework ships
  backend/        the only directory that names TypeGPU
```

`pass.ts` importing no GPU library is what preserves the property the current
seam has and must not lose: the viewport can decide _whether_ a compositor is
needed, and lay out around one, without pulling a GPU stack into the module
graph of a consumer that never renders scene content.

`InfiniteCanvasSceneSurface` stays as the seam and keeps its name. Consumers pass
a surface; that a compositor now sits behind it instead of R3F is not their
concern.

## Sequence

Steps 1–3 are the proof of concept and touch no framework code.

1. **The contracts, with no backend.** Pass, resource, and graph ordering are
   testable without a GPU and are the part that outlives whichever backend wins.
2. **One full-screen pass.** The field is the honest first subject: it already
   exists, already runs on TypeGPU, and has no geometry to get wrong.
3. **Window proxies as textured quads, at a window count that hurts.** This is
   the whole question. Either "textured quads and passes" is the entire workload
   or it is not, and this is where that stops being an assertion.
4. **Graduate the contracts into the framework** — only if step 3 said yes.
5. **Frustum culling onto the graph.** Already pure
   (`isWorldRectWithinViewport`); it becomes a graph concern rather than a
   renderer feature.
6. **Delete the R3F surface.** Not before — but not "eventually" either. Two
   backends behind one seam is the coexistence this repo bans elsewhere, and every
   adapter written between them dies in the final state anyway.

## Explicitly out of scope

- **A scene graph.** No transforms hierarchy, no materials system, no lights. If a
  future need genuinely wants those, that need argues for `three`, not for
  growing this into a worse one.
- **A React reconciler.** Passes are declared as data and built once. Nothing here
  needs JSX, and a custom reconciler would reintroduce exactly the per-tick
  reconciliation cost this replaces.
- **WebGL.** The scene layer already refuses to run without WebGPU.

  `@typegpu/gl` does offer an experimental WebGL 2 fallback, but its supported
  surface rules it out for this: no storage buffers, no bind groups, no vertex or
  index buffers, no compute. It targets "shader-driven effects that keep their
  geometry in constants and their changing state in uniforms" — which describes
  the _field_, and does not describe a compositor whose whole design is instanced
  quads reading a buffer. A fallback for the field alone is possible; a fallback
  for the compositor is not, and pretending otherwise would shape the contract
  around a path that cannot run.

## What is unproven

TypeGPU has been validated here only as far as: the field's shader compiles to
correct WGSL and creates a render pipeline against a real device, with zero
compilation messages — **on 0.11**, before the port to 0.12. See
`apps/polkadot/SPIKES.md`.

Nothing about frame cost, quad batching at window counts that matter, or texture
upload from HTML capture has been measured. The sequence above is ordered so that
step 3 answers the load-bearing question — whether quads-and-passes really is the
whole workload — before step 6 removes the alternative.

Frame cost is measurable and should not stay a guess: pipelines expose
`.withPerformanceCallback((start, end) => …)`, giving GPU nanoseconds directly,
provided the device is initialized with the `timestamp-query` feature. The proof
of concept has no excuse for reporting frame times instead.
