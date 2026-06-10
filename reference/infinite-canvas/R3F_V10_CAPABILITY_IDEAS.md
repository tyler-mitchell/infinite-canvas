# R3F v10 Capability Ideation Ledger

This is the living collection point for React Three Fiber v10 ideas that may
improve the infinite canvas framework. It is intentionally separate from
`FEATURE_TRACKER.md`: this file records source-led capability analysis, while
the tracker should only promote items that are ready for framework sequencing.

## Source Pass

Primary sources read from the local React Three Fiber plugin:

- `/Users/tylermitchell/.codex/plugins/cache/local-personal/react-three-fiber/0.1.0/references/v10-features.md`
- `/Users/tylermitchell/.codex/plugins/cache/local-personal/react-three-fiber/0.1.0/references/v10-migration.md`
- `/Users/tylermitchell/.codex/plugins/cache/local-personal/react-three-fiber/0.1.0/skills/r3f-fundamentals/SKILL.md`
- `/Users/tylermitchell/.codex/plugins/cache/local-personal/react-three-fiber/0.1.0/skills/r3f-interaction/SKILL.md`
- Upstream spot check:
  <https://github.com/pmndrs/react-three-fiber/blob/v10/docs/v10-features.md>

The v10 docs describe the release as alpha. Treat this ledger as a planning
surface, not an implementation contract. Before adopting any item, verify the
installed package behavior and the current upstream API.

Current lockfile snapshot:

- `@react-three/fiber` resolves to `10.0.0-canary.1b98c17`.
- `@legendapp/state` resolves to `3.0.0-beta.46`.
- `@zumer/snapdom` resolves to `2.9.0`.

The source docs and the installed canary are close enough to justify labs, but
not enough to skip focused API proof tests before production adoption.

Installed API-surface probe:

- the WebGPU type surface includes `onFramed`, `onVisible`,
  `autoUpdateFrustum`, and visibility-event registry types
- it includes canvas-level `onDragOverMissed` and `onDropMissed`
- it includes `frameTimedRaycasts`, `primaryCanvas`, `Portal`/`createPortal`,
  and `useRenderTarget`
- `userData.interactivePriority` is documented in the local v10 feature notes,
  but should still receive a focused runtime proof before depending on it

## Current Framework Baseline

The current infinite canvas keeps the important seam explicit:

- `InfiniteCanvasWebGpuSurface` uses `@react-three/fiber/webgpu`.
- WebGPU owns the programmable spatial surface.
- The CSS grid backdrop and arbitrary React window bodies remain DOM layers.
- Built-in frame chrome is host-local: the visual frame and DOM body share the
  same transformed window host. R3F scene layers are for background content,
  diagnostics, drop affordances, and decorative effects, not the core window
  frame implementation.
- Pointer/window interactions are currently DOM-driven and reducer-backed.
- Frustum diagnostics exist through `visibility-probes.tsx`, which manually
  updates the R3F frustum and writes framed-state into a Legend State store.
- The R3F canvas runs with `frameloop="demand"`, so frame-timed R3F event
  optimizations do not apply unless we move to an always-running loop or
  explicitly invalidate.

That baseline matters because many v10 features are strongest for scene-native
objects, while this framework still intentionally uses DOM windows.

## Second-Pass Design Lens

The best framework shape is not "move more things into R3F." It is "make one
clean scene-native adapter for the parts of the DOM world that benefit from
R3F." That keeps the window body seam intact while giving WebGPU enough
structured geometry to help with visibility, diagnostics, overview rendering,
and future interaction tools.

The recurring adapter should be a **window proxy spine**:

- canonical window state stays in Legend State and reducer-owned data
- DOM remains responsible for arbitrary React window bodies
- R3F receives a compact, derived proxy model: id, rect, mode, stack band,
  selection state, and optional semantic tags
- scene-native features consume the proxy model instead of reading DOM layout
- each R3F experiment must either use the proxy spine or justify why it needs a
  separate mirror

This spine is the main way to avoid framework leakage. Rasterization,
visibility, minimaps, shader overlays, and scene-native handles should not each
build their own geometry registry.

The framework may be used by game-like products, but it should not become a
game framework. Inventory drops, isometric spaces, shader effects, and animated
scene affordances are examples of general spatial-editor capabilities. Public
framework language should stay neutral:

- scene layer, not game layer
- external drag payload, not inventory item
- drop affordance, not loot target
- window decoration or frame renderer, not equipment shell
- proxy field, not unit/entity system unless a consumer builds one above the
  framework

