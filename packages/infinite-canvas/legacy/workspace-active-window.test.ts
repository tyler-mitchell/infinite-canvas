import { getSelectedWindowIds } from "./selection";
import { expect, test } from "vite-plus/test";

import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  reconcileInfiniteCanvasState,
} from "./factory";
import { reduceInfiniteCanvasState } from "./operations";
import type { InfiniteCanvasState } from "./types";
import { moveInfiniteCanvasWindowsToWorkspace } from "./workspace";

type Kind = "note";

const pane = (id: string) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x: 0, y: 0 },
    title: id,
  });

const standingOnHere = (): InfiniteCanvasState<Kind> => {
  const base = {
    ...createInfiniteCanvasState<Kind>({ windows: [pane("a"), pane("b")] }),
    viewport: { height: 800, width: 1200 },
  };
  const withDesktops = reduceInfiniteCanvasState(
    reduceInfiniteCanvasState(base, {
      title: "Here",
      activate: false,
      type: "workspace.create",
      windowIds: ["a", "b"],
      workspaceId: "here",
    }),
    {
      activate: false,
      title: "There",
      type: "workspace.create",
      windowIds: [],
      workspaceId: "there",
    },
  );
  const onHere = reduceInfiniteCanvasState(withDesktops, {
    type: "workspace.activate",
    workspaceId: "here",
  });

  return reduceInfiniteCanvasState(onHere, { type: "window.focus", windowId: "a" });
};

test("filing the active window onto another desktop stops it being active here", () => {
  const before = standingOnHere();

  expect(before.activeWindowId).toBe("a");

  const after = reduceInfiniteCanvasState(before, {
    type: "workspace.moveWindows",
    windowIds: ["a"],
    workspaceId: "there",
  });

  expect(after.workspaces.find((workspace) => workspace.id === "there")?.windowIds).toContain("a");
  expect(after.activeWindowId).not.toBe("a");
  expect(getSelectedWindowIds(after.selection)).not.toContain("a");
});

test("removing the active window from this desktop stops it being active", () => {
  const before = standingOnHere();
  const after = reduceInfiniteCanvasState(before, {
    type: "workspace.removeWindow",
    windowId: "a",
    workspaceId: "here",
  });

  expect(after.activeWindowId).not.toBe("a");
  expect(getSelectedWindowIds(after.selection)).not.toContain("a");
});

test("the membership writer leaves the active window stale; reconciliation is what clears it", () => {
  const before = standingOnHere();
  const written = moveInfiniteCanvasWindowsToWorkspace(before, {
    windowIds: ["a"],
    workspaceId: "there",
  });

  expect(written.workspaces.find((workspace) => workspace.id === "here")?.windowIds).not.toContain(
    "a",
  );
  expect(written.activeWindowId).toBe("a");
  expect(
    reconcileInfiniteCanvasState({ state: written, previousState: before }).activeWindowId,
  ).not.toBe("a");
});

test("a window this desktop still admits stays active", () => {
  const before = standingOnHere();
  const after = reduceInfiniteCanvasState(before, {
    type: "workspace.moveWindows",
    windowIds: ["b"],
    workspaceId: "there",
  });

  expect(after.activeWindowId).toBe("a");
});
