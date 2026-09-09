---
"@hyphened/infinite-canvas": minor
---

The `/scene` entry now paints with a TypeGPU compositor instead of `three` and `@react-three/fiber`.

`InfiniteCanvasCompositorSurface` replaces `InfiniteCanvasWebGpuSurface`. Pass it to `sceneSurface`.

A scene layer is now a pass, and the type is `InfiniteCanvasScenePass`. `render` is replaced by `build`, which runs once against the device and returns optional `compute`, `record`, and `readback` functions. `record` takes the canvas for one draw from `target()`, so the first draw of a frame clears and every later one keeps what is already there. A shader reads the camera of its space through the `camera` accessor and every window instance through the `instances` accessor, so a pass needs no bind group of its own.

Windows live in a GPU-resident world. Each frame the surface writes what the document asks for, and one compute step moves the world toward it by the frame's delta before any pass draws, so nothing a pass draws can jump.

The surface mounts framework passes from the new `compositor` prop on `InfiniteCanvasDesktop`. Each field takes `true`, `false`, or partial options. On by default: a world-space dot grid that replaces the CSS backdrop, and a contact shadow below each window that reads the union of their rounded-box distance fields, and a particle field whose drift comes from curl noise so the medium carries particles without ever gathering them. Off by default, opt in with `true` or options: an area light that treats each window as a rectangular emitter above the medium and takes the diffuse term of Linearly Transformed Cosines; an attention field that dims the medium away from the active window; and a proximity compute pass whose readings reach `useInfiniteCanvasWindowProximity`. Proximity is off because it costs a compute dispatch and a GPU-to-CPU map every frame, and the map forces a synchronisation.

Colour options across the compositor are sRGB, the same channels a CSS hex carries. The canvas format is never an sRGB one, so the values pass straight through.

`InfiniteCanvasWindowFrustumProbeLayer` is removed. `diagnostics.frustum` now measures with the pure viewport predicate and needs no scene surface.

`getInfiniteCanvasWorldSegmentSceneTransform`, `getInfiniteCanvasWorldPathSceneTransforms`, and the `*ScenePosition` fields on window proxies remain for one release and are removed next.

Peers: `three`, `@react-three/fiber`, and `@types/three` are no longer required. `typegpu` and `@typegpu/react` are optional peers used only by `/scene`, which is also the only entry that reaches `@typegpu/sdf` and `@typegpu/noise`.
