# Compositor blueprint

Status: binding implementation plan from 2026-09-08. Written for whoever continues the work.
Read this file, then `apps/compositor-poc/src/spine/compositor-spine.tsx`, then `docs/compositor.md`.

## Intent

The infinite canvas is a world, not a layout. Windows are bodies with presence and neighbors. The
space between them is a live medium that reacts to them. The DOM owns text, focus, input, and
accessibility. The GPU owns the medium.

WebGPU earns its place only when the medium has state that lives on the GPU and that every pass can
read. That state is the substrate. A compositor that only draws lines under DOM windows has no reason
to exist.

Constraints stated by the owner on 2026-09-08:

- Judge tools on merit. Adopt new or experimental technology when it earns it.
- html-in-canvas is the target and a present design constraint. It has not shipped in stable Chrome.
- The DOM window plane is a supported path, not a fallback. The project is a portfolio item and must
  run in any reviewer's browser without a flag. Development happens in the app's in-app browser
  (Chrome 146), which lacks html-in-canvas. Every compositor feature is runtime-detected and additive.
- WebGPU is the baseline. Browsers of the audience (software engineers, 2026) have it. `@typegpu/gl` is
  out; `docs/compositor.md` records the upstream issues that would reopen a field-only path.

## Architecture

```
packages/infinite-canvas/src/compositor/
  pass.ts          contracts: InfiniteCanvasScenePass, CompositorBuildContext, CompositorBuiltPass.
                   No GPU import. The viewport can type against it without the GPU stack.
  backend/
    root.ts        one TgpuRoot per store (WeakMap keyed by the store object). tgpu.init once,
                   root.destroy when the last surface for that store unmounts. Boot state:
                   booting | ready | unsupported. Never called from the main entry.
    camera.ts      CompositorCamera schema, worldToScreen, screenToClip, snapToDevicePixel.
                   Units: viewport and zoom in CSS pixels, exactly worldRectToScreenRect.
                   devicePixelRatio is the viewport's uncapped ratio.
    substrate.ts   WindowBody schema and the instance buffer the surface writes each frame from
                   getInfiniteCanvasWindowProxies: rect, screenRect, flags (active, selected,
                   hovered, pinned), zIndex, kind ordinal. Every pass receives it at build.
    surface.tsx    InfiniteCanvasCompositorSurface. One per placement, both spaces. Owns the
                   canvas, the context, the camera uniforms, the substrate buffer, the pass
                   instances (Map by pass.id, diffed on prop change), the frame loop, and cleanup.
  passes/
    light-field.ts windows emit light into the medium; neighbors mix. From the proof's
                   light-field.ts. Ships in the framework as the first substrate pass.
```

The seam name `InfiniteCanvasSceneSurface` does not change. The `/scene` entry exports
`InfiniteCanvasCompositorSurface` in place of `InfiniteCanvasWebGpuSurface`.

`InfiniteCanvasSceneLayer.render: (context) => ReactNode` becomes
`build: (context: CompositorBuildContext) => CompositorBuiltPass`. That is the only consumer-visible
type change in the seam. It needs a Bumpy bump file.

## Frame

1. `store.state$.onChange` marks dirty and schedules one requestAnimationFrame.
2. The frame peeks the store, builds the scene layer render context once, asks every pass
   `invalidate(context)` (map, not some; every pass is asked), and returns if nothing changed and no
   pass is `frameloop: "always"`.
3. It writes the world and screen camera uniforms and the substrate buffer.
4. It records every pass of the placement into one render pass on one command encoder
   (`root['~unstable'].createCommandEncoder()`), world passes before screen passes, in declaration
   order. `pass.end()`, `encoder.submit()`.
5. Boot: `Promise.all(pass.ready)` where `ready` is `pipeline.initAsync()`. A rejected ready warns with
   the pass id and mounts the remaining passes. No timers.

## Review dispositions (2026-09-08)

The adversarial review of spine revision 2 raised eleven objections. Nine were accepted and shape the
architecture above: CSS-pixel units in the camera; uncapped device pixel ratio shared with the DOM
plane; allocation and release in one effect keyed by root and pass id; pipeline release on rebuild;
root ownership behind the `/scene` entry; `spatialTargetResolvers` kept on the surface props;
`invalidate` asked of every pass; `initAsync` rejection surfaced; root held in a ref and destroyed
after the last surface.