This keeps the framework suitable for knowledge tools, editors, dashboards,
world maps, simulations, and game-like applications without baking in a single
domain model.

## High-Value Candidates

| Candidate                                    | Status        | Why It Matters                                                                                                                                               | First Responsible Slice                                                                                                |
| -------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Window proxy spine                           | top candidate | A single scene-native mirror can support visibility, overview, GPU overlays, and future hit-test islands without leaking R3F assumptions into window bodies. | Define a derived `WindowProxy` model and render invisible or debug planes from it behind diagnostics.                  |
| General-purpose scene extension slots        | top candidate | Consumers need to render custom 3D content, drop affordances, decorations, and diagnostics without bypassing the framework model.                            | Define read-only scene-layer slots backed by proxy/camera/projection context, with commands as the only mutation path. |
| Scheduler phases for GPU diagnostics         | candidate     | v10 makes frame work explicit and ordered. Frustum probes, GPU overlays, and future shader effects should not drift into anonymous default `useFrame` work.  | Move diagnostics/probes into named scheduler phases and consider throttling debug-only work with `fps`.                |
| Frustum/visibility events via scene proxies  | candidate     | `onFramed`/`onVisible` could replace some manual visibility bookkeeping, but DOM windows are not R3F objects.                                                | Prototype proxy meshes through the window proxy spine and compare event churn against the current manual probe.        |
| Predictive raster budgeter                   | candidate     | Raster performance depends on which windows are likely to matter soon, not just which windows are inactive right now.                                        | Feed frustum state, camera velocity, and interaction pause state into one raster budget policy.                        |
| Scene overlay compositor                     | candidate     | Selection bounds, snap guides, marquee, and future polish effects can become one GPU overlay lane instead of scattered DOM overlays.                         | Prototype one shader/instanced line layer from derived overlay primitives; keep DOM overlays until it proves better.   |
| Scene-native interaction islands             | watch         | v10 event priorities and per-pointer state are useful if transform handles or GPU controls become scene objects.                                             | Keep the main canvas DOM-driven, but design a gated pointer-event mode for explicit R3F tools.                         |
| External drag/drop bridge                    | candidate     | Overlay-to-canvas drags need a framework-owned payload and projection seam before R3F dropzones can be useful.                                               | Add generic external drag state/actions, then render optional scene-native drop affordances from that state.           |
| Custom frame renderers and scene decorations | top candidate | Consumers need custom window chrome, title bars, handles, shader halos, 3D shells, or stateful effects while preserving DOM body interactivity.              | Add a DOM `renderFrame` slot first; later connect R3F decorations through the same window proxy and command context.   |
| Multi-canvas HUD/minimap lab                 | candidate     | Shared WebGPU renderer across multiple canvases could support minimaps, overview lenses, or detached GPU HUDs without another GPU context.                   | Create a lab route with primary canvas plus secondary overview canvas before touching the main route.                  |
| Camera-attached scene HUD                    | candidate     | v10 camera parenting and `Portal` make GPU overlays that follow the camera cleaner.                                                                          | Try camera-attached reticles/debug overlays only; keep DOM controls as the canonical app UI.                           |
| Camera navigation director                   | candidate     | Current camera navigation is reducer-clean, but future animated navigation, presentation mode, and "focus trail" tools need a consistent temporal layer.     | Keep navigation requests semantic; add optional animation outside the reducer if a lab proves the feel.                |
| Canvas size control for capture/export       | candidate     | Explicit `width`/`height` and `setSize` could support deterministic screenshots, video export, or benchmark capture.                                         | Add a controlled export/lab path, not a runtime default.                                                               |
| `useRenderTarget` for GPU previews           | candidate     | Renderer-compatible render targets could support minimap textures, portal previews, or scene-level snapshot experiments.                                     | Use only for WebGPU scene content; do not confuse it with DOM rasterization.                                           |

## Capability Architecture

### Derived Proxy Spine

The framework should introduce a deliberate adapter between the pure window
model and any scene-native representation. The adapter should be derived,
read-only, and disposable:

```ts
type InfiniteCanvasWindowProxy = Readonly<{
  id: string;
  rect: InfiniteCanvasRect;
  isActive: boolean;
  isFramed?: boolean;
  isPinned: boolean;
  isSelected: boolean;
  mode: InfiniteCanvasWindowMode;
  stackBand: "normal" | "pinned" | "overlay";
  zIndex: number;
}>;
```

