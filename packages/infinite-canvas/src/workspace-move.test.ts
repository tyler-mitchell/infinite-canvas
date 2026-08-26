import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * Moving a window between desktops.
 *
 * The operation a virtual desktop exists for, and the one `addWindow` and `removeWindow` could
 * not express between them: two dispatches are two undo entries, and the window is on both
 * desktops in between.
 *
 * The subtle half is groups. Membership is group-complete and
 * `reconcileInfiniteCanvasWorkspaces` re-expands every workspace after every action, so moving
 * one pane of a docked shell while its siblings stayed behind would have reconciliation pull the
 * moved pane straight back into the desktop it just left. That is asserted here rather than
 * argued, because it is the failure that would look like the move silently not working.
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

/** Two desktops: everything starts on Research. */
const twoDesktops = (): InfiniteCanvasState<Kind> => {
  const base = {
    ...createInfiniteCanvasState<Kind>({
      windows: [pane("a", 0), pane("b", 400), pane("c", 800)],
    }),
    viewport: { height: 800, width: 1200 },
  };
  const research = reduceInfiniteCanvasState(base, {
    title: "Research",
    type: "workspace.create",
    windowIds: ["a", "b", "c"],
    workspaceId: "research",
  });

  return reduceInfiniteCanvasState(research, {
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
  const before = twoDesktops();
  const moved = reduceInfiniteCanvasState(before, {
    type: "workspace.moveWindows",
    windowIds: ["a"],
    workspaceId: "writing",
  });

  expect(moved.history.past).toHaveLength(before.history.past.length + 1);
});

test("moving a docked pane takes its whole shell with it", () => {
  // The trap. `reconcileInfiniteCanvasWorkspaces` re-expands membership to whole groups after
  // every action, so a move that left "b" behind on Research would see "a" dragged back and the
  // move would appear to do nothing at all.
  const docked = reduceInfiniteCanvasState(
    { ...twoDesktops(), activeWindowId: "a" },
    { command: { direction: "right", type: "window.dockDirection" }, type: "command.execute" },
  );

  expect(docked.groups).toHaveLength(1);

  const moved = reduceInfiniteCanvasState(docked, {
    type: "workspace.moveWindows",
    windowIds: ["a"],
    workspaceId: "writing",
  });
  const shell = docked.groups[0];

  expect(shell).toBeDefined();
  // Every member of the shell moved, and none of them stayed behind.
  for (const windowId of membership(moved, "writing")) {
    expect(membership(moved, "research")).not.toContain(windowId);
  }

  expect(membership(moved, "writing").length).toBeGreaterThan(1);
});

test("a move that changes nothing returns the identical document", () => {
  // Reference equality is the change test throughout this codebase, so a no-op move must not
  // land a history entry.
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
  /*
   * The reason this verb takes a set. Filing three windows used to be three dispatches, which is
   * three undo entries for one gesture — and the desktop is half-populated at each step, so undoing
   * "put these on that desktop" takes three undos and passes through two states nobody asked for.
   */
  const before = twoDesktops();
  const moved = reduceInfiniteCanvasState(before, {
    type: "workspace.moveWindows",
    windowIds: ["a", "b", "c"],
    workspaceId: "writing",
  });

  expect(membership(moved, "writing")).toEqual(["a", "b", "c"]);
  expect(membership(moved, "research")).toEqual([]);
  expect(moved.history.past).toHaveLength(before.history.past.length + 1);
});

test("one undo puts a whole filed selection back", () => {
  // The half that matters to a person: the edit is one, so its reversal is one.
  const before = twoDesktops();
  const moved = reduceInfiniteCanvasState(before, {
    type: "workspace.moveWindows",
    windowIds: ["a", "b", "c"],
    workspaceId: "writing",
  });
  const undone = reduceInfiniteCanvasState(moved, {
    command: { type: "history.undo" },
    type: "command.execute",
  });

  expect(membership(undone, "research")).toEqual(["a", "b", "c"]);
  expect(membership(undone, "writing")).toEqual([]);
});

test("the set is normalized as a whole: duplicates, dead ids, and an empty set", () => {
  const state = twoDesktops();
  const moved = reduceInfiniteCanvasState(state, {
    type: "workspace.moveWindows",
    // "a" twice and a window that does not exist — neither should reach membership.
    windowIds: ["a", "a", "ghost"],
    workspaceId: "writing",
  });

  expect(membership(moved, "writing")).toEqual(["a"]);
  // An empty set is a no-op rather than a move of nothing, so it lands no history entry.
  expect(
    reduceInfiniteCanvasState(state, {
      type: "workspace.moveWindows",
      windowIds: [],
      workspaceId: "writing",
    }),
  ).toBe(state);
});

test("moving the active window off the desktop you are on does not leave it active", () => {
  /*
   * The rule `activateInfiniteCanvasWorkspace` already states, applied to the other direction.
   * Entering a desktop drops an active window it does not admit, because "every verb keyed to the
   * active window would act on something the user cannot see". Moving that window *away* while you
   * stand still puts you in exactly the same position, and membership changes do not touch
   * `activeWindowId` or the selection.
   *
   * Reachable in one click now that a selection can be filed onto another desktop.
   */
  const standing = {
    ...twoDesktops(),
    activeWindowId: "a",
    activeWorkspaceId: "research",
    selection: { anchorWindowId: "a", windowIds: ["a"] },
  };
  const moved = reduceInfiniteCanvasState(standing, {
    type: "workspace.moveWindows",
    windowIds: ["a"],
    workspaceId: "writing",
  });

  expect(membership(moved, "writing")).toEqual(["a"]);
  expect(moved.activeWindowId).not.toBe("a");
  expect(moved.selection.windowIds).not.toContain("a");
});

test("the command sends the active window, and works from show-all", () => {
  // Unlike `removeActiveWindow`, this is reachable with no desktop active — a window on no
  // desktop is exactly the one you most want to file onto one.
  const showingAll = { ...twoDesktops(), activeWindowId: "c", activeWorkspaceId: null };
  const moved = reduceInfiniteCanvasState(showingAll, {
    command: { type: "workspace.moveActiveWindow", workspaceId: "writing" },
    type: "command.execute",
  });

  expect(membership(moved, "writing")).toEqual(["c"]);
  expect(membership(moved, "research")).toEqual(["a", "b"]);
});
