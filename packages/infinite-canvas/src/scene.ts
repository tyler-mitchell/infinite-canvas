/**
 * `@infinite-canvas/react/scene` — the WebGPU scene surface.
 *
 * This entry, and only this entry, imports `three` and `@react-three/fiber`.
 * Importing it is how a consumer opts into a 3D engine; pass the surface to
 * `<InfiniteCanvasDesktop sceneSurface={...} />` to paint `sceneLayers`.
 *
 * The main entry never reaches this module, statically or dynamically, so a
 * consumer who does not import it can leave both peers uninstalled.
 */
export { InfiniteCanvasWebGpuSurface } from "./webgpu-surface";
export { InfiniteCanvasWindowFrustumProbeLayer } from "./visibility-probes";
export type { InfiniteCanvasSceneSurface, InfiniteCanvasSceneSurfaceProps } from "./scene-surface";
