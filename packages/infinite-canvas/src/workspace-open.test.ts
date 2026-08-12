import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";
import { isInfiniteCanvasWindowInActiveWorkspace } from "./workspace-membership";

/**
 * A window opened while a desktop is active belongs to that desktop.
 *
 * Without this it belonged to none, and a workspace is a membership filter — so the window
 * layer dropped a brand-new window on the frame it was created and the user saw nothing
 * happen. Every path into `workspaces` removed ids or moved them deliberately; nothing added
 * one, and `reconcileInfiniteCanvasWorkspaces` only ever normalizes membership *down* to live
 * windows, so it could never have recovered this.
 *
 * The bug shipped with the feature and with passing tests, because the tests asked whether
 * switching preserves a camera and nobody asked what happens when you open a window.
 */

type Kind = "note";

const pane = (id: string) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x: 0, y: 0 },
    title: id,
  });

/** One window on a desktop, that desktop active. */
const onDesktop = (): InfiniteCanvasState<Kind> => {
  const created = reduceInfiniteCanvasState(
    createInfiniteCanvasState<Kind>({ windows: [pane("sources")] }),
    {
      title: "Research",
      type: "workspace.create",
      windowIds: ["sources"],
      workspaceId: "research",
    },
  );

  return reduceInfiniteCanvasState(created, {
    type: "workspace.activate",
    workspaceId: "research",
  });
};

test("a window opened on a desktop is a member of it", () => {
  const opened = reduceInfiniteCanvasState(onDesktop(), {
    type: "window.open",
    window: pane("notes"),
  });

  expect(opened.workspaces[0]?.windowIds).toContain("notes");
});

test("a window opened on a desktop is visible on it", () => {
  // The property the membership is a proxy for, asserted through the predicate the render layer
  // actually consults. Membership that the filter disagreed with would still be the bug.
  const opened = reduceInfiniteCanvasState(onDesktop(), {
    type: "window.open",
    window: pane("notes"),
  });

  expect(isInfiniteCanvasWindowInActiveWorkspace(opened, "notes")).toBe(true);
});

test("it joins only the active desktop, not every desktop", () => {
  const twoDesktops = reduceInfiniteCanvasState(onDesktop(), {
    title: "Writing",
    type: "workspace.create",
    windowIds: [],
    workspaceId: "writing",
  });
  const opened = reduceInfiniteCanvasState(twoDesktops, {
    type: "window.open",
    window: pane("notes"),
  });

  expect(opened.workspaces.find((workspace) => workspace.id === "research")?.windowIds).toContain(
    "notes",
  );
  expect(
    opened.workspaces.find((workspace) => workspace.id === "writing")?.windowIds,
  ).not.toContain("notes");
});

test("a canvas showing all windows is untouched", () => {
  // `showAll` leaves `activeWorkspaceId` null, and a window opened there belongs to no desktop —
  // correctly, because the user was not looking at one.
  const showingAll = reduceInfiniteCanvasState(onDesktop(), {
    command: { type: "workspace.showAll" },
    type: "command.execute",
  });
  const opened = reduceInfiniteCanvasState(showingAll, {
    type: "window.open",
    window: pane("notes"),
  });

  expect(opened.workspaces[0]?.windowIds).not.toContain("notes");
});

test("a canvas with no workspaces at all is unchanged by the lookup", () => {
  // The overwhelmingly common case: nothing about opening a window should change for a consumer
  // who never creates a workspace.
  const plain = createInfiniteCanvasState<Kind>({ windows: [pane("sources")] });
  const opened = reduceInfiniteCanvasState(plain, { type: "window.open", window: pane("notes") });

  expect(opened.workspaces).toEqual([]);
  expect(opened.windows.map((window) => window.id)).toEqual(["sources", "notes"]);
});
