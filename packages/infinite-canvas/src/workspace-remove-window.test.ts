import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * Taking a window off a desktop, when that window is docked into a shell.
 *
 * The mirror of the trap `workspace-move.test.ts` guards. Membership is group-complete and
 * `reconcileInfiniteCanvasWorkspaces` re-expands every workspace after every action, so removing
 * one pane while its siblings stayed behind has reconciliation pull the pane straight back — the
 * remove appears to do nothing at all, and nothing in the command's sentence says it would.
 *
 * Whole shell rather than a refusal, for the reason `normalizeInfiniteCanvasWorkspaceWindowIds`
 * already gives about the other direction: the honest reading of "take this off the desktop"
 * includes the thing the window is docked into.
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

  // The failure this guards is not a wrong set — it is the pane reappearing, so the command
  // reads as broken.
  expect(membership(removed, "research")).not.toContain("a");
  expect(membership(removed, "research")).toEqual(["c"]);
});

test("what comes off the desktop stays open on the canvas", () => {
  // A membership filter that deleted what it filtered would make "which set is this in" a
  // destructive question.
  const removed = reduceInfiniteCanvasState(withShell(), {
    command: { type: "workspace.removeActiveWindow" },
    type: "command.execute",
  });

  expect(removed.windows.map((window) => window.id).sort()).toEqual(["a", "b", "c"]);
  expect(removed.groups).toHaveLength(1);
});

test("a window removed from the desktop you are standing on does not stay active", () => {
  // The rule `reconcileActiveAgainstMembership` states: every verb keyed to the active window
  // would otherwise aim at something the canvas has stopped drawing.
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