That shape is not a proposed public API yet. It is the minimum useful idea:
R3F should see what it needs to draw, cull, or debug, without reaching into
window renderers or body DOM nodes.

Candidate consumers:

- frustum probes
- minimap/overview canvases
- WebGPU snap and selection overlays
- visibility-aware raster priority
- future transform handles
- spatial debugging and performance HUDs

Promotion test:

- If deleting the proxy layer would require touching three or more features,
  it is useful enough to exist.
- If a feature needs body DOM details, it probably belongs in the DOM/raster
  seam rather than the R3F seam.

### Frame Work As Named Lanes

R3F v10 scheduler phases suggest a durable naming model for frame work. Instead
of anonymous callbacks, future R3F work should be classified into lanes:

| Lane         | Intended Work                                               | Runtime Bias                                |
| ------------ | ----------------------------------------------------------- | ------------------------------------------- |
| `input`      | scene-native pointer refresh, event flushing, future gizmos | only if R3F interaction is enabled          |
| `camera`     | orthographic camera bridge, optional animated navigation    | every invalidated camera frame              |
| `visibility` | frustum/proxy evaluation and diagnostics                    | throttled unless needed for runtime culling |
| `overlay`    | GPU marquee, snap guides, selection outlines                | demand-driven from interaction state        |
| `preview`    | minimap/render-target updates                               | low fps or explicit invalidation            |
| `render`     | only explicit render takeover work                          | avoid unless there is a measured need       |

The current framework can keep `frameloop="demand"`, but the lane names give us
a contract before the amount of R3F work grows. If a lane requires an always-on
loop, that requirement should be visible in the policy that enables it.

### DOM, Raster, And WebGPU Boundaries

Use this rule of thumb when deciding where a feature belongs:

- DOM: arbitrary React bodies, text selection, form controls, accessible HUD
  controls, scrollable content.
- SnapDOM raster: performance substitution for inactive DOM bodies.
- WebGPU scene: geometry, guides, effects, minimap proxies, scene-native
  handles, and visual layers that benefit from shaders or instancing.
- Legend State: canonical world model, command routing, selection, camera,
  interaction state, and policies.

The most likely mistake is building an R3F feature that secretly needs DOM body
truth. That should be a design smell.

### General-Purpose Scene Extension Contract

The framework needs an extension seam for consumer-owned scene content, but the
seam should be narrow and read-only by default. A durable shape is a set of
named scene-layer slots that receive framework context and dispatch framework
commands:

```tsx
<InfiniteCanvas.Desktop
  sceneLayers={{
    background: (context) => <ConsumerWorld context={context} />,
    decorations: (context) => <WindowEffects context={context} />,
    interaction: (context) => <DropAffordances context={context} />,
  }}
/>
```

Potential context fields:

- `camera`: read-only camera state and navigation helpers
- `viewport`: viewport size, zoom policy, and projection helpers
- `windows`: derived window proxies, not DOM nodes
- `selection`: selected ids and derived selection bounds
- `interaction`: current framework interaction mode and external drag state
- `commands`: canonical framework actions, not mutable store access

The first implementation should not expose every R3F escape hatch. It should
answer one question: can an app render custom 3D or shader-backed content in
the WebGPU scene while the framework still owns camera, selection, commands,
and DOM body projection?

Suggested layer order:

| Layer         | Purpose                                                    |
| ------------- | ---------------------------------------------------------- |
| `background`  | consumer world geometry behind windows                     |
| `proxy`       | framework-owned invisible/debug window proxy geometry      |
| `decorations` | consumer or framework effects attached to window proxies   |
| `interaction` | opt-in scene-native handles, dropzones, and gizmos         |
| `diagnostics` | debug overlays, profiler fields, frustum/visibility probes |

The current WebGPU canvas uses `pointer-events: none` and `frameloop="demand"`.
Any layer that needs R3F events or continuous animation must request that
policy explicitly. That prevents a decorative scene layer from quietly changing
the whole editor's input model or frame budget.

### External Drag And Drop Bridge

R3F v10 scene drag/drop is useful, but it is not the whole answer. A real app
may start a drag in a DOM overlay, command palette, asset browser, or external
file manager. The framework should model that as generic external drag state:

```ts
type InfiniteCanvasExternalDrag = Readonly<{
  id: string;
  phase: "idle" | "dragging" | "dropping" | "cancelled";
  payloadType: string;
  payload: unknown;
  clientPoint: InfiniteCanvasPoint;
  worldPoint: InfiniteCanvasPoint | null;
  allowedEffects: ReadonlyArray<"copy" | "move" | "link">;
  sourceId?: string;
}>;
```

