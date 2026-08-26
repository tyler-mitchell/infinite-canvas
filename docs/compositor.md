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

## What is unproven

TypeGPU has been validated here only as far as: the field's shader compiles to
correct WGSL and creates a render pipeline against a real device, with zero
compilation messages. See `apps/polkadot/SPIKES.md`.

Nothing about frame cost, quad batching at window counts that matter, or texture
upload from HTML capture has been measured. The sequence above is ordered so that
step 3 answers the load-bearing question — whether quads-and-passes really is the
whole workload — before step 5 removes the alternative.
