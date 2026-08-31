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

const shellRect = { height: 400, width: 900, x: 0, y: 0 };

const withShell = (): InfiniteCanvasState<Kind> => {
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

  return docked;
};

const group = (state: InfiniteCanvasState<Kind>, windowIds: readonly string[]) =>
  reduceInfiniteCanvasState(state, {
    groupId: "made",
    rect: shellRect,
    type: "group.create",
    windowIds,
  });

test("grouping two floating windows makes a group", () => {
  const made = group(withShell(), ["c", "d"]);

  expect(made.groups).toHaveLength(2);
});

test("grouping windows that are all already docked changes nothing", () => {
  const before = withShell();
  const after = group(before, ["a", "b"]);

  expect(after.groups).toHaveLength(1);
  expect(after.groups).toBe(before.groups);
});

test("a mixed selection groups only the windows that were free", () => {
  const made = group(withShell(), ["a", "c", "d"]);
  const added = made.groups.find((candidate) => candidate.id === "made");

  expect(added).toBeDefined();
  expect(made.groups).toHaveLength(2);
});

test("one surviving member still makes a group, so two selected is not the floor", () => {
  const made = group(withShell(), ["a", "c"]);

  expect(made.groups).toHaveLength(2);
});
