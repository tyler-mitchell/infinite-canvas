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

## Verification

- The in-app browser at `http://localhost:5173/workflow-board` is the verdict for visible behavior.
- The TypeGPU inspector MCP validates every shader module in isolation
  (`inspect_typegpu` with `target.kind: "symbols"` on a module that imports only `typegpu`).
- Do not report a step done on a green check. Report what was seen.

## Decision trail

Append a row to `docs/internal/decisions.tsv` after each real code change. Commit with a pathspec.
