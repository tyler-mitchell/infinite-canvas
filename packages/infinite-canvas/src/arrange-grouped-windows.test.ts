import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * What the selection verbs do when the selection holds a docked pane — and they disagree.
 *
 * `nudgeSelectedWindows` translates the pane's whole **shell**, because a member's rect is its
 * group's projection and writing it directly would be undone by the next solve; nudging is the
 * keyboard twin of dragging that member's header, which moves the shell too (DOCK-003).
 *
 * `getArrangeableWindows` takes the opposite route for align, distribute and swap: a docked pane is
 * **skipped**, and moving the shell instead is refused on the stated ground that it "would mean a
 * single command that sometimes moves one window and sometimes moves five".
 *
 * Both are defensible and both are deliberate. Neither is guessable from a description, and a
 * caller acting on a mixed selection gets opposite treatment from two verbs that read as siblings.
 * Pinned here so the asymmetry is a fact rather than a pair of comments, and so that a later attempt
 * to make them agree has to argue with a test.
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

  // Every member of the shell moved, including "b", which the nudge never named directly — it
  // moved because its shell did.
  for (const id of ["a", "b", "c", "d"]) {
    expect(rectOf(after, id)?.x).toBeGreaterThan(rectOf(before, id)?.x ?? 0);
  }
});

test("a group moves once however many of its members are selected", () => {
  /*
   * The trap the shell-first pass exists to avoid. `setInfiniteCanvasGroupRect` re-projects every
   * member, so a window pass that also translated members would move a two-member shell twice as
   * far as the floating windows beside it.
   */
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
  // Stated as one assertion rather than inferred across two tests, because the disagreement is the
  // thing worth knowing: "a" is the same window, in the same selection, under two sibling verbs.
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