The payload is intentionally opaque. Consumers can validate it at their app
boundary, while the framework only cares about projection, hit testing,
drop-effect negotiation, and command dispatch.

Potential flow:

1. A DOM overlay calls `externalDrag.start(...)` with a typed consumer payload.
2. The framework tracks client and world points with existing projection
   helpers.
3. A scene `interaction` layer renders R3F drop affordances when the drag is
   active.
4. R3F `onDragOver`/`onDrop` can handle scene-native targets; canvas-level
   missed callbacks can route empty-canvas drops.
5. The final drop emits one canonical command such as `canvas.dropExternal`.

This keeps inventory-like workflows possible without teaching the framework
what an inventory item is.

### Custom Window Frames And Scene Decorations

There are two different extension needs that should not be collapsed:

- a DOM frame renderer for hit targets, accessibility, title bars, buttons, and
  body mounting
- a WebGPU decoration renderer for shader halos, isometric shells, animated
  outlines, drop shadows, and other visual effects around a window proxy

The DOM frame remains responsible for interaction semantics and body placement.
The WebGPU decoration layer remains visual unless it explicitly enters the
scene-native interaction lane. Both should consume the same derived window
proxy and dispatch the same commands.

Custom frames should be a first-class framework primitive. They should not force
consumers to reimplement focus, move, resize, pinning, minimize, close, active
state, selection state, raster gates, or body projection. The framework should
provide a frame context that composes those behaviors:

```ts
type InfiniteCanvasFrameContext<Kind extends string> = Readonly<{
  actions: InfiniteCanvasCommands<Kind>;
  body: React.ReactNode;
  chrome: InfiniteCanvasChromeMetrics;
  isActive: boolean;
  isPinned: boolean;
  isSelected: boolean;
  window: InfiniteCanvasWindow<Kind>;
}>;
```

Future API sketch:

```tsx
<InfiniteCanvas.WindowDefinition
  id="inspector"
  renderBody={InspectorBody}
  renderFrame={InspectorFrame}
  renderDecorations={InspectorSceneDecorations}
/>
```

The framework can start smaller: expose `renderFrame` for DOM chrome and a
route-level `decorations` scene layer. Later, if the pattern holds, window
definitions can provide per-window decoration renderers.

Promotion criteria:

- the built-in frame is implemented as the default `renderFrame`
- custom frames receive canonical move/focus/resize/titlebar affordance helpers
  instead of duplicating private pointer code
- body rendering remains framework-mounted so rasterization, text-selection
  policy, and wheel policy still work
- decorations are optional and visual unless they explicitly opt into the
  scene-native interaction lane

### Scene Extension Status

This list began as a gap inventory before the first scene-extension slice. It
now tracks what remains after host-local chrome, custom DOM frames, scene-layer
slots, and window proxies landed.

- public scene-layer slots exist for world/screen underlay and overlay content
- derived window proxies are available to scene-layer renderers through
  `context.windows` and `context.getWindowProxy`
- projection context is available through camera, viewport, and proxy screen
  fields
- no external drag state or command boundary
- no event-mode policy for temporarily enabling R3F pointer events
- no z/layer contract for background, proxy, decorations, interaction, and
  diagnostics
- consumer-provided DOM frame renderers exist through `renderFrame`
- no clear fallback policy when WebGPU is unavailable
- the public barrel still exposes low-level composition pieces such as the
  WebGPU surface and window layer, so consumers can currently reach below the
  intended `Desktop` boundary
- no devtool that proves scene layers, proxy objects, and drop targets are
  registered and within budget

## Near-Term Reading Conclusions

### Scheduler

v10 replaces old priority-number thinking with named phases and optional frame
rate limits. This is relevant to the framework because we already have different
kinds of frame work:

- camera synchronization
- frustum diagnostics
- raster scheduling gates
- future shader-backed marquee or alignment overlays
- future minimap or overview rendering

The current code has little `useFrame` surface, which is good. The existing
`InfiniteCanvasWindowFrustumProbeLayer` is the first candidate to make more
explicit, because it is diagnostics work and does not need to become an
unstructured per-frame tax.

Open questions before implementation:

- Does `useFrame(..., { fps })` work as expected in our installed v10 build?
- Does named-phase scheduling run under `frameloop="demand"` in the way we need
  for diagnostics, or do we need explicit invalidation?
