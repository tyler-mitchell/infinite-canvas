import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { getIndicatorTitle } from "./offscreen-indicators";
import type { WindowKind } from "./window-registry";

const state = (groupTitle: string | null) =>
  createInfiniteCanvasState<WindowKind>({
    groups: [
      {
        id: "group-1",
        rect: { height: 400, width: 600, x: 0, y: 0 },
        title: groupTitle,
        tree: {
          activeChildId: null,
          axis: "horizontal",
          children: [
            { id: "a", kind: "window", weight: 1 },
            { id: "b", kind: "window", weight: 1 },
          ],
          id: "container-1",
          kind: "container",
          layout: "split",
          weight: 1,
        },
        zIndex: 0,
      },
    ],
    viewport: { height: 800, width: 1200 },
    windows: [
      createInfiniteCanvasWindow<WindowKind>({
        id: "a",
        kind: "note",
        rect: { height: 200, width: 300, x: 0, y: 0 },
        title: "Sources",
      }),
      createInfiniteCanvasWindow<WindowKind>({
        id: "b",
        kind: "note",
        rect: { height: 200, width: 300, x: 300, y: 0 },
        title: "Draft",
      }),
    ],
  });

test("an unnamed group is pointed at by what is in it", () => {
  expect(getIndicatorTitle({ id: "group-1", kind: "group" }, state(null))).toBe("Sources & Draft");
});

test("a group somebody named is pointed at by that name", () => {
  expect(getIndicatorTitle({ id: "group-1", kind: "group" }, state("Reading list"))).toBe(
    "Reading list",
  );
});

test("the placeholder is still there for a group the lookup does not find", () => {
  expect(getIndicatorTitle({ id: "gone", kind: "group" }, state(null))).toBe("Group");
});

test("a window is pointed at by its own title", () => {
  expect(getIndicatorTitle({ id: "a", kind: "window" }, state(null))).toBe("Sources");
});

test("a window the lookup does not find keeps its own placeholder", () => {
  expect(getIndicatorTitle({ id: "gone", kind: "window" }, state(null))).toBe("Window");
});
