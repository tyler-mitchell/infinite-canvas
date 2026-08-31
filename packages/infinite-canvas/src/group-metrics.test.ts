import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { DEFAULT_INFINITE_CANVAS_GROUP_METRICS } from "./group-layout";
import { getInfiniteCanvasGroupProjection } from "./group-state";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasGroup, InfiniteCanvasState } from "./types";

const TABS_GROUP: InfiniteCanvasGroup = {
  id: "group-1",
  rect: { height: 400, width: 600, x: 0, y: 0 },
  title: "Group",
  tree: {
    activeChildId: "a",
    axis: "horizontal",
    children: [
      { id: "a", kind: "window", weight: 1 },
      { id: "b", kind: "window", weight: 1 },
    ],
    id: "container-1",
    kind: "container",
    layout: "tabs",
    weight: 1,
  },
  zIndex: 0,
};

const seed = (): InfiniteCanvasState<"demo"> =>
  createInfiniteCanvasState<"demo">({
    groups: [TABS_GROUP],
    windows: ["a", "b"].map((id) =>
      createInfiniteCanvasWindow({
        id,
        kind: "demo",
        rect: { height: 200, width: 300, x: 0, y: 0 },
      }),
    ),
  });

test("state carries the default metrics when a consumer names none", () => {
  expect(seed().groupMetrics).toEqual(DEFAULT_INFINITE_CANVAS_GROUP_METRICS);
});

test("a named size lands in state and the rest keep their defaults", () => {
  const state = createInfiniteCanvasState<"demo">({
    groupMetrics: { tabStripSize: 48 },
    windows: [],
  });

  expect(state.groupMetrics).toEqual({
    ...DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
    tabStripSize: 48,
  });
});

test("the tab strip's height is what a member's rect is placed below", () => {
  const shortStrip = seed();
  const tallStrip = createInfiniteCanvasState<"demo">({
    ...shortStrip,
    groupMetrics: { tabStripSize: DEFAULT_INFINITE_CANVAS_GROUP_METRICS.tabStripSize + 40 },
  });
  const memberTop = (state: InfiniteCanvasState<"demo">) =>
    getInfiniteCanvasGroupProjection(state.groups, state.groupMetrics).windowRects.get("a")?.y;

  expect(memberTop(tallStrip)).toBe((memberTop(shortStrip) ?? 0) + 40);
});

test("setting the metrics re-places the members there and then", () => {
  const before = seed();
  const after = reduceInfiniteCanvasState(before, {
    metrics: { ...DEFAULT_INFINITE_CANVAS_GROUP_METRICS, tabStripSize: 90 },
    type: "groupMetrics.set",
  });
  const top = (state: InfiniteCanvasState<"demo">) =>
    state.windows.find((window) => window.id === "a")?.rect.y;

  expect(after.groupMetrics.tabStripSize).toBe(90);
  expect(top(after)).toBe(
    (top(before) ?? 0) + (90 - DEFAULT_INFINITE_CANVAS_GROUP_METRICS.tabStripSize),
  );
});