- Should frustum diagnostics be debug-only forever, or should visibility become
  part of the rasterization/culling runtime?

### Frustum And Visibility

v10 exposes a synchronized `frustum` and adds visibility events:

- `onFramed` for camera-frustum entry/exit
- `onOccluded` for WebGPU occlusion-query changes
- `onVisible` for combined visible state

This maps conceptually to our current frustum diagnostics, but not directly.
The framework windows are DOM elements, not scene objects, so visibility events
would require R3F proxy objects that mirror each window rect. That could be
worth it if it reduces manual per-window checks, but it adds another mirror
surface that must stay aligned with the canonical window model.

Potential first slice:

1. Add an experimental `WindowVisibilityProxyLayer` behind diagnostics.
2. Render one invisible plane or box per visible window.
3. Attach `onFramed` and compare updates against the current manual
   `frustum.intersectsBox(...)` path.
4. Keep the existing manual path until the proxy layer proves simpler and less
   noisy.

Avoid using `onOccluded` for DOM window visibility until we have a real
scene-native object to occlude. DOM windows are composited outside the WebGPU
scene, so WebGPU occlusion cannot answer whether a DOM body is visually covered.

### Multi-Canvas Rendering

v10 WebGPU can share one renderer across multiple `Canvas` roots by pointing a
secondary canvas at a primary canvas id. This is not a reason to undo the DOM
body seam. It is a good reason to create a lab for:

- minimap or overview camera
- debug viewport showing the same scene from another camera
- GPU HUD/inspector panels
- low-fps auxiliary rendering beside a full-rate primary scene

Best first experiment:

- Keep `InfiniteCanvasWebGpuSurface` as the primary.
- Add a separate lab route with a secondary canvas, not a production HUD.
- Render grid/window proxy geometry from an overview camera.
- Use scheduler ordering so the overview runs after the primary and can be
  throttled.

This should stay experimental until we can prove it does not fight the DOM
window layer or route layout.

### Camera Parenting And Portal

v10 automatically parents the default camera into the scene when needed, and
`Portal` can declaratively mount children into an `Object3D` container such as
the camera. This is useful for scene-native, camera-relative effects:

- reticles
- WebGPU debug overlays
- camera-locked rulers
- visual diagnostic badges

It should not replace the current DOM HUD controls. The main route controls
need normal accessibility, layout, and input semantics.

Potential first slice:

- Add a debug-only camera-attached axes/ruler layer using `Portal`.
- Verify it follows zoom/pan correctly with the orthographic camera bridge.
- Keep it behind diagnostics until there is a real framework need.

### Frame-Timed Raycasting And Interactive Priority

Frame-timed raycasting reduces pointer-move raycasts in R3F scenes, and
`userData.interactivePriority` lets scene controls win hit-testing even when
depth would normally place them behind other geometry.

Current impact is low because our pointer handling is DOM-driven and the R3F
canvas is `pointer-events: none`. These become important if we add:

- scene-native transform handles
- WebGPU selection/gizmo layers
- object picking inside the scene
- XR or multi-touch scene controls

Do not optimize around these yet. Document them as prerequisites for
scene-native interaction work.

### Per-Pointer State

v10 tracks hover/capture state per pointer, which matters for multi-touch and
XR. Our current multi-touch/trackpad work lives in DOM wheel and pointer event
handling, not R3F's event manager.

This becomes relevant if we move panning, handles, or scene object interaction
into R3F. Until then, the framework's own interaction model remains the source
of truth.

### Drag And Drop Events

R3F v10 can receive drag/drop events on scene objects and canvas-level missed
drop callbacks. This is a future affordance for asset-heavy canvases:

- drop image/model files onto scene-backed slots
- drop onto a GPU node/proxy to create a window
- missed drop creates a new canvas object at the projected point

For the current DOM window framework, native DOM drag state is still the right
root. R3F drop events become attractive when the drop target is scene-native:
a glowing dropzone plane, a 3D node, a proxy field, a minimap target, or a
camera-space affordance. The framework should therefore bridge external drag
state into optional scene drop affordances instead of assuming all drags begin
inside R3F.

Watchpoint:

- the main canvas is currently `pointer-events: none`; enabling R3F drop events
  is an interaction-policy change, not just a visual component change

### useRenderTarget

`useRenderTarget` creates renderer-compatible render targets for WebGL or
WebGPU. This is useful for scene content, not DOM readability. It could support:

- minimap texture generation
- portal previews
- GPU-only snapshot surfaces
- shader preview thumbnails

