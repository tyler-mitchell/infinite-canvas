import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * `createGroup` drops members that are missing, minimized or already grouped. These pin what a
 * caller can observe of that, since enablement is built on it.
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

const shellRect = { height: 400, width: 900, x: 0, y: 0 };

/** Four windows, "a" docked rightward into a shell with "b"; "c" and "d" stay floating. */
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
  // The baseline the rest are measured against.
  const made = group(withShell(), ["c", "d"]);

  expect(made.groups).toHaveLength(2);
});

test("grouping windows that are all already docked changes nothing", () => {
  // No members survive, so the state comes back identical.
  const before = withShell();
  const after = group(before, ["a", "b"]);

  expect(after.groups).toHaveLength(1);
  expect(after.groups).toBe(before.groups);
});

test("a mixed selection groups only the windows that were free", () => {
  const made = group(withShell(), ["a", "c", "d"]);
  const added = made.groups.find((candidate) => candidate.id === "made");

  expect(added).toBeDefined();
  // "a" stayed in the shell it was already in rather than being stolen into the new group.
  expect(made.groups).toHaveLength(2);
});

test("one surviving member still makes a group, so two selected is not the floor", () => {
  // The framework refuses zero, not fewer than two. Reachable whenever one of two is docked.
  const made = group(withShell(), ["a", "c"]);

  expect(made.groups).toHaveLength(2);
});
