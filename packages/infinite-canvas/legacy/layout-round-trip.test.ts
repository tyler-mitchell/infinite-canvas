import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./operations";
import { getCanvasLayout } from "./layout";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const pane = (id: string, x: number) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    minSize: { height: 80, width: 120 },
    rect: { height: 200, width: 300, x, y: 0 },
    title: id,
  });

const splitShell = (): InfiniteCanvasState<Kind> => {
  const base = {
    ...createInfiniteCanvasState<Kind>({ windows: [pane("a", 0), pane("b", 400)] }),
    viewport: { height: 800, width: 1200 },
  };

  return reduceInfiniteCanvasState(base, {
    groupId: "shell",
    rect: { height: 400, width: 900, x: 0, y: 0 },
    type: "group.create",
    windowIds: ["a", "b"],
  });
};

const setLayout = (state: InfiniteCanvasState<Kind>, layout: "accordion" | "split" | "tabs") =>
  reduceInfiniteCanvasState(state, {
    containerId: "shell",
    groupId: "shell",
    layout,
    type: "group.setLayoutMode",
  });

const uneven = (state: InfiniteCanvasState<Kind>) =>
  reduceInfiniteCanvasState(state, {
    containerId: "shell",
    groupId: "shell",
    type: "group.setChildWeights",
    weights: { a: 2, b: 1 },
  });

const widths = (state: InfiniteCanvasState<Kind>) => {
  const rects = getCanvasLayout(state).windowRects;
  return ["a", "b"].map((id) => rects.get(id)!.width);
};

test("a split gives its panes different widths once their weights differ", () => {
  const [first, second] = widths(uneven(splitShell()));

  expect(first).toBeDefined();
  expect(first).not.toBe(second);
});

test("tab panes share the container width", () => {
  const tabbed = widths(setLayout(uneven(splitShell()), "tabs"));

  expect(tabbed[0]).toBe(tabbed[1]);
});

test("switching back to a split restores the shares", () => {
  const before = uneven(splitShell());
  const roundTripped = setLayout(setLayout(before, "tabs"), "split");

  expect(widths(roundTripped)).toStrictEqual(widths(before));
});

test("an accordion round trip costs nothing either", () => {
  const before = uneven(splitShell());
  const roundTripped = setLayout(setLayout(before, "accordion"), "split");

  expect(widths(roundTripped)).toStrictEqual(widths(before));
});
