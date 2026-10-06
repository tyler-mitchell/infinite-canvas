import { expect, test } from "vite-plus/test";
import { createInfiniteCanvasStore } from "./store";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./operations";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const canvas = (): InfiniteCanvasState<Kind> => {
  const base = createInfiniteCanvasState<Kind>({
    windows: [
      createInfiniteCanvasWindow<Kind>({
        id: "note-1",
        kind: "note",
        rect: { height: 200, width: 300, x: 0, y: 0 },
        title: "Draft",
      }),
    ],
  });

  return reduceInfiniteCanvasState(base, {
    title: "Research",
    type: "workspace.create",
    windowIds: ["note-1"],
    workspaceId: "research",
  });
};

test("a window, a group and a workspace can each be renamed", () => {
  const renamedWindow = reduceInfiniteCanvasState(canvas(), {
    title: "Final",
    type: "window.setTitle",
    windowId: "note-1",
  });

  expect(renamedWindow.windows[0]?.title).toBe("Final");
  expect(renamedWindow.windows[0]?.id).toBe("note-1");
  expect(renamedWindow.workspaces[0]?.windowIds).toEqual(["note-1"]);

  const renamedWorkspace = reduceInfiniteCanvasState(canvas(), {
    title: "Writing",
    type: "workspace.setTitle",
    workspaceId: "research",
  });

  expect(renamedWorkspace.workspaces[0]?.title).toBe("Writing");
  expect(renamedWorkspace.workspaces[0]?.id).toBe("research");
});

test("an empty title is refused, because a title is an accessible name", () => {
  const state = canvas();

  for (const title of ["", "   ", "\t\n"]) {
    expect(
      reduceInfiniteCanvasState(state, { title, type: "window.setTitle", windowId: "note-1" })
        .windows[0]?.title,
    ).toBe("Draft");
  }
});

test("a title is trimmed, so no window is named with invisible padding", () => {
  expect(
    reduceInfiniteCanvasState(canvas(), {
      title: "  Final  ",
      type: "window.setTitle",
      windowId: "note-1",
    }).windows[0]?.title,
  ).toBe("Final");
});

test("renaming to the same title is not an edit", () => {
  const state = canvas();
  const store = createInfiniteCanvasStore({ initialState: state });
  store.dispatch({
    title: "  Draft ",
    type: "window.setTitle",
    windowId: "note-1",
  });

  expect(store.getState().windows).toEqual(state.windows);
  expect(store.history.undos$.peek()).toBe(0);
});

test("renaming something that does not exist changes nothing", () => {
  const state = canvas();

  expect(
    reduceInfiniteCanvasState(state, { title: "Ghost", type: "window.setTitle", windowId: "gone" }),
  ).toBe(state);
  expect(
    reduceInfiniteCanvasState(state, {
      title: "Ghost",
      type: "workspace.setTitle",
      workspaceId: "gone",
    }),
  ).toBe(state);
});

test("a rename is undoable", () => {
  const state = canvas();
  const store = createInfiniteCanvasStore({ initialState: state });
  store.dispatch({
    title: "Final",
    type: "window.setTitle",
    windowId: "note-1",
  });

  expect(store.history.undos$.peek()).toBe(1);
  store.dispatch({ type: "history.undo" });
  expect(store.getState().windows[0]?.title).toBe("Draft");
});