It does not solve DOM window rasterization. Keep it separate from the SnapDOM
raster pipeline.

### Canvas Size Control

Explicit `width` and `height` props, plus enhanced `setSize`, support
deterministic render resolution. This is useful for:

- benchmark screenshots
- export tools
- visual regression capture
- high-resolution WebGPU scene recording

It should not drive the normal infinite canvas viewport, which should keep
using measured responsive layout.

### Background And Color Space

The new `background` prop and texture color-space controls are lower priority
for this framework because the current route intentionally uses:

- CSS grid/background in the DOM
- transparent WebGPU canvas
- explicit DOM window composition

Adopt these only for scene/lab routes that need environment lighting or
non-transparent WebGPU backgrounds.

### TSL HMR, Buffers, And GPU Storage

The WebGPU/TSL hooks are valuable for future visual polish and performance
experiments:

- shader-backed marquee
- procedural grid or scanline effects
- GPU particle/debug overlays
- compute-assisted spatial visualization
- large instanced proxy fields

These are not first-slice framework primitives. They become useful after we
have a stable scene-overlay adapter and a clear reason to move a visual layer
from DOM/CSS into WebGPU.

## Innovative But Practical Ideas

These are intentionally a little more ambitious than the near-term candidates,
but each has a plausible implementation path and a reason to exist in an
infinite-canvas framework.

### Predictive Raster Budgeter

Current rasterization answers "should this inactive window be a snapshot?" A
better framework-level policy can answer "which windows deserve capture work
next?"

Inputs:

- framed state from the proxy spine
- camera center, zoom, and recent velocity
- interaction state, especially pan/zoom/resize pauses
- existing snapshot age and signature
- distance from the viewport plus a configurable prefetch margin

Behavior:

- capture visible inactive windows first
- skip or delay far-off windows while the camera is moving quickly
- prefetch windows just outside the viewport after motion settles
- avoid re-capturing windows whose signature has not changed
- expose one debug reason per queued/skipped capture

This would make rasterization feel less brute-force. It also gives the devtools
numbers a better story than "queued/ready": we can show why work was admitted
or refused.

### GPU Overlay Compositor

Today the grid, marquee, snap guides, and selection bounds are DOM/CSS layers.
That is good for simplicity, but it can become noisy as polish accumulates. A
future overlay compositor could convert simple overlay primitives into one
WebGPU layer:

- rectangles for selection bounds and marquee
- instanced lines for snap guides, rulers, and alignment rails
- optional procedural dash patterns
- subtle shader treatments for marquee fill or guide glow
- camera-locked debug labels through a separate DOM HUD when text is needed

The practical path is not "rewrite overlays." It is:

1. Define a pure `InfiniteCanvasOverlayPrimitive` model.
2. Feed both DOM overlay renderers and a WebGPU overlay lab from that model.
3. Promote only the visual primitives where GPU rendering is meaningfully
   smoother, cheaper, or more expressive.

This keeps the fallback path free and prevents shader work from becoming a hard
dependency for basic selection.

### Scene-Native Interaction Islands

The main canvas should stay DOM-driven. But specific tools may eventually be
better as R3F objects:

- transform handles that sit around selected windows
- rotate/resize affordances
- connector handles for node graphs
- drop targets for scene-native assets
- ruler pins or measurement handles

R3F v10 gives useful primitives here: frame-timed raycasting,
`interactivePriority`, and per-pointer state. The framework can support this
without changing the default input model by introducing an explicit interaction
island mode:

- the WebGPU canvas remains `pointer-events: none` by default
- a tool can request a temporary scene-interaction layer
- only registered proxy/handle objects receive R3F events
- missed events flow back to the existing DOM deselect/pan/marquee behavior
- scene handles dispatch normal framework commands rather than mutating Three
  objects as the source of truth
- external drag/drop is one likely first consumer, because drop affordances can
  be scene-native while the drag payload remains framework-managed

This gives us a route to high-end editor affordances without letting the R3F
event manager compete with normal window/body interactions all the time.

### Focus Trail And Camera Director

The new camera navigation command is already the right semantic foundation:
target plus behavior. A future camera director can add temporal behavior while
preserving that semantic API.

Examples:

- navigate to active window with a short eased pan
- fit selection, then gently settle at a max zoom
- "focus trail" through search results or linked windows
- presentation mode that moves through authored waypoints
- animated minimap viewport rectangle linked to main camera motion

Implementation constraint:

