import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * Membership is group-complete, so removing one pane alone is pulled straight back by
 * reconciliation. The whole shell comes off instead — the mirror of what `workspace-move` guards.
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

const oneDesktop = (): InfiniteCanvasState<Kind> => {
  const base = {
    ...createInfiniteCanvasState<Kind>({
      windows: [pane("a", 0), pane("b", 400), pane("c", 800)],
    }),
    viewport: { height: 800, width: 1200 },
  };

  return reduceInfiniteCanvasState(base, {
    title: "Research",
    type: "workspace.create",
    windowIds: ["a", "b", "c"],
    workspaceId: "research",
  });
};

const membership = (state: InfiniteCanvasState<Kind>, workspaceId: string) =>
  [...(state.workspaces.find((workspace) => workspace.id === workspaceId)?.windowIds ?? [])].sort();

/** Dock "a" rightward, which pulls "b" into a shell with it. */
const withShell = (): InfiniteCanvasState<Kind> => {
  const docked = reduceInfiniteCanvasState(
    { ...oneDesktop(), activeWindowId: "a", activeWorkspaceId: "research" },
    { command: { direction: "right", type: "window.dockDirection" }, type: "command.execute" },
  );

  expect(docked.groups).toHaveLength(1);

  return docked;
};

test("an undocked window comes off the desktop it was on", () => {
  const removed = reduceInfiniteCanvasState(
    { ...oneDesktop(), activeWindowId: "c", activeWorkspaceId: "research" },
    { command: { type: "workspace.removeActiveWindow" }, type: "command.execute" },
  );

  expect(membership(removed, "research")).toEqual(["a", "b"]);
});

test("removing a docked pane takes its whole shell off with it", () => {
  const removed = reduceInfiniteCanvasState(withShell(), {
    command: { type: "workspace.removeActiveWindow" },
    type: "command.execute",
  });

  // The failure guarded is the pane reappearing, not a wrong set.
  expect(membership(removed, "research")).not.toContain("a");
  expect(membership(removed, "research")).toEqual(["c"]);
});

test("what comes off the desktop stays open on the canvas", () => {
  // A membership filter must not delete what it filters.
  const removed = reduceInfiniteCanvasState(withShell(), {
    command: { type: "workspace.removeActiveWindow" },
    type: "command.execute",
  });

  expect(removed.windows.map((window) => window.id).sort()).toEqual(["a", "b", "c"]);
  expect(removed.groups).toHaveLength(1);
});

test("a window removed from the desktop you are standing on does not stay active", () => {
  // Otherwise every verb keyed to the active window aims at something no longer drawn.
  const removed = reduceInfiniteCanvasState(
    { ...withShell(), selection: { anchorWindowId: "a", windowIds: ["a"] } },
    { command: { type: "workspace.removeActiveWindow" }, type: "command.execute" },
  );

  expect(removed.activeWindowId).not.toBe("a");
  expect(removed.selection.windowIds).not.toContain("a");
});

test("removing a window that is not on the desktop changes nothing", () => {
  const state = {
    ...reduceInfiniteCanvasState(oneDesktop(), {
      title: "Writing",
      type: "workspace.create",
      windowIds: [],
      workspaceId: "writing",
    }),
    activeWindowId: "a",
    activeWorkspaceId: "writing",
  };

  expect(
    reduceInfiniteCanvasState(state, {
      command: { type: "workspace.removeActiveWindow" },
      type: "command.execute",
    }),
  ).toBe(state);
});
