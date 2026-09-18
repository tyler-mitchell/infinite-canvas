import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./operations";
import type { InfiniteCanvasState } from "./types";
import { isInfiniteCanvasWindowInActiveWorkspace } from "./workspace-membership";

type Kind = "note";

const pane = (id: string) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x: 0, y: 0 },
    title: id,
  });

const onDesktop = (): InfiniteCanvasState<Kind> => {
  const created = reduceInfiniteCanvasState(
    createInfiniteCanvasState<Kind>({ windows: [pane("sources")] }),
    {
      activate: false,
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
  const opened = reduceInfiniteCanvasState(onDesktop(), {
    type: "window.open",
    window: pane("notes"),
  });

  expect(isInfiniteCanvasWindowInActiveWorkspace(opened, "notes")).toBe(true);
});

test("it joins only the active desktop, not every desktop", () => {
  const twoDesktops = reduceInfiniteCanvasState(onDesktop(), {
    activate: false,
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
  const showingAll = reduceInfiniteCanvasState(onDesktop(), { type: "workspace.showAll" });
  const opened = reduceInfiniteCanvasState(showingAll, {
    type: "window.open",
    window: pane("notes"),
  });

  expect(opened.workspaces[0]?.windowIds).not.toContain("notes");
});

test("a canvas with no workspaces at all is unchanged by the lookup", () => {
  const plain = createInfiniteCanvasState<Kind>({ windows: [pane("sources")] });
  const opened = reduceInfiniteCanvasState(plain, { type: "window.open", window: pane("notes") });

  expect(opened.workspaces).toEqual([]);
  expect(opened.windows.map((window) => window.id)).toEqual(["sources", "notes"]);
});
