import { getSelectedWindowIds } from "./selection";
import { expect, test } from "vite-plus/test";
import { createInfiniteCanvasStore } from "./store";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./operations";
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

const twoDesktops = (): InfiniteCanvasState<Kind> => {
  const base = {
    ...createInfiniteCanvasState<Kind>({
      windows: [pane("a", 0), pane("b", 400), pane("c", 800)],
    }),
    viewport: { height: 800, width: 1200 },
  };
  const research = reduceInfiniteCanvasState(base, {
    activate: false,
    title: "Research",
    type: "workspace.create",
    windowIds: ["a", "b", "c"],
    workspaceId: "research",
  });

  return reduceInfiniteCanvasState(research, {
    activate: false,
    title: "Writing",
    type: "workspace.create",
    windowIds: [],
    workspaceId: "writing",
  });
};

const membership = (state: InfiniteCanvasState<Kind>, workspaceId: string) =>
  [...(state.workspaces.find((workspace) => workspace.id === workspaceId)?.windowIds ?? [])].sort();

test("a moved window joins the target and leaves the one it was on", () => {
  const moved = reduceInfiniteCanvasState(twoDesktops(), {
    type: "workspace.moveWindows",
    windowIds: ["a"],
    workspaceId: "writing",
  });

  expect(membership(moved, "writing")).toEqual(["a"]);
  expect(membership(moved, "research")).toEqual(["b", "c"]);
});

test("moving is one edit, not a remove and an add", () => {
  const store = createInfiniteCanvasStore({ initialState: twoDesktops() });
  store.dispatch({
    type: "workspace.moveWindows",
    windowIds: ["a"],
    workspaceId: "writing",
  });

  expect(store.history.undos$.peek()).toBe(1);
});

test("moving a docked pane takes its whole shell with it", () => {
  const docked = reduceInfiniteCanvasState(
    { ...twoDesktops(), activeWindowId: "a" },
    { direction: "right", type: "window.dockDirection" },
  );

  expect(docked.groups).toHaveLength(1);

  const moved = reduceInfiniteCanvasState(docked, {
    type: "workspace.moveWindows",
    windowIds: ["a"],
    workspaceId: "writing",
  });
  const shell = docked.groups[0];

  expect(shell).toBeDefined();
  for (const windowId of membership(moved, "writing")) {
    expect(membership(moved, "research")).not.toContain(windowId);
  }

  expect(membership(moved, "writing").length).toBeGreaterThan(1);
});

test("a move that changes nothing returns the identical document", () => {
  const state = twoDesktops();

  expect(
    reduceInfiniteCanvasState(state, {
      type: "workspace.moveWindows",
      windowIds: ["a"],
      workspaceId: "research",
    }).workspaces,
  ).toBe(state.workspaces);
});

test("moving to a desktop that does not exist changes nothing", () => {
  const state = twoDesktops();

  expect(
    reduceInfiniteCanvasState(state, {
      type: "workspace.moveWindows",
      windowIds: ["a"],
      workspaceId: "nowhere",
    }),
  ).toBe(state);
});

test("a whole selection files in one edit, not one per window", () => {
  const store = createInfiniteCanvasStore({ initialState: twoDesktops() });
  store.dispatch({
    type: "workspace.moveWindows",
    windowIds: ["a", "b", "c"],
    workspaceId: "writing",
  });

  expect(membership(store.getState(), "writing")).toEqual(["a", "b", "c"]);
  expect(membership(store.getState(), "research")).toEqual([]);
  expect(store.history.undos$.peek()).toBe(1);
});

test("one undo puts a whole filed selection back", () => {
  const store = createInfiniteCanvasStore({ initialState: twoDesktops() });
  store.dispatch({
    type: "workspace.moveWindows",
    windowIds: ["a", "b", "c"],
    workspaceId: "writing",
  });
  expect(membership(store.getState(), "writing")).toEqual(["a", "b", "c"]);
  store.dispatch({ type: "history.undo" });
  const undone = store.getState();

  expect(membership(undone, "research")).toEqual(["a", "b", "c"]);
  expect(membership(undone, "writing")).toEqual([]);
});

test("the set is normalized as a whole: duplicates, dead ids, and an empty set", () => {
  const state = twoDesktops();
  const moved = reduceInfiniteCanvasState(state, {
    type: "workspace.moveWindows",
    windowIds: ["a", "a", "ghost"],
    workspaceId: "writing",
  });

  expect(membership(moved, "writing")).toEqual(["a"]);
  expect(
    reduceInfiniteCanvasState(state, {
      type: "workspace.moveWindows",
      windowIds: [],
      workspaceId: "writing",
    }),
  ).toBe(state);
});

test("moving the active window off the desktop you are on does not leave it active", () => {
  const standing = {
    ...twoDesktops(),
    activeWindowId: "a",
    activeWorkspaceId: "research",
    selection: {
      anchorTarget: { type: "window" as const, id: "a" },
      targets: [{ type: "window" as const, id: "a" }],
    },
  };
  const moved = reduceInfiniteCanvasState(standing, {
    type: "workspace.moveWindows",
    windowIds: ["a"],
    workspaceId: "writing",
  });

  expect(membership(moved, "writing")).toEqual(["a"]);
  expect(moved.activeWindowId).not.toBe("a");
  expect(getSelectedWindowIds(moved.selection)).not.toContain("a");
});

test("the command sends the active window, and works from show-all", () => {
  const showingAll = reduceInfiniteCanvasState(
    { ...twoDesktops(), activeWorkspaceId: null },
    { type: "selection.replace", targets: [{ type: "window" as const, id: "c" }] },
  );
  const moved = reduceInfiniteCanvasState(showingAll, {
    type: "workspace.moveActiveWindow",
    workspaceId: "writing",
  });

  expect(membership(moved, "writing")).toEqual(["c"]);
  expect(membership(moved, "research")).toEqual(["a", "b"]);
});
