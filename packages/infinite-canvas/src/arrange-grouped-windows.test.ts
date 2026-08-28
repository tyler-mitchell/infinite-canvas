import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * Nudge moves a docked pane's whole shell; align, distribute and swap skip the pane. Both
 * deliberate, so an attempt to make them agree has to argue with a test.
 */

type Kind = "note";

const pane = (id: string, x: number) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    minSize: { height: 80, width: 120 },
    rect: { height: 200, width: 300, x, y: x === 0 ? 0 : 40 },
    title: id,
  });

/** Four windows, "a" docked rightward into a shell with "b", "c" and "d" left floating. */
const withShellAndFloaters = (): InfiniteCanvasState<Kind> => {
  const base = {
    ...createInfiniteCanvasState<Kind>({
      windows: [pane("a", 0), pane("b", 400), pane("c", 800), pane("d", 1200)],
    }),
    viewport: { height: 800, width: 1600 },
  };
  const docked = reduceInfiniteCanvasState(
    { ...base, activeWindowId: "a" },
    { command: { direction: "right", type: "window.dockDirection" }, type: "command.execute" },
  );

  expect(docked.groups).toHaveLength(1);

  return {
    ...docked,
    selection: { anchorWindowId: "a", windowIds: ["a", "b", "c", "d"] },
  };
};

const rectOf = (state: InfiniteCanvasState<Kind>, id: string) =>
  state.windows.find((window) => window.id === id)?.rect;

test("nudging a selection moves a docked pane's whole shell", () => {
  const before = withShellAndFloaters();
  const after = reduceInfiniteCanvasState(before, {
    command: { amountPx: 10, direction: "right", type: "window.nudge" },
    type: "command.execute",
  });

  // "b" moved too, and the nudge never named it.
  for (const id of ["a", "b", "c", "d"]) {
    expect(rectOf(after, id)?.x).toBeGreaterThan(rectOf(before, id)?.x ?? 0);
  }
});

test("a group moves once however many of its members are selected", () => {
  // The shell-first pass exists so members are not translated twice.
  const before = withShellAndFloaters();
  const after = reduceInfiniteCanvasState(before, {
    command: { amountPx: 10, direction: "right", type: "window.nudge" },
    type: "command.execute",
  });
  const travelled = (id: string) => (rectOf(after, id)?.x ?? 0) - (rectOf(before, id)?.x ?? 0);

  expect(travelled("a")).toBeCloseTo(travelled("c"));
  expect(travelled("b")).toBeCloseTo(travelled("c"));
});

test("aligning the same selection skips the docked panes entirely", () => {
  const before = withShellAndFloaters();
  const after = reduceInfiniteCanvasState(before, {
    command: { alignment: "left", type: "window.align" },
    type: "command.execute",
  });

  // The floaters align to each other; the shell's members are not theirs to move.
  expect(rectOf(after, "c")?.x).toBe(rectOf(after, "d")?.x);
  expect(rectOf(after, "a")).toStrictEqual(rectOf(before, "a"));
  expect(rectOf(after, "b")).toStrictEqual(rectOf(before, "b"));
});

test("the two families genuinely disagree about the same window", () => {
  // Same window, same selection, two sibling verbs.
  const before = withShellAndFloaters();
  const nudged = reduceInfiniteCanvasState(before, {
    command: { amountPx: 10, direction: "right", type: "window.nudge" },
    type: "command.execute",
  });
  const aligned = reduceInfiniteCanvasState(before, {
    command: { alignment: "left", type: "window.align" },
    type: "command.execute",
  });

  expect(rectOf(nudged, "a")).not.toStrictEqual(rectOf(before, "a"));
  expect(rectOf(aligned, "a")).toStrictEqual(rectOf(before, "a"));
});
