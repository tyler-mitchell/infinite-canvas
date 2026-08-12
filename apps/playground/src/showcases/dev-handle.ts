import {
  getInfiniteCanvasContextualCommands,
  serializeInfiniteCanvasState,
  type InfiniteCanvasOverlayRenderContext,
} from "@infinite-canvas/react";

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

export function exposeCanvasDevHandle<Kind extends string, Payload>(
  context: InfiniteCanvasOverlayRenderContext<Kind, Payload>,
): void {
  if (!import.meta.env.DEV) {
    return;
  }
  // Every reader derives from this one source, and that is the whole point.
  //
  // `contextualCommands` used to return `context.contextualCommands` — the array the canvas
  // memoized for *its* render — while `state` returned `context.state`. Driving the product on
  // 2026-08-12 caught them disagreeing about the same moment: two floating windows were selected,
  // the command palette listed every align verb as available, executing one demonstrably moved a
  // window, and this handle reported `enabled: false` for all six. The framework was right and the
  // handle was lying, which is the worst direction for the surface agents are told to trust — it
  // sent me hunting a product bug that did not exist.
  //
  // Computing the commands from the same state the handle reports makes that disagreement
  // unrepresentable rather than unlikely. `acceptance-scenarios.test.ts` pins the predicate itself,
  // so a real enablement regression still fails a test rather than hiding behind this.
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
