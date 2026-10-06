import { expect, test } from "vite-plus/test";

import {
  DEFAULT_FOCUS_FIELD_OPTIONS,
  DEFAULT_GRID_OPTIONS,
  DEFAULT_INFINITE_CANVAS_COMPOSITOR,
  DEFAULT_PROXIMITY_OPTIONS,
  resolveInfiniteCanvasCompositorPolicy,
} from "./policy";

test("compositor policy with no input is the default policy", () => {
  expect(resolveInfiniteCanvasCompositorPolicy()).toEqual(DEFAULT_INFINITE_CANVAS_COMPOSITOR);
});

test("compositor policy takes every absent field from the default policy", () => {
  // The default policy is the only place that says which passes are on. A
  // second copy of that fact inside the resolver would fail here as soon as
  // the two disagreed.
  for (const key of Object.keys(DEFAULT_INFINITE_CANVAS_COMPOSITOR)) {
    const field = key as keyof typeof DEFAULT_INFINITE_CANVAS_COMPOSITOR;

    expect(resolveInfiniteCanvasCompositorPolicy({})[field]).toEqual(
      DEFAULT_INFINITE_CANVAS_COMPOSITOR[field],
    );
  }
});

test("compositor policy turns a pass on with true and off with false", () => {
  expect(resolveInfiniteCanvasCompositorPolicy({ proximity: true }).proximity).toEqual(
    DEFAULT_PROXIMITY_OPTIONS,
  );
  expect(resolveInfiniteCanvasCompositorPolicy({ grid: false }).grid).toBe(false);
});

test("compositor policy merges a partial object over the pass defaults", () => {
  expect(resolveInfiniteCanvasCompositorPolicy({ focusField: { reachPx: 10 } }).focusField).toEqual(
    {
      ...DEFAULT_FOCUS_FIELD_OPTIONS,
      reachPx: 10,
    },
  );
  expect(resolveInfiniteCanvasCompositorPolicy({ grid: { falloff: 0 } }).grid).toEqual({
    ...DEFAULT_GRID_OPTIONS,
    falloff: 0,
  });
});
