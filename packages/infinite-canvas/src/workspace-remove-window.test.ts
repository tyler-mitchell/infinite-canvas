import { getSelectedWindowIds } from "./selection";
import { expect, test } from "vite-plus/test";

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

const withShell = (): InfiniteCanvasState<Kind> => {
  const docked = reduceInfiniteCanvasState(
    { ...oneDesktop(), activeWindowId: "a", activeWorkspaceId: "research" },
    { direction: "right", type: "window.dockDirection" },
  );

  expect(docked.groups).toHaveLength(1);

  return docked;
};

test("an undocked window comes off the desktop it was on", () => {
  const removed = reduceInfiniteCanvasState(
    { ...oneDesktop(), activeWindowId: "c", activeWorkspaceId: "research" },
    { type: "workspace.removeActiveWindow" },
  );

  expect(membership(removed, "research")).toEqual(["a", "b"]);
});

test("removing a docked pane takes its whole shell off with it", () => {
  const removed = reduceInfiniteCanvasState(withShell(), { type: "workspace.removeActiveWindow" });

  expect(membership(removed, "research")).not.toContain("a");
  expect(membership(removed, "research")).toEqual(["c"]);
});

test("what comes off the desktop stays open on the canvas", () => {
  const removed = reduceInfiniteCanvasState(withShell(), { type: "workspace.removeActiveWindow" });

  expect(removed.windows.map((window) => window.id).sort()).toEqual(["a", "b", "c"]);
  expect(removed.groups).toHaveLength(1);
});

test("a window removed from the desktop you are standing on does not stay active", () => {
  const removed = reduceInfiniteCanvasState(
    {
      ...withShell(),
      selection: {
        anchorTarget: { type: "window" as const, id: "a" },
        targets: [{ type: "window" as const, id: "a" }],
      },
    },
    { type: "workspace.removeActiveWindow" },
  );

  expect(removed.activeWindowId).not.toBe("a");
  expect(getSelectedWindowIds(removed.selection)).not.toContain("a");
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

  expect(reduceInfiniteCanvasState(state, { type: "workspace.removeActiveWindow" })).toBe(state);
});
