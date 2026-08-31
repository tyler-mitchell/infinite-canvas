import {
  createInfiniteCanvasState,
  getUnknownInfiniteCanvasWindowKinds,
  parseInfiniteCanvasState,
  recoverInfiniteCanvasStateForWindowRegistry,
  serializeInfiniteCanvasState,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";

import { windowDefinitions, type WindowKind } from "./window-registry";

const initialState = createInfiniteCanvasState<WindowKind>({
  camera: { center: { x: 0, y: 0 }, zoom: 1 },
  windows: [],
});

const initialLayout = serializeInfiniteCanvasState(initialState);

type CanvasHydration =
  | Readonly<{ state: InfiniteCanvasState<WindowKind>; status: "loaded" }>
  | Readonly<{
      droppedKinds: readonly string[];
      state: InfiniteCanvasState<WindowKind>;
      status: "recovered";
    }>
  | Readonly<{ status: "unreadable" }>;

function hydrateCanvasLayout(layout: unknown): CanvasHydration {
  const parsed = parseInfiniteCanvasState<string>(layout, initialState);

  if (parsed === null) {
    return { status: "unreadable" };
  }

  const droppedKinds = getUnknownInfiniteCanvasWindowKinds(parsed, windowDefinitions);

  return droppedKinds.length === 0
    ? {
        state: recoverInfiniteCanvasStateForWindowRegistry(parsed, windowDefinitions),
        status: "loaded",
      }
    : {
        droppedKinds,
        state: recoverInfiniteCanvasStateForWindowRegistry(parsed, windowDefinitions),
        status: "recovered",
      };
}

export { hydrateCanvasLayout, initialLayout, initialState };
export type { CanvasHydration };
