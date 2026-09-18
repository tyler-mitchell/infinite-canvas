import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { getCanvasLayout } from "./layout";
import { reduceInfiniteCanvasState } from "./operations";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const pane = (id: string, x: number) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    minSize: { height: 80, width: 120 },
    rect: { height: 200, width: 300, x, y: x === 0 ? 0 : 40 },
    title: id,
  });

const withShellAndFloaters = (): InfiniteCanvasState<Kind> => {
  const base = {
    ...createInfiniteCanvasState<Kind>({
      windows: [pane("a", 0), pane("b", 400), pane("c", 800), pane("d", 1200)],
    }),
    viewport: { height: 800, width: 1600 },
  };
  const docked = reduceInfiniteCanvasState(
    { ...base, activeWindowId: "a" },
    { direction: "right", type: "window.dockDirection" },
  );

  expect(docked.groups).toHaveLength(1);

  return {
    ...docked,
    selection: {
      anchorTarget: { type: "window" as const, id: "a" },
      targets: [
        { type: "window" as const, id: "a" },
        { type: "window" as const, id: "b" },
        { type: "window" as const, id: "c" },
        { type: "window" as const, id: "d" },
      ],
    },
  };
};

const rectOf = (state: InfiniteCanvasState<Kind>, id: string) =>
  getCanvasLayout(state).windowRects.get(id);

test("nudging a selection moves a docked pane's whole shell", () => {
  const before = withShellAndFloaters();
  const after = reduceInfiniteCanvasState(before, {
    amountPx: 10,
    direction: "right",
    type: "window.nudge",
  });

  for (const id of ["a", "b", "c", "d"]) {
    expect(rectOf(after, id)?.x).toBeGreaterThan(rectOf(before, id)?.x ?? 0);
  }
});

test("a group moves once however many of its members are selected", () => {
  const before = withShellAndFloaters();
  const after = reduceInfiniteCanvasState(before, {
    amountPx: 10,
    direction: "right",
    type: "window.nudge",
  });
  const travelled = (id: string) => (rectOf(after, id)?.x ?? 0) - (rectOf(before, id)?.x ?? 0);

  expect(travelled("a")).toBeCloseTo(travelled("c"));
  expect(travelled("b")).toBeCloseTo(travelled("c"));
});

test("aligning the same selection skips the docked panes entirely", () => {
  const before = withShellAndFloaters();
  const after = reduceInfiniteCanvasState(before, { alignment: "left", type: "window.align" });

  expect(rectOf(after, "c")?.x).toBe(rectOf(after, "d")?.x);
  expect(rectOf(after, "a")).toStrictEqual(rectOf(before, "a"));
  expect(rectOf(after, "b")).toStrictEqual(rectOf(before, "b"));
});

test("the two families genuinely disagree about the same window", () => {
  const before = withShellAndFloaters();
  const nudged = reduceInfiniteCanvasState(before, {
    amountPx: 10,
    direction: "right",
    type: "window.nudge",
  });
  const aligned = reduceInfiniteCanvasState(before, { alignment: "left", type: "window.align" });

  expect(rectOf(nudged, "a")).not.toStrictEqual(rectOf(before, "a"));
  expect(rectOf(aligned, "a")).toStrictEqual(rectOf(before, "a"));
});
