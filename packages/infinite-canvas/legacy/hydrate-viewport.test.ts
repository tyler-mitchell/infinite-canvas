import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { createInfiniteCanvasStore } from "./store";
import { reduceInfiniteCanvasState } from "./operations";
import type { InfiniteCanvasState } from "./types";

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

const restored = () => {
  const document = createInfiniteCanvasStore({ initialState: measured() }).snapshot();
  const parsed = createInfiniteCanvasStore<Kind>({ document: document }).getState();

  expect(parsed).not.toBeNull();

  return parsed as InfiniteCanvasState<Kind>;
};

test("a serialized document carries no viewport", () => {
  const document = createInfiniteCanvasStore({
    initialState: measured(),
  }).snapshot() as unknown as Record<string, unknown>;

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
  const hydrated = reduceInfiniteCanvasState(
    { ...measured(), windows: [] },
    { state: restored(), type: "desktop.hydrate" },
  );

  expect(hydrated.windows.map((window) => window.id)).toEqual(["a"]);
});

test("hydrating before the first measurement takes what the document has", () => {
  const unmeasured = { ...measured(), viewport: { height: 0, width: 0 } };
  const hydrated = reduceInfiniteCanvasState(unmeasured, {
    state: { ...restored(), viewport: { height: 600, width: 800 } },
    type: "desktop.hydrate",
  });

  expect(hydrated.viewport).toEqual({ height: 600, width: 800 });
});