Two were rejected: the window-plane canvas swap and the `resources` build-context field belong to the
html-in-canvas deliverable, which reuses every owner above and adds `CompositorBuildContext.resources`
with rebuild-by-id.

## Order of work

Each step leaves a coherent product. Stop at any step boundary, not inside one.

1. `compositor/pass.ts`, `backend/camera.ts`, `backend/substrate.ts`, `backend/root.ts`,
   `backend/surface.tsx`. Export the surface from `/scene`. Keep `webgpu-surface.tsx` until step 3.
2. `passes/light-field.ts` mounted in the playground `/workflow-board` route as an underlay world pass.
   Verify in the in-app browser: the medium glows around windows and changes when a window moves.
3. Port the frustum probe to `isWorldRectWithinViewport` inside `visibility.tsx`. Delete
   `visibility-probes.tsx` and `webgpu-surface.tsx`. Port the workflow-board links to a pass.
4. Remove `three`, `@react-three/fiber`, `@types/three`, `@react-three/drei` from
   `packages/infinite-canvas/package.json` and the playground. Update `verify-pure-core.mjs` to ban
   `typegpu` from the core. Update `docs/API.md` rows (see the spine's teardown section for line
   anchors). Add the bump file with `pnpm run release:add`.
5. Polkadot: mount the surface, move connectors from SVG to a pass, keep DOM labels.

## Correction on 2026-09-08: the engine-first target

The owner judged the work below a fundamental miss, and the judgment holds. The `sceneSurface` and
`sceneLayers` seam, an underlay canvas beneath the DOM window plane, and consumer-authored pass lists
are the R3F-era shape with TypeGPU inside it. That is a renderer swap, not an engine.

The corrected target, which supersedes "Architecture" above where they differ:

1. **Scene model as a framework owner.** The framework maintains one GPU-resident scene from the
   store: window instances, connections, selection, camera. Consumers add entities through the store
   and commands, exactly as they add windows today. There is no consumer pass list.
2. **Framework primitives on TypeGPU.** Instanced quads, thick segments, glow fields, and readback
   signals are framework passes with data inputs. A consumer never writes a shader. Polkadot's
   connectors become a `connections` slice the framework draws; the workflow-board links use the same
   slice.
3. **Signals as state.** GPU readback (proximity, later occlusion and density) lands in the store's
   `signals$` view state with hooks. Proximity is the first slice; `useInfiniteCanvasWindowProximity`
   reads it. Done on 2026-09-08.
4. **One mount.** The compositor mounts with the viewport when the `/scene` entry is present. The
   `sceneSurface` prop and the four-way `sceneLayers` split are removed once the scene model exists.
5. **DOM as a presentation of the scene.** The window layer projects the same scene the GPU draws.
   html-in-canvas later replaces the DOM projection of a window with its texture, per section
   "Intent", without changing the scene model.

The source-shaped spine for this target is `apps/compositor-poc/src/spine/scene-model-spine.tsx`:
the `connections` state slice and actions, the pure scene-model derivation, the GPU scene write, the
framework connection pass, the single mount, and signals as store state.

Order of work for the successor: (a) verify or fix the empty-canvas defect below, because nothing above
can be seen without it; (b) build the scene model and the `connections` slice; (c) replace
`sceneLayers` in the playground and Polkadot with store entities; (d) delete the `sceneSurface` prop.

## The demonstration

Chosen on 2026-09-08 from ten candidates: **gravity and focus field**, on the playground workflow
board and in Polkadot. Windows have mass; a compute pass integrates a soft attraction between
connected windows and repulsion between unrelated ones, and its readback feeds the reducer so a
dragged window settles the others. A second pass darkens the medium away from the active window and
the cursor. Together they show the three unlocks in one scene: GPU-resident scene state, compute
that drives application behavior through `signals$`, and a DOM plane projecting a scene it did not
compute. Both are compute passes over the existing window instances plus one readback; they need the
scene model's `connections` slice first.

## State on 2026-09-08 (handover)

Implemented and staged, not committed (the owner asked for no commits):

