# Compositor

Status: proposed contract from 2026-08-26. No framework implementation exists. An isolated proof of concept
measured the design before framework changes.

## Name and scope

`InfiniteCanvasWebGpuSurface` currently uses `three` and `@react-three/fiber`. The proposed backend uses
TypeGPU through a new compositor.
The common description was "replacing R3F with TypeGPU".

The tools have different roles:

| Thing                | Role                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| `three`              | A renderer with a scene graph, camera, materials, and draw calls.          |
| `@react-three/fiber` | A React reconciler, or "React renderer", similar to `react-dom`.           |
| Their combined role  | The render backend behind `InfiniteCanvasSceneSurface`.                    |
| TypeGPU              | A typed WebGPU abstraction.                                                |
| Compositor           | A render graph that combines surfaces and geometry through ordered passes. |

TypeGPU does not replace R3F by itself. The compositor replaces the combined render backend. TypeGPU supplies
typed WebGPU access to that compositor. The target removes `three` from this backend.

The target workload uses textured quads, full-screen passes, connector geometry, and effects. It does not
require a 3D scene graph. The terms render graph, layer tree, textured quad, and compositing match browser
terminology.

HTML capture makes this distinction important. A captured window becomes a texture. At that point, "the scene"
becomes a composite. The frame then contains a background pass, textured quads, connector geometry, and post
effects. A scene graph adds no required
capability to that frame.

## Existing seam

The source calls `InfiniteCanvasSceneSurface` "the contract between the viewport and **whatever** paints scene layers".
Its input type, `InfiniteCanvasSceneLayerRenderContext`, has no engine types.

The context includes these values:

- Camera state
- Viewport state
- Chrome values
- Device pixel ratio
- Theme values
- Visible world and screen rectangles
- Window proxies with world and screen geometry.

The output type creates the engine dependency:

```ts
type InfiniteCanvasSceneLayer = Readonly<{
  render: (context: InfiniteCanvasSceneLayerRenderContext) => ReactNode;
  // …
}>;
```

`ReactNode` is neutral as a TypeScript type. In this seam, only R3F nodes such as `<mesh>` and
`<planeGeometry>` have meaning. Only R3F can interpret those nodes. The render return type is the coupling
that must change.

Two existing facts reduce the change:

- The scene layer already requires WebGPU.
  `WebGpuGuard` throws when `webGPUSupported === false`. There is no WebGL fallback to keep.
- Camera and geometry functions are already pure framework code.
  This includes `worldPointToScreenPoint`, `getVisibleWorldRect`, and `isWorldRectWithinViewport`. Window
  proxies also have no renderer dependency.

## Closed alternative

`@typegpu/three` compiles TypeGPU functions to TSL nodes inside Three.js materials. This option keeps `three`,
R3F, and TypeScript shader functions. It also keeps the `three` material system. It was a valid option before
the workload evidence existed.

The proof of concept wrote native HTML directly into a TypeGPU texture array. It used
`copyElementImageToTexture`. A Three.js material layer adds an extra route to the same texture. The selected
direction is TypeGPU with HTML-in-Canvas.

The @typegpu/three option is closed.

## Pass contract

Status: target.

A layer declares draw work. A pass is the unit of work. The graph orders passes and owns shared resources.

Each pass declares what it reads, what it writes, and what it requires. A pass never acquires its own device,
canvas, or texture. The graph supplies these resources. This design makes order and lifetime known before
execution.

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

`build` separates one-time work from frame work. It creates pipelines, layouts, and buffers once. The returned
function updates uniforms and records draw calls for each frame.

The current seam does not have this split. It uses React reconciliation for a scene layer after each camera change.

## Resource contract

Status: target.

The graph allocates declared textures and buffers. It owns their lifetime and size relative to the viewport.

The proof of concept measured geometry and texture limits:

- One instanced call draws 100,000 quads in 0.9 ms.
- 256 windows with 512-pixel square textures use 256 MB.
- Uploading those textures takes 131 ms.
- `maxTextureArrayLayers` is 256.
- One 8192-pixel square atlas holds approximately 341 readable window textures.

A single texture array cannot hold more than 256 windows. Texture residency reaches its limit before quad
geometry. The contract must identify resident textures, their scale, and the eviction policy. This is the same
tile-residency problem that a browser compositor manages.

The pass order is simple. Residency determines whether the design works at the target scale.

## HTML capture

A window texture comes from captured HTML. Capture costs more than drawing or uploading. The resource contract
must include the capture path.

The `snapdom` fallback took 16 ms for one window. It walks the DOM, writes styles, and rasterizes an SVG
foreign object. The related upload took approximately 0.7 ms. The draw cost was effectively zero.

