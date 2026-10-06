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
    minSize: { height: 40, width: 40 },
    rect: { height: 200, width: 300, x, y: 0 },
    title: id,
  });

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

  return reduceInfiniteCanvasState(grouped, {
    type: "selection.replace",
    targets: [{ type: "window", id: activeWindowId }],
  });
};

const grow = (state: InfiniteCanvasState<Kind>) =>
  reduceInfiniteCanvasState(state, { amountPx: 24, type: "group.resizePane" });

const widths = (state: InfiniteCanvasState<Kind>) => {
  const rects = getCanvasLayout(state).windowRects;
  return Object.fromEntries(["a", "b", "c"].map((id) => [id, Math.round(rects.get(id)!.width)]));
};

test("a middle pane grows at the expense of the next one along, not the previous", () => {
  const before = widths(row("b"));
  const after = widths(grow(row("b")));

  expect(after.b).toBeGreaterThan(before.b);
  expect(after.c).toBeLessThan(before.c);
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
  const before = widths(row("a"));
  const after = widths(grow(row("a")));

  expect(after.a).toBeGreaterThan(before.a);
  expect(after.b).toBeLessThan(before.b);
  expect(after.c).toBe(before.c);
});

test("growing never changes the container's total width", () => {
  const before = widths(row("b"));
  const after = widths(grow(row("b")));
  const total = (entry: Record<string, number>) => entry.a + entry.b + entry.c;

  expect(total(after)).toBeCloseTo(total(before), 0);
});
