/** Exports the optional WebGPU compositor surface, its pass contracts, and shipped passes. */
export { InfiniteCanvasCompositorSurface } from "./compositor/backend/surface";
export { createInfiniteCanvasAreaLightPass } from "./compositor/passes/area-light";
export {
  CONNECTION_CAPACITY,
  createInfiniteCanvasConnectionsPass,
} from "./compositor/passes/connections";
export { createInfiniteCanvasContactShadowPass } from "./compositor/passes/contact-shadow";
export { createInfiniteCanvasFocusFieldPass } from "./compositor/passes/focus-field";
export { createInfiniteCanvasGridPass } from "./compositor/passes/grid";
export {
  PARTICLE_CAPACITY,
  Particle,
  Particles,
  createInfiniteCanvasParticleFieldPass,
} from "./compositor/passes/particle-field";
export {
  WindowProximities,
  WindowProximity,
  createInfiniteCanvasProximityPass,
} from "./compositor/passes/proximity";
export {
  DEFAULT_AREA_LIGHT_OPTIONS,
  DEFAULT_CONNECTIONS_OPTIONS,
  DEFAULT_CONTACT_SHADOW_OPTIONS,
  DEFAULT_FOCUS_FIELD_OPTIONS,
  DEFAULT_GRID_OPTIONS,
  DEFAULT_INFINITE_CANVAS_COMPOSITOR,
  DEFAULT_PARTICLE_FIELD_OPTIONS,
  DEFAULT_PROXIMITY_OPTIONS,
} from "./compositor/policy";
export {
  CompositorCamera,
  camera,
  screenToClip,
  screenToWorld,
  worldToScreen,
} from "./compositor/backend/camera";
export {
  WindowInstance,
  WindowInstances,
  instanceCount,
  instances,
} from "./compositor/backend/instances";
export { ADDITIVE_BLEND, PREMULTIPLIED_OVER_BLEND } from "./compositor/pass";
export type {
  CompositorBuildContext,
  CompositorBuiltPass,
  CompositorColorAttachment,
  CompositorFrame,
  CompositorFrameBase,
  CompositorTarget,
  InfiniteCanvasScenePass,
} from "./compositor/pass";
export type { InfiniteCanvasSceneSurface, InfiniteCanvasSceneSurfaceProps } from "./scene-surface";