The [WICG html-in-canvas proposal](https://github.com/WICG/html-in-canvas) provides a different path:

| Primitive                              | Compositor capability                                             |
| -------------------------------------- | ----------------------------------------------------------------- |
| `layoutsubtree` and `drawElementImage` | The browser paints its layout into a canvas.                      |
| `paint` event and `requestPaint`       | `changedElements` supplies browser-owned invalidation.            |
| `copyElementImageToTexture`            | The browser copies DOM directly into a WebGPU texture.            |
| `captureElementImage`                  | The browser supplies a snapshot handle instead of a live surface. |
| Transform synchronization              | The source DOM remains available for hit tests and accessibility. |

`copyElementImageToTexture` matches the compositor resource model. A `CanvasTexture` route requires one canvas
for each window. Each `CanvasTexture` also adds a canvas-to-texture step. That route does not fit a texture
array or atlas.

A direct copy can target one layer of an array.

One canvas can host each window as an immediate sibling child. The proof of concept used 64 sibling windows.
Thus, the immediate-child rule does not require one canvas for each window.

Transform synchronization keeps the source DOM available. The source remains the authority for layout, focus,
hit tests, and accessibility. The pixels can still live on the GPU.

The window under edit stays as live DOM. Capture applies to windows that the user is not editing. This
division supports an interactive workbench instead of a static screenshot view.

Chrome 151 supplied all required primitives. The proof wrote DOM directly into a TypeGPU texture-array layer.
One instanced draw rendered all layers.

The measured paths were:

| path                                       | per window  | upload   |
| ------------------------------------------ | ----------- | -------- |
| snapdom fallback                           | 16.0 ms     | +0.7 ms  |
| native `copyElementImageToTexture` → layer | **4.06 ms** | **none** |

The native path was four times faster. It also removed the upload step.

A shared canvas and one paint changed the cost model:

```
paint round trip   ~3.0 ms   fixed, per paint — not per window
rasterisation      ~0.7 ms   marginal, per window actually repainted
transfer            0        copyElementImageToTexture — no upload step
```

One paint for 64 windows took 45 ms. The marginal cost was 0.70 ms for each window. One changed window took
3.70 ms.

The earlier 4.06 ms result paid the fixed paint round trip 64 times. Most of that result was fixed overhead,
not rasterization.

Capture is a batching problem. The scheduler can use this measured curve:

| dirty windows | one coalesced paint | fits a 60 Hz frame? |
| ------------- | ------------------- | ------------------- |
| 1             | 3.70 ms             | yes                 |
| 5             | 9.00 ms             | yes                 |
| 20            | 11.20 ms            | yes                 |
| 64            | 32.30 ms            | no, about two       |

Approximately 20 captures fit in one 60 Hz frame. More than approximately 30 captures must continue in later
frames. This requirement makes capture scheduling a compositor responsibility.

`changedElements` reported exact dirty counts for 1, 5, 20, and 64 changed windows. The browser already keeps
the dirty set. The compositor must not keep a second dirty set. Moving a window does not request a new
capture.

The API has two structure constraints:

- A captured element must be an immediate child of a `layoutsubtree` canvas.
  This is a layout rule and not a texture rule. One canvas can host all window subtrees. Each subtree can copy
  into a separate array layer.
- The canvas needs a rendering context.
  A copy fails without the context, even when no pass draws into that canvas.

```ts
type CompositorResource = Readonly<{
  id: string;
  kind: "texture" | "buffer";
  /** Fraction of the viewport, so a pass can render at reduced cost deliberately. */
  scale?: number;
  format?: GPUTextureFormat;
}>;
```

`scale` is part of the shared contract. The field cost was proportional to pixel count. One device pixel per
CSS pixel cost one quarter of a native two-times pixel ratio. A private pass scale hides this cost from the
graph.

## Frame gating

Status: target.

The graph decides whether it must draw a frame. An idle canvas must use no frame time. One pass with permanent
animation keeps all passes active.

```ts
type CompositorDraw = (context: InfiniteCanvasSceneLayerRenderContext) => void;
/** Passes report whether anything they own has changed since the last frame. */
type CompositorInvalidation = () => boolean;
```

This requirement comes from `apps/polkadot`. A time-based shimmer kept the field active. Reading a note then
cost the same as dragging a window.

The gate must report a change, not presence. The old label was "is the pointer over the canvas". A
pointer-presence flag stays true after the first pointer movement. That flag does not permit the compositor to
return to idle.

## Isolated proof of concept

The contract required proof before framework changes. The source called this step "This is proved in isolation
first". The first question was "can TypeGPU draw". TypeGPU draw ability was already known. The main question
was whether "textured quads and passes" described the complete workload.

The proof used representative window proxies and HTML textures. It measured a window count that affects frame
cost. The proof must expose any scene-graph requirement before backend replacement.

The proof lived outside `packages/infinite-canvas`. It imported no framework code. Temporary code was
hard-coded and disposable.

The proof had two required outputs:

- One answer about the complete workload
- One frame measurement at a representative window count.

Only two kinds of artifact can move into the framework:

- Pass and graph contracts that survived the proof
- Measurements from the proof.

## Target module structure

Status: target. The directories do not exist as a result of this document.

```
packages/infinite-canvas/src/compositor/
  graph.ts        the render graph: ordering, resource lifetime, frame gating
  pass.ts         the pass and resource contracts (pure types, no GPU import)
  passes/         the passes the framework ships
  backend/        the only directory that names TypeGPU
```

`pass.ts` must not import a GPU library. The viewport can then decide whether it needs a compositor without
importing the GPU stack.

`InfiniteCanvasSceneSurface` keeps its name and remains the seam. Consumers supply a surface. The backend
behind that surface is not part of the consumer contract.

## Sequence

Steps 1 through 3 belong to the proof of concept. They do not change framework code.

1. Define and test pass, resource, and graph-order contracts without a backend.
2. Add one full-screen field pass.
3. Add textured window proxies at a representative window count.
4. Move the contracts into the framework only after step 3 supports the design.
5. Move frustum culling into the graph with `isWorldRectWithinViewport`.
6. Remove the R3F surface after the compositor replaces its required behavior.

Removal cannot wait until "eventually". The project must not keep two permanent backends behind the same seam. Adapters between temporary backends do
not belong in the final state.

## Outside scope

### Scene graph

The compositor has no transform hierarchy, material system, or lights. A future requirement for these features
supports `three`. Such a requirement belongs in `three` instead of this compositor. It does not support adding
a smaller scene graph to the compositor.

### React reconciler

Passes are data that the graph builds once. The compositor does not require JSX. A custom reconciler restores
the frame reconciliation cost that this design removes.

### WebGL

The current scene layer already requires WebGPU. The compositor does not add a WebGL backend.

`@typegpu/gl` has an experimental WebGL 2 fallback. Read on 2026-09-08 from its package page: it supports
vertex and fragment pipelines, constants, scalar, vector, and matrix uniforms, non-indexed triangle draws,
and 2D textures in six formats. It does not support vertex buffers, index buffers, bind groups, readonly or
mutable buffers, compute, or layered, depth, storage, and comparison textures. It requires `OffscreenCanvas`
and a `bitmaprenderer` context, and draws through an internal `OffscreenCanvas` transfer.

The backend source, read on 2026-09-08 from `packages/typegpu-gl/src/tgpuRootWebGL.ts` in the TypeGPU
repository, adds three facts that the feature table does not state:

- `draw()` ignores `instanceCount` and calls `gl.drawArrays`. The backend has no instancing.
- Uniform upload handles only `f32`, `u32`, `i32`, `vec2f` to `vec4f`, and `mat2x2f` to `mat4x4f`. Any
  other schema, including an array or a struct, gets a no-op setter. The shader compiles and reads zeros.
  Issue #2510 tracks uniform blocks. Its tests are skipped.
- `root.with(slot, value)` is a no-op marked `TODO(#2818)`.

A compositor fallback is not possible with this backend. Instanced quads read a storage buffer, sample a
texture array, and draw with an instance count. All three are absent. `copyElementImageToTexture` needs the
raw `GPUQueue`, and `root.device` throws on this root.

A field-only fallback is also out as of TypeGPU 0.12. The field binds a uniform array of structs, which
this backend accepts and then never uploads. If upstream ships #2510 and #2818, a field-only WebGL 2 path
becomes possible through `isGLRoot` and a uniform block. Until then, keeping a second field for WebGL 2
creates the two-implementation drift that `apps/polkadot/SPIKES.md` records as the reason to have one field.
The DOM plane already runs without a GPU, and that is the fallback for every other engine.

## Shared render pass

Status: available since TypeGPU 0.12. Read on 2026-09-08 from the 0.12 release notes.

The proof measured a material pass with zero instances at approximately the cost of a pass with twelve. The
fixed cost was the render pass, not the draw. TypeGPU 0.12 added typed command encoders and render passes so
several pipelines record into one command buffer, with `setPipeline` and `setBindGroup` on the pass. The graph
must record the window pass and every material pass into one render pass. Per-material passes are the wrong
shape.

The same release added `initAsync` for pipeline compilation before the first frame. The current R3F surface
approximates this with seven boot invalidation timers. The compositor must use `initAsync` and no timers.

## Evidence limits

Before the proof of concept, TypeGPU evidence covered only the field shader. The shader compiled to correct
WGSL. A real device created the pipeline without compilation messages. That result used TypeGPU 0.11.

It occurred before the port to TypeGPU 0.12. See `apps/polkadot/SPIKES.md`.

At that time, the project had no frame-cost, quad-batching, or HTML-upload measurements. The proof sequence
placed that evidence before removal of the existing surface.

Frame cost must use GPU timestamps. Pipelines expose `.withPerformanceCallback((start, end) => …)`. This
callback returns GPU nanoseconds. The device must enable the `timestamp-query` feature.

The proof must not report CPU frame time as GPU time.
