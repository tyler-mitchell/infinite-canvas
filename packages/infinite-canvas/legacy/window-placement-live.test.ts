import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./operations";
import type { InfiniteCanvasRect, InfiniteCanvasState } from "./types";

const SIZE = { height: 240, width: 360 };

const canvas = () =>
  createInfiniteCanvasState({ viewport: { height: 800, width: 1200 }, windows: [] });

const openAt = (state: InfiniteCanvasState, id: string) =>
  reduceInfiniteCanvasState(state, {
    placement: { gapPx: 24, region: "center" },
    type: "window.open",
    window: createInfiniteCanvasWindow({
      id,
      kind: "note",
      // Only the size is meaningful. Every caller offers the same origin.
      rect: { ...SIZE, x: 0, y: 0 },
      title: id,
    }),
  });

const overlaps = (left: InfiniteCanvasRect, right: InfiniteCanvasRect) =>
  left.x < right.x + right.width &&
  right.x < left.x + left.width &&
  left.y < right.y + right.height &&
  right.y < left.y + left.height;

test("a window opened with a placement is moved off the origin the caller supplied", () => {
  const opened = openAt(canvas(), "first").windows[0];

  expect(opened?.rect).not.toEqual({ ...SIZE, x: 0, y: 0 });
  expect(opened?.rect.width).toBe(SIZE.width);
});

test("windows opened from one stale snapshot still avoid each other", () => {
  /*
   * A caller holding a stale snapshot emits identical open actions, each carrying the same origin.
   * These are those actions. The reducer holds live state, so it separates them anyway.
   */
  const start = canvas();
  const rects = ["a", "b", "c", "d"].reduce<InfiniteCanvasState>(
    (state, id) => openAt(state, id),
    start,
  ).windows;

  expect(rects).toHaveLength(4);

  for (const [index, window] of rects.entries()) {
    for (const other of rects.slice(index + 1)) {
      expect(overlaps(window.rect, other.rect)).toBe(false);
    }
  }
});

test("without a placement the window keeps the exact rect it carried", () => {
  const rect = { height: 120, width: 200, x: 4321, y: 8765 };
  const next = reduceInfiniteCanvasState(canvas(), {
    type: "window.open",
    window: createInfiniteCanvasWindow({ id: "exact", kind: "note", rect, title: "Exact" }),
  });

  expect(next.windows[0]?.rect).toEqual(rect);
});
