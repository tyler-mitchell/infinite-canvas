import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { parseInfiniteCanvasState, serializeInfiniteCanvasState } from "./persistence";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * Hydrating replaces the document, never the measurement.
 *
 * `viewport` is measured from the DOM and deliberately omitted from a serialized document —
 * restoring one would hydrate a canvas sized for someone else's monitor. Hydration then *adopted*
 * the incoming document's viewport, which for a parsed document is the fallback's, and that is
 * `0 x 0`.
 *
 * The result was not subtly wrong. World origin projected to screen origin instead of the viewport
 * centre, so content landed off the top-left corner; `isUsableViewport` was false, so culling,
 * `view.fitAll`, `view.fitSelection`, and viewport snapping were all inert. And it never
 * recovered, because the resize observer had already fired at the real size.
 *
 * Found in Polkadot, which hydrates from a local database on every load — the documented
 * `parseInfiniteCanvasState` + `hydrate` pattern, and therefore every consumer's path.
 */

type Kind = "note";

const measured = (): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({
    windows: [
      createInfiniteCanvasWindow<Kind>({
        id: "a",
        kind: "note",
        rect: { height: 200, width: 300, x: 0, y: 0 },
        title: "a",
      }),
    ],
  }),
  viewport: { height: 900, width: 1440 },
});

/** What a consumer actually hydrates: a document that round-tripped through storage. */
const restored = () => {
  const document = serializeInfiniteCanvasState(measured());
  const parsed = parseInfiniteCanvasState<Kind>(
    document,
    createInfiniteCanvasState<Kind>({ windows: [] }),
  );

  expect(parsed).not.toBeNull();

  return parsed as InfiniteCanvasState<Kind>;
};

test("a serialized document carries no viewport", () => {
  // The premise. If this ever changes, the rest of this file is asking the wrong question.
  const document = serializeInfiniteCanvasState(measured()) as unknown as Record<string, unknown>;

  expect(document["viewport"]).toBeUndefined();
});

test("hydrating keeps the viewport the canvas measured", () => {
  const hydrated = reduceInfiniteCanvasState(measured(), {
    state: restored(),
    type: "desktop.hydrate",
  });

  expect(hydrated.viewport).toEqual({ height: 900, width: 1440 });
});

test("hydrating still adopts the document's windows", () => {
  // The measurement is preserved; nothing else is. A hydrate that kept more than the viewport
  // would silently ignore the document it was handed.
  const hydrated = reduceInfiniteCanvasState(
    { ...measured(), windows: [] },
    { state: restored(), type: "desktop.hydrate" },
  );

  expect(hydrated.windows.map((window) => window.id)).toEqual(["a"]);
});

test("hydrating before the first measurement takes what the document has", () => {
  // On a canvas that has never been measured there is nothing to preserve, and refusing the
  // incoming value would leave the state with no viewport at all.
  const unmeasured = { ...measured(), viewport: { height: 0, width: 0 } };
  const hydrated = reduceInfiniteCanvasState(unmeasured, {
    state: { ...restored(), viewport: { height: 600, width: 800 } },
    type: "desktop.hydrate",
  });

  expect(hydrated.viewport).toEqual({ height: 600, width: 800 });
});
