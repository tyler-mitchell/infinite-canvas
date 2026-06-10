import {
  serializeInfiniteCanvasState,
  type InfiniteCanvasOverlayRenderContext,
} from "infinite-canvas";

/**
 * Dev-only programmatic handle so agents and E2E tooling can drive the
 * canvas: read state, dispatch the typed command facade, hit-test points.
 * Wired from renderOverlay because the overlay context already carries the
 * full consumer contract (actions, state, spatial targeting, contextual
 * commands). Playground-only glue — intentionally not a framework export.
 */
type CanvasDevHandle = {
  actions: InfiniteCanvasOverlayRenderContext["actions"];
  contextualCommands: () => InfiniteCanvasOverlayRenderContext["contextualCommands"];
  resolveSpatialTarget: InfiniteCanvasOverlayRenderContext["resolveSpatialTarget"];
  snapshot: () => unknown;
  state: () => InfiniteCanvasOverlayRenderContext["state"];
};

declare global {
  interface Window {
    __canvas?: CanvasDevHandle;
  }
}

export function exposeCanvasDevHandle<Kind extends string>(
  context: InfiniteCanvasOverlayRenderContext<Kind>,
): void {
  if (!import.meta.env.DEV) {
    return;
  }
  window.__canvas = {
    actions: context.actions as InfiniteCanvasOverlayRenderContext["actions"],
    contextualCommands: () => context.contextualCommands,
    resolveSpatialTarget:
      context.resolveSpatialTarget as InfiniteCanvasOverlayRenderContext["resolveSpatialTarget"],
    snapshot: () => serializeInfiniteCanvasState(context.state),
    state: () => context.state,
  };
}
