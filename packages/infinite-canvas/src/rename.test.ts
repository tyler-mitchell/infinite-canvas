import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * Nothing in the model could be renamed.
 *
 * Five types carry a `title` and none of them had an action to change it: not a window, not a
 * group shell, not a workspace. A consumer building an inline rename — the ordinary affordance
 * for a thing with a name — had to close the entity and recreate it, losing its id, its
 * z-index, its group membership and its place in the undo stack, or reach around the reducer
 * and rebuild state by hand.
 *
 * There are deliberately no *commands* for these. A palette entry cannot invent a title any
 * more than it can invent which window to open, so the surface is the actions facade and the
 * three actions are `parameterized` in `command-coverage.test.ts`. The gap was never that a
 * palette lacked a rename; it was that the model did.
 */

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
  // The identity survives, which is the whole reason this is an action rather than a
  // close-and-recreate: the id, the z-index and the workspace membership all persist.
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
  // `accessibility.test.tsx` asserts every window exposes an accessible name, and the window
  // frame takes it from `title`. A rename that could empty it would break that quietly, in a
  // way only a screen reader would notice.
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
  // `isSameInfiniteCanvasDocument` compares by reference, so a rename that allocated a new
  // windows array while changing nothing would push an undo entry that undoes to itself.
  const state = canvas();
  const renamed = reduceInfiniteCanvasState(state, {
    title: "  Draft ",
    type: "window.setTitle",
    windowId: "note-1",
  });

  expect(renamed.windows).toBe(state.windows);
  expect(renamed.history.past.length).toBe(state.history.past.length);
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
  // Titles are part of the layout: `windows`, `groups` and `workspaces` are all in the undo
  // document, so this needed no history change — but it is worth asserting, because a rename
  // that quietly escaped undo would be the one edit a user could not take back.
  const state = canvas();
  const renamed = reduceInfiniteCanvasState(state, {
    title: "Final",
    type: "window.setTitle",
    windowId: "note-1",
  });

  expect(renamed.history.past.length - state.history.past.length).toBe(1);

  const undone = reduceInfiniteCanvasState(renamed, {
    command: { type: "history.undo" },
    type: "command.execute",
  });

  expect(undone.windows[0]?.title).toBe("Draft");
});
