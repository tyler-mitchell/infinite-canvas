import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * Changing a group's layout and changing it back does not cost the panes their shares.
 *
 * Switching to tabs gives every member the shell's whole content rect, because that is what a tab
 * strip draws — and `syncInfiniteCanvasGroupWindowRects` writes solved rects onto the windows, so
 * the individual sizes are genuinely overwritten rather than merely hidden. The question a consumer
 * has is whether that is destructive, and the answer turns on where the proportions live: on the
 * tree's child weights, not on the rects.
 *
 * Worth pinning rather than reasoning about, because "the layout is a projection" is exactly the
 * kind of claim that stays true right up until something stores a rect.
 */

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

/** Give "a" a bigger share than "b", the way a seam drag would. */
const uneven = (state: InfiniteCanvasState<Kind>) =>
  reduceInfiniteCanvasState(state, {
    containerId: "shell",
    groupId: "shell",
    type: "group.setChildWeights",
    weights: { a: 2, b: 1 },
  });

const widths = (state: InfiniteCanvasState<Kind>) =>
  ["a", "b"].map((id) => state.windows.find((window) => window.id === id)?.rect.width);

test("a split gives its panes different widths once their weights differ", () => {
  // The premise. Equal weights would make the round trip below prove nothing.
  const [first, second] = widths(uneven(splitShell()));

  expect(first).toBeDefined();
  expect(first).not.toBe(second);
});

test("tabs overwrite those widths, which is what makes the question real", () => {
  const tabbed = widths(setLayout(uneven(splitShell()), "tabs"));

  expect(tabbed[0]).toBe(tabbed[1]);
});

test("switching back to a split restores the shares", () => {
  /*
   * The proportions survive because they live on the tree's child weights, and only the rects are
   * re-solved. If a layout change ever wrote weights instead of reading them, this is what would
   * catch it — and the failure would be silent, since the tabbed view looks correct either way.
   */
  const before = uneven(splitShell());
  const roundTripped = setLayout(setLayout(before, "tabs"), "split");

  expect(widths(roundTripped)).toStrictEqual(widths(before));
});

test("an accordion round trip costs nothing either", () => {
  const before = uneven(splitShell());
  const roundTripped = setLayout(setLayout(before, "accordion"), "split");

  expect(widths(roundTripped)).toStrictEqual(widths(before));
});