- `packages/infinite-canvas/src/compositor/`: `pass.ts` (contracts, now with a compute stage),
  `backend/camera.ts`, `backend/instances.ts`, `backend/surface.tsx` (on `@typegpu/react`:
  `useRootWithStatus`, `useRoot`, `useConfigureContext`, `useUniform`, `useReadonly`, `useFrame`),
  `passes/light-field.ts`, `passes/proximity.ts` (compute pass with `mutable.read()` readback).
- `webgpu-surface.tsx` and `visibility-probes.tsx` deleted. The frustum probe lives in
  `visibility.tsx` on `isWorldRectWithinViewport`. `three` and R3F removed from the framework and
  the playground. `verify-pure-core.mjs` bans `typegpu` from the core.
- The surface takes an explicit `placement` and mounts the framework's light-field and proximity
  passes in the underlay itself; consumers pass only `sceneSurface` and their own passes. Proximity
  readings publish to `store.signals$.proximity`.
- Playground: `workflow-board` and `drop-tray` ported to passes. Polkadot: `sceneSurface` only.
- Compositor policy (`compositor/policy.ts`, no GPU import): `compositor` prop on the desktop, each
  field `true`, `false`, or partial options; resolved once and handed to the surface, which mounts
  focus field, radiance, and proximity from it. Each pass reads its tuning from `tgpu.slot`s bound on
  the configured root, so a policy change rebuilds the pipelines. Add every new framework pass here.
- Framework passes in draw order: contact shadow (`passes/contact-shadow.ts`, one fragment over the
  window SDF union), particle field (`passes/particle-field.ts`, compute step then instanced draw,
  `frameloop: "always"` so the surface redraws every frame; per-particle work is one loop over the
  window instances, so cost is `count * windows` per frame), focus field, radiance, then the
  proximity compute pass. The particle tuning is untested; expect to adjust `gravity`, `drift`,
  and `opacity` on first sight. Because the particle pass is `always`, every frame is drawn; each
  frame carries `sceneChanged`, and radiance and proximity do their heavy work only when it is
  true. A new demand pass with a costly step must gate on it the same way. The next straightforward
  passes, in the order the owner prefers: zoom-level impostors (draw windows as tinted cards below a
  zoom threshold and unmount the DOM through the detail-level policy), a zoom-aware dot grid that
  replaces the CSS grid, a minimap drawn from the same instance buffer with a second camera, and
  off-screen edge indicators. Each is one pass and one policy field; none needs a new resource.
- Gates: framework and playground type-checked before the focus-field, radiance, signals, and policy
  work. Nothing has been type-checked since; the successor's first action is one framework
  type-check, then the playground, then the gates.

NOT VERIFIED: the compositor canvas showed no pixels in the in-app browser. Facts established by
reading and by one page probe: frames run (`useFrame` reached `encoder.submit()`), no uncaught errors,
no WebGPU validation messages, the canvas is the single `<canvas>` in the viewport with a configured
`bgra8unorm` premultiplied context, and the light-field pipeline compiles and creates on a device with
the accessors bound (TypeGPU inspector). Even an opaque clear did not appear. Remaining suspects, in
order: (1) the `useConfigureContext` auto-resize sets `canvas.width/height` after the first frames and
nothing marked the surface dirty on resize, so the cleared canvas waited for a store change. The frame
now compares the canvas backing size to the last draw and redraws on change. A screenshot after that
change still showed no glow or links, so (1) alone is not the cause. (2) Something else calls
`getCurrentTexture()` on the same context in the same frame. (3) The frame's `ready` state or the
`ctxRef` closure inside `useFrame` is stale after a React Fast Refresh remount. (4) The pass draws with
zero instances because `writeSoA` on `instanceStore.buffer` did not land. Fastest split: in `record` of
the light-field pass, temporarily draw with `pipeline.withColorAttachment({ view: context }).draw(6, n)`
(the documented direct path) instead of `pipeline.with(pass)`. If that shows, the typed-pass wiring in the
surface is the fault; if not, the data or the loop is. Verify with a plain screenshot of `/workflow-board`
after a window drag; the light field should show around each card and the links should draw between them.

