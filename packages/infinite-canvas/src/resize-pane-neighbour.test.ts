import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * Which neighbour a pane takes its share from, which is a rule with an exception.
 *
 * A pane grows by pushing the seam *after* it, so the share comes from the next pane along. The
 * last pane has no seam after it and pushes the one before instead — `resolveInfiniteCanvasPaneSeam`
 * carries that as `grows: +1 | -1`.
 *
 * The descriptions said only "the pane beside it", which is not wrong and is not usable: with three
 * panes and the middle one active, a caller cannot tell whether growing costs the pane on the left
 * or the one on the right, and the answer changes at the end of the row. Anyone wanting the *other*
 * neighbour has to make that one active and shrink it instead, which is only discoverable once the
 * rule is stated.
 */

type Kind = "note";

const pane = (id: string, x: number) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    minSize: { height: 40, width: 40 },
    rect: { height: 200, width: 300, x, y: 0 },
    title: id,
  });

/** Three panes in one horizontal split: a, b, c. */
const row = (activeWindowId: string): InfiniteCanvasState<Kind> => {
  const base = {
    ...createInfiniteCanvasState<Kind>({ windows: [pane("a", 0), pane("b", 400), pane("c", 800)] }),
    viewport: { height: 800, width: 1200 },
  };
  const grouped = reduceInfiniteCanvasState(base, {
    groupId: "shell",
    rect: { height: 400, width: 900, x: 0, y: 0 },
    type: "group.create",
    windowIds: ["a", "b", "c"],
  });

  expect(grouped.groups).toHaveLength(1);

  return { ...grouped, activeWindowId };
};

const grow = (state: InfiniteCanvasState<Kind>) =>
  reduceInfiniteCanvasState(state, {
    command: { amountPx: 24, type: "group.resizePane" },
    type: "command.execute",
  });

const widths = (state: InfiniteCanvasState<Kind>) =>
  Object.fromEntries(
    ["a", "b", "c"].map((id) => [
      id,
      Math.round(state.windows.find((window) => window.id === id)?.rect.width ?? 0),
    ]),
  );

test("a middle pane grows at the expense of the next one along, not the previous", () => {
  const before = widths(row("b"));
  const after = widths(grow(row("b")));

  expect(after.b).toBeGreaterThan(before.b);
  expect(after.c).toBeLessThan(before.c);
  // The half a caller cannot guess: the pane on the other side is untouched.
  expect(after.a).toBe(before.a);
});

test("the last pane has no next one, so it takes from the previous", () => {
  const before = widths(row("c"));
  const after = widths(grow(row("c")));

  expect(after.c).toBeGreaterThan(before.c);
  expect(after.b).toBeLessThan(before.b);
  expect(after.a).toBe(before.a);
});

test("the first pane follows the ordinary rule", () => {
  // Stated so the exception is pinned to the *end* of the row rather than to either edge.
  const before = widths(row("a"));
  const after = widths(grow(row("a")));

  expect(after.a).toBeGreaterThan(before.a);
  expect(after.b).toBeLessThan(before.b);
  expect(after.c).toBe(before.c);
});

test("growing never changes the container's total width", () => {
  // A share moves between two panes; it is not created. Without this the assertions above would
  // pass on a verb that grew one pane and widened the shell to fit it.
  const before = widths(row("b"));
  const after = widths(grow(row("b")));
  const total = (entry: Record<string, number>) => entry.a + entry.b + entry.c;

  expect(total(after)).toBeCloseTo(total(before), 0);
});
