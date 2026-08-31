import {
  getInfiniteCanvasContextualCommands,
  serializeInfiniteCanvasState,
  type InfiniteCanvasOverlayRenderContext,
} from "@hyphened/infinite-canvas";

/** This development handle exposes canvas actions, state, and spatial targets. */
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

export function exposeCanvasDevHandle<Kind extends string, Payload>(
  context: InfiniteCanvasOverlayRenderContext<Kind, Payload>,
): void {
  if (!import.meta.env.DEV) {
    return;
  }
  // Commands and snapshots derive from the same state value.
  const getState = () => context.state as InfiniteCanvasOverlayRenderContext["state"];

  window.__canvas = {
    actions: context.actions as InfiniteCanvasOverlayRenderContext["actions"],
    contextualCommands: () => getInfiniteCanvasContextualCommands(getState()),
    resolveSpatialTarget:
      context.resolveSpatialTarget as InfiniteCanvasOverlayRenderContext["resolveSpatialTarget"],
    snapshot: () => serializeInfiniteCanvasState(getState()),
    state: getState,
  };
}