Ruled out by reading on 2026-09-08 (no run): the render pass descriptor is sound, TypeGPU's
`beginRenderPass` defaults `loadOp: "clear"` and `storeOp: "store"` and unwraps a canvas context
through `getCurrentTexture().createView()` (`typegpu/core/commandEncoder/attachments.js`); DOM
stacking is sound, the grid backdrop has no z-index and precedes the surface in DOM order, so the
surface at z-index 0 paints above it; `common.writeSoA` writes the whole `[0, count * stride)` range
from the host `arrayBuffer` and then `buffer.write`, so the instance data lands if the columns are
sized to the live count. Also ruled out by reading `@typegpu/react` 0.12.0: `useConfigureContext`
configures the canvas through `useRoot()`, the same root `CompositorCanvas` builds pipelines on, and
`root.configureContext` returns the raw `GPUCanvasContext` that the attachment guard accepts
(`typeof getCurrentTexture === "function"`); `useFrame` is a plain `requestAnimationFrame` loop that
always calls the latest callback, so a stale closure after Fast Refresh is not possible. Remaining
suspect is (2), a second `getCurrentTexture()` on the same context in the same frame, or a cause
reading cannot reach. The split experiment above decides.

New suspect found and fixed by reading on 2026-09-08: the desktop, the viewport, and the surface
each defaulted `sceneLayers` to a fresh `[]`, and the surface's pass effect depends on that array.
Any parent re-render therefore destroyed and rebuilt every pipeline and dropped `ready` to false,
so a frame that landed during a rebuild drew nothing. All three now share one constant. If the
playground route passes an inline `sceneLayers` array, memoize it; the same rebuild follows.
The other build-effect inputs are stable by reading: `useUniform` and `useReadonly` keep one
resource in React state and replace it only when the schema deep-equals differently or the root
changes (`@typegpu/react/core/use-uniform.js`, `helper-hooks.js`); the schemas are module
constants; `configuredRoots` is memoized on those resources; the store and the placement do not
change. With the shared empty-layers constant, no parent re-render rebuilds the pipelines.

## Verification

- The in-app browser at `http://localhost:5173/workflow-board` is the verdict for visible behavior.
- The TypeGPU inspector MCP validates every shader module in isolation
  (`inspect_typegpu` with `target.kind: "symbols"` on a module that imports only `typegpu`).
- Do not report a step done on a green check. Report what was seen.

## Correction on 2026-09-08 (later): what the handover section now gets wrong

The "State on 2026-09-08 (handover)" section above is a point-in-time record and is kept, but it no
longer describes the tree. Read this before acting on it.

- **The empty canvas is resolved.** Its "NOT VERIFIED" paragraph, the four remaining suspects, and
  the suggested `withColorAttachment` split are all spent. The canvas draws. Cause was neither of
  the leading suspects: the surface re-rendered on every store change, and each render re-attached
  the canvas ref, which made `useConfigureContext` observe the canvas again and write
  `canvas.width`, resetting the swap chain. `memo` on the surface fixed it.
- **Passes named there that no longer exist**: `passes/light-field.ts` and the radiance pass are
  deleted, `frameloop` is deleted from the contract, and the `sceneChanged` frame flag is gone. Any
  advice above about gating heavy work on `sceneChanged` has no mechanism behind it.
- **Draw order now**: grid, area light (off by default), contact shadow, particle field, focus field
  (off by default), proximity (off by default since it costs a compute dispatch and a GPU-to-CPU map
  per frame and nothing reads its signal).
- **The world exists.** `backend/world.ts` holds GPU-resident state that settles toward the
  document by `dt` before any pass draws, so the "no time" defect the spine names is closed.
- **Gates are green**, contradicting "nothing has been type-checked since": framework and playground
  check clean, 798 tests pass, and the API doc, stability and pure-core gates pass. `verify-pure-core`
  now bans the whole GPU stack rather than only `typegpu`.

**Unchanged and still governing: the engine-first target.** The consumer-authored pass list is still
the shape this document says to remove. Work done on 2026-09-08 refined that seam rather than
removing it — `InfiniteCanvasSceneLayer` collapsed into `InfiniteCanvasScenePass`, and
`CompositorSceneResources` was kept on the argument that it is a consumer extension point. That
argument does not survive this document, which states there is no consumer pass list and a consumer
never writes a shader. Treat those as refinements to something scheduled for deletion, not as
endorsements of it. Steps (b) through (d) of the order of work are untouched.

## Decision trail

Append a row to `docs/internal/decisions.tsv` after each real code change. Commit with a pathspec.
