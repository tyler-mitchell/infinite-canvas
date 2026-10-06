import { expect, test } from "vite-plus/test";

import { masonryEngine } from "./masonry-engine";

test("default rows follow the lowest occupied cell and exclude hidden members", () => {
  const result = masonryEngine.layout({
    rect: { x: 20, y: 30, width: 400, height: 200 },
    container: {
      id: "grid",
      kind: "container",
      weight: 1,
      activeChildId: null,
      axis: "horizontal",
      layout: "masonry",
      masonry: {
        cols: 4,
        rowHeight: 10,
        margin: [0, 0],
        containerPadding: [0, 0],
        compactType: null,
      },
      children: [
        { id: "a", kind: "window", weight: 1, x: 0, y: 5, rows: 2 },
        { id: "b", kind: "window", weight: 1, x: 1, y: 1, span: 2 },
        { id: "hidden", kind: "window", weight: 1, hidden: true, rows: 100 },
        { id: "c", kind: "window", weight: 1, rows: 3 },
        { id: "d", kind: "window", weight: 1 },
      ],
    },
  });

  expect([...result.rects]).toEqual([
    ["a", { x: 20, y: 80, width: 100, height: 20 }],
    ["b", { x: 120, y: 40, width: 200, height: 10 }],
    ["c", { x: 20, y: 100, width: 100, height: 30 }],
    ["d", { x: 20, y: 130, width: 100, height: 10 }],
  ]);
  expect(result.extent).toBe(110);
});
