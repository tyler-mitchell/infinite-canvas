import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
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

const tabbedShell = (): InfiniteCanvasState<Kind> => {
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
  const tabbed = reduceInfiniteCanvasState(grouped, {
    containerId: "shell",
    groupId: "shell",
    layout: "tabs",
    type: "group.setLayoutMode",
  });

  expect(tabbed.groups).toHaveLength(1);

  return tabbed;
};

const rects = (state: InfiniteCanvasState<Kind>) =>
  ["a", "b", "c"].map((id) => state.windows.find((window) => window.id === id)?.rect);

const distinctOrigins = (state: InfiniteCanvasState<Kind>) =>
  new Set(rects(state).map((rect) => `${String(rect?.x)},${String(rect?.y)}`)).size;

test("tab members share one rect while they are docked", () => {
  expect(distinctOrigins(tabbedShell())).toBe(1);
});

test("the command leaves three windows somewhere each can be seen", () => {
  const dissolved = reduceInfiniteCanvasState(
    { ...tabbedShell(), activeWindowId: "a" },
    { command: { type: "group.dissolve" }, type: "command.execute" },
  );

  expect(dissolved.groups).toHaveLength(0);
  expect(distinctOrigins(dissolved)).toBe(3);
});

test("the action does too, which is the parity that was missing", () => {
  const dissolved = reduceInfiniteCanvasState(tabbedShell(), {
    groupId: "shell",
    type: "group.close",
  });

  expect(dissolved.groups).toHaveLength(0);
  expect(distinctOrigins(dissolved)).toBe(3);
});

test("a split's panes are not moved by either route", () => {
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
  const dissolved = reduceInfiniteCanvasState(grouped, { groupId: "shell", type: "group.close" });

  expect(rects(dissolved)).toStrictEqual(rects(grouped));
});