- the reducer should still produce valid instantaneous camera states
- animation should be an optional boundary component that dispatches or commits
  frames in a controlled way
- interrupted gestures must cancel animation immediately

This is not a v10-only feature, but v10 scheduler lanes can keep the animation
work ordered relative to camera sync, overlay updates, and auxiliary canvases.

### Viewport Heatmap And Work Profiler

A genuinely useful framework devtool would show where runtime work is going in
world space:

- windows currently live DOM versus snapshot
- windows queued/capturing/failed/ready
- framed versus offscreen proxy state
- last capture time by window
- R3F overlay objects currently registered
- camera velocity and raster admission decisions

This can be drawn as a low-fps WebGPU overlay or secondary canvas using the
proxy spine. It would answer the user's earlier concern directly: "how do we
know this performance feature is working?"

### Multi-Canvas Overview As A First-Class Framework Slot

The multi-canvas feature should first be a lab, but the framework could later
offer an overview slot:

```tsx
<InfiniteCanvas.Desktop>
  <InfiniteCanvas.OverviewCanvas placement="bottom-right" fps={12} />
</InfiniteCanvas.Desktop>
```

The overview should render proxy geometry only. It should not attempt to show
live DOM content. That makes it fast, predictable, and useful for navigation:

- current viewport rectangle
- selected windows
- pinned or active window marks
- camera destination previews
- jump-to-click or drag-viewport interactions if the input seam is proven

### GPU Backplane For Dense Non-Window Objects

If the framework grows beyond windows into notes, graph edges, pins, comments,
or spatial search results, DOM nodes will not scale forever. R3F v10 WebGPU
storage hooks suggest a future split:

- windows remain DOM/raster-backed because they are rich React surfaces
- dense decorative or analytic entities become GPU-backed proxy fields
- storage buffers hold positions, colors, selection flags, and semantic ids
- picking can be handled through an explicit scene-interaction island or a
  separate CPU spatial index

This is a practical path to "thousands of things on the canvas" without forcing
every thing to become a React window.

## Ideas To Avoid For Now

- Baking app-specific game/inventory concepts into the framework. Use generic
  drag payloads, scene layers, and command hooks; let consumers model their
  domain above that.
- Replacing DOM windows with R3F UI just to use v10 events. That would sacrifice
  arbitrary React bodies, accessibility, and existing proof-of-concept value.
- Letting R3F objects become the canonical window model. The scene should draw
  from the framework model and dispatch commands back into it.
- Using WebGPU occlusion events as DOM visibility truth. DOM bodies are outside
  the scene, so occlusion can only answer scene-object questions.
- Making the main route multi-canvas before a lab proves renderer sharing,
  scheduler ordering, route layout, and teardown behavior.
- Moving text-heavy HUD controls into the scene. DOM remains the better home
  for accessible controls.
- Using render-phase takeover for ordinary ordering. It is too easy to create
  double-render or ownership bugs unless the feature is explicitly a custom
  render pipeline.

## Migration Readiness Notes

Verified against the current infinite-canvas source:

- The route already imports `Canvas` and `useThree` from
  `@react-three/fiber/webgpu`.
- The main canvas currently uses `frameloop="demand"`.
- The current code reads `camera`, `invalidate`, and `webGPUSupported` from
  `useThree`; it does not rely on `state.gl` in the visible framework surface.
- `visibility-probes.tsx` imports `updateFrustum` and `useFrame` from the
  WebGPU entry point.
- Current scene background is transparent and paired with a DOM CSS grid, so
  the new `background` prop is not an immediate fit.

Migration watchpoints:

- Prefer `renderer`, not `gl`, in any new R3F code.
- Use named scheduler phases for new `useFrame` work.
- Be careful with render-phase callbacks: render phase ownership is a real
  rendering takeover.
- Remember that frame-timed raycasting is disabled under `frameloop="demand"`.
- Match test-renderer entry points to the R3F import path if adding R3F tests.

## Promotion Criteria

Before moving an idea from this ledger to `FEATURE_TRACKER.md`, it should have:

- a small lab or focused test proving the R3F API works in the installed build
- a clear ownership boundary between WebGPU scene state and DOM window state
- general-purpose naming and payload boundaries that do not assume a game,
  inventory, graph, or document-editor domain
- an answer for whether `frameloop="demand"` is compatible with the idea
- a measurable reason to adopt it: lower CPU work, better interaction quality,
  cleaner composition, or a visible capability we cannot get from DOM/CSS alone
- a debug surface that proves the feature is doing work, not just adding
  invisible machinery
