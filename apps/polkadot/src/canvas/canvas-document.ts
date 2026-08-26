import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  getUnknownInfiniteCanvasWindowKinds,
  parseInfiniteCanvasState,
  recoverInfiniteCanvasStateForWindowRegistry,
  serializeInfiniteCanvasState,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";

import { windowDefinitions, type WindowData, type WindowKind } from "./window-registry";

/**
 * What a canvas contains on a first run, and how a saved one is turned back into runtime state.
 *
 * Hydration happens in the route loader rather than after mount. A canvas that is created from
 * already-valid state never renders an empty frame that later fills in, and the store never has to
 * be corrected once it exists.
 */

const initialState = createInfiniteCanvasState<WindowKind>({
  camera: { center: { x: 0, y: 0 }, zoom: 1 },
  windows: [
    createInfiniteCanvasWindow<WindowKind, WindowData["note"]>({
      // Seeded by `fn::open_default_canvas`, so the layout references a record that exists.
      data: { noteId: "content_item:welcome" },
      id: "welcome",
      kind: "note",
      minSize: { height: 180, width: 280 },
      rect: { height: 300, width: 460, x: -230, y: -150 },
      title: "Welcome",
    }),
  ],
});

const initialLayout = serializeInfiniteCanvasState(initialState);

/**
 * Three outcomes, because they call for three different surfaces.
 *
 * `loaded` is the ordinary case. `recovered` means the layout was structurally valid but named a
 * window kind this build does not register — the framework drops those and keeps the rest, so the
 * canvas opens and the user is told what is missing. `unreadable` means the stored value is not a
 * canvas layout at all, where opening anything would be a guess.
 */
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
