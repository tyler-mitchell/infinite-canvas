import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import {
  applyInfiniteCanvasDockPreview,
  createInfiniteCanvasGroup,
  resolveInfiniteCanvasDockPreviewForTarget,
} from "./group-state";
import { getCanvasLayout } from "./layout";
import { reduceInfiniteCanvasState } from "./operations";
import { createInfiniteCanvasStore } from "./store";
import { getInfiniteCanvasGroupWindowIds } from "./group-tree";
import type { InfiniteCanvasRect, InfiniteCanvasState } from "./types";

const overlaps = (a: InfiniteCanvasRect, b: InfiniteCanvasRect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

function docked(): InfiniteCanvasState<"demo"> {
  const seed = createInfiniteCanvasState<"demo">({
    viewport: { height: 900, width: 1400 },
    windows: [
      createInfiniteCanvasWindow({
        id: "host",
        kind: "demo",
        rect: { height: 300, width: 400, x: 0, y: 0 },
      }),
      createInfiniteCanvasWindow({
        id: "guest",
        kind: "demo",
        rect: { height: 300, width: 400, x: 500, y: 0 },
      }),
    ],
  });
  const preview = resolveInfiniteCanvasDockPreviewForTarget(seed, {
    edge: "center",
    targetId: "host",
    windowId: "guest",
  });

  if (preview === null) {
    throw new Error("the fixture failed to dock");
  }

  return reduceInfiniteCanvasState(applyInfiniteCanvasDockPreview(seed, preview), {
    type: "selection.replace",
    targets: [{ type: "window", id: "guest" }],
  });
}

test("tab tear-out stays reversible until the drag ends", () => {
  const store = createInfiniteCanvasStore({ initialState: docked() });
  const before = store.snapshot();
  const start = {
    type: "interaction.startMove",
    undock: true,
    pointerId: 1,
    point: { x: 100, y: 100 },
    target: { type: "window", id: "guest" },
  } as const;
  store.dispatch({
    type: "interaction.startGroupReorder",
    groupId: before.groups[0]!.id,
    childId: "guest",
    pointerId: 1,
  });
  store.dispatch({
    type: "group.reorderChild",
    groupId: before.groups[0]!.id,
    childId: "guest",
    toIndex: 0,
  });
  store.dispatch(start);
  expect(
    store.getState().groups.flatMap(({ tree }) => getInfiniteCanvasGroupWindowIds(tree)),
  ).not.toContain("guest");
  expect(store.snapshot().groups).toEqual(before.groups);
  store.dispatch({ type: "desktop.cancel" });
  expect(store.getState().groups).toEqual(before.groups);
  expect(store.getState().windows).toEqual(before.windows);
  store.dispatch(start);
  store.dispatch({ type: "interaction.finish", pointerId: 1 });
  expect(
    store.snapshot().groups.flatMap(({ tree }) => getInfiniteCanvasGroupWindowIds(tree)),
  ).not.toContain("guest");
  store.dispatch({ type: "history.undo" });
  expect(store.snapshot().groups).toEqual(before.groups);
});

test("tab reordering is cancelled or committed as one drag", () => {
  const store = createInfiniteCanvasStore({ initialState: docked() });
  const before = store.snapshot();
  const groupId = before.groups[0]!.id;
  const start = {
    type: "interaction.startGroupReorder",
    groupId,
    childId: "guest",
    pointerId: 1,
  } as const;
  store.dispatch(start);
  store.dispatch({ type: "group.reorderChild", groupId, childId: "guest", toIndex: 0 });
  expect(getInfiniteCanvasGroupWindowIds(store.getState().groups[0]!.tree)[0]).toBe("guest");
  expect(store.snapshot().groups).toEqual(before.groups);
  store.dispatch({ type: "desktop.cancel" });
  expect(store.getState().groups).toEqual(before.groups);
  store.dispatch(start);
  store.dispatch({ type: "group.reorderChild", groupId, childId: "guest", toIndex: 0 });
  store.dispatch({ type: "interaction.finish", pointerId: 1 });
  expect(getInfiniteCanvasGroupWindowIds(store.snapshot().groups[0]!.tree)[0]).toBe("guest");
  store.dispatch({ type: "history.undo" });
  expect(store.snapshot().groups).toEqual(before.groups);
});

test("the fixture really is docked, so the test below is about undocking", () => {
  const state = docked();

  expect(state.groups).toHaveLength(1);
  expect(JSON.stringify(state.groups[0]?.tree)).toContain("guest");
});

test("a commanded undock leaves the window clear of the shell it left", () => {
  const state = docked();
  const after = reduceInfiniteCanvasState(state, { type: "window.undock" });
  const freed = after.windows.find((window) => window.id === "guest");
  const shell = after.groups[0];

  expect(JSON.stringify(after.groups.map((group) => group.tree))).not.toContain("guest");
  expect(freed).toBeDefined();
  expect(shell).toBeDefined();
  expect(overlaps(freed?.rect ?? shell!.rect, shell!.rect)).toBe(false);
});

test("it keeps the window's size, moving it rather than reshaping it", () => {
  const state = docked();
  const before = getCanvasLayout(state).windowRects.get("guest");
  const after = reduceInfiniteCanvasState(state, { type: "window.undock" }).windows.find(
    (window) => window.id === "guest",
  );

  expect(before).toBeDefined();
  expect(after).toBeDefined();
  expect(after?.rect.width).toBe(before?.width);
  expect(after?.rect.height).toBe(before?.height);
});

const SOLO_SHELL: InfiniteCanvasRect = { height: 720, width: 544, x: 0, y: 0 };

const solo = (): InfiniteCanvasState<"demo"> => {
  const seed = createInfiniteCanvasState<"demo">({
    viewport: { height: 900, width: 1400 },
    windows: [
      createInfiniteCanvasWindow({
        id: "only",
        kind: "demo",
        rect: { height: 200, width: 300, x: 0, y: 0 },
      }),
      createInfiniteCanvasWindow({
        id: "far",
        kind: "demo",
        rect: { height: 200, width: 300, x: 5000, y: 5000 },
      }),
    ],
  });

  return {
    ...createInfiniteCanvasGroup(seed, {
      groupId: "solo",
      rect: SOLO_SHELL,
      windowIds: ["only"],
    }),
    activeWindowId: "only",
  };
};

test("undocking the last member leaves it where the shell was, rather than beside it", () => {
  const before = solo();
  const displayedRect = getCanvasLayout(before).windowRects.get("only");

  expect(before.windows.find((window) => window.id === "only")?.rect).toEqual({
    height: 200,
    width: 300,
    x: 0,
    y: 0,
  });
  expect(displayedRect).toEqual(SOLO_SHELL);

  const after = reduceInfiniteCanvasState(before, {
    type: "group.undockWindow",
    windowId: "only",
  });

  expect(after.groups).toEqual([]);
  expect(after.windows.find((window) => window.id === "only")?.rect).toEqual(SOLO_SHELL);
});

test("the two verbs agree about where a solitary member lands", () => {
  const undocked = reduceInfiniteCanvasState(solo(), { type: "window.undock" });
  const dissolved = reduceInfiniteCanvasState(solo(), { type: "group.dissolve" });
  const rectOf = (state: InfiniteCanvasState<"demo">) =>
    state.windows.find((window) => window.id === "only")?.rect;

  expect(rectOf(undocked)).toEqual(rectOf(dissolved));
});