- a fallback path when WebGPU, v10 alpha behavior, or scene-native events are
  unavailable

## Recommended Sequencing

The strongest path is to promote the contracts and adapters before promoting
the flashier features:

1. **Scene extension contract**
   - Define general-purpose scene-layer names and context shape.
   - Keep layers read-only except for canonical command dispatch.
   - Make pointer-event and frame-loop policy explicit.

2. **Window proxy spine**
   - Pure derivation from window state.
   - No visual or behavior change by default.
   - One optional debug renderer that shows proxy rectangles.

3. **Scheduler diagnostics pass**
   - Move existing frustum diagnostics into explicit named work.
   - Test `fps` behavior and demand-loop compatibility in the installed build.
   - Keep the current manual frustum path as the baseline.

4. **Visibility proxy comparison**
   - Use the proxy spine to test `onFramed` against manual `intersectsBox`.
   - Measure event churn and stale-state risk.
   - Only promote if it reduces code or improves runtime behavior.

5. **Raster admission policy**
   - Use visibility/proxy state to prioritize captures.
   - Add skip/admit reasons to the raster devtools.
   - Keep SnapDOM itself behind the existing rasterization facade.

6. **External drag/drop bridge lab**
   - Add generic external drag state and projection helpers.
   - Render scene-native drop affordances only while dragging.
   - Dispatch one canonical drop command from DOM or R3F targets.

7. **Dynamic frame/decorations adapter**
   - Expose a DOM frame-rendering seam separately from scene decorations.
   - Render simple window-proxy decorations in WebGPU.
   - Keep DOM body placement and accessibility unchanged.

8. **GPU overlay lab**
   - Convert one overlay family, probably selection bounds or snap guides, into
     pure overlay primitives.
   - Render the same primitives with DOM and WebGPU renderers.
   - Promote only if the WebGPU version is cleaner or meaningfully better.

9. **Multi-canvas overview lab**
   - Build from the proxy spine, not from DOM bodies.
   - Keep it low fps and route-local until renderer sharing is proven stable.

This order keeps the framework durable: each later feature consumes the same
proxy/state contracts instead of adding new ad hoc bridges.

## Suggested Next Experiments

1. **Scene extension contract no-op slice**
   - Add typed scene-layer slots behind a minimal route-local API.
   - Pass read-only camera, viewport, window proxy, selection, and command
     context.
   - Confirm consumer content can render without touching DOM body internals or
     raw Legend State.

2. **Proxy spine no-op slice**
   - Add a pure derived proxy selector and tests.
   - Add a diagnostics-only proxy rectangle renderer.
   - Confirm no production visual behavior changes.

3. **Scheduler diagnostics pass**
   - Move the current frustum probe into an explicit scheduler phase if the
     installed v10 API supports it.
   - Test whether throttling works cleanly for debug overlays.
   - Keep behavior unchanged.

4. **Visibility proxy lab**
   - Add invisible R3F window-bound proxies behind a debug flag.
   - Compare `onFramed` events with manual `frustum.intersectsBox(...)`.
   - Decide whether this reduces code or just adds mirror-state complexity.

5. **External drag/drop bridge lab**
   - Add generic external drag state/actions without any app-specific payload
     assumptions.
   - Render a basic R3F drop affordance through the `interaction` scene layer.
   - Verify missed drops, cancelled drags, and DOM-window hover behavior.

6. **Raster admission devtool**
   - Add capture admit/skip reasons to the raster facade.
   - Prioritize visible and near-viewport inactive windows.
   - Make the debug HUD explain why `ready` does or does not reach the total
     window count.

7. **Dynamic decoration lab**
   - Render a subtle scene-native decoration around selected window proxies.
   - Keep the selected-window DOM style unchanged.
   - Verify the decoration tracks pan, zoom, resize, selection, and fallback.

8. **Multi-canvas overview route**
   - Build a separate lab route using a primary WebGPU canvas and secondary
     overview canvas.
   - Render lightweight proxy geometry, not DOM bodies.
   - Evaluate whether a minimap/overview belongs in the framework.

9. **Camera-attached debug layer**
   - Use `Portal` to attach a small scene-native diagnostic overlay to the
     camera.
   - Confirm it tracks the orthographic camera bridge correctly.

10. **GPU overlay primitive lab**
    - Define selection/snap/marquee overlay primitives.
    - Render one primitive family in both DOM and WebGPU for comparison.
    - Keep the DOM renderer as the fallback and baseline.
