import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { getCanvasLayout } from "./layout";
import { createInfiniteCanvasGroup, reconcileInfiniteCanvasGroups } from "./group-state";
import { getInfiniteCanvasGroupWindowIds } from "./group-tree";
import { createInfiniteCanvasStore } from "./store";
import { reduceInfiniteCanvasState } from "./operations";
import type { InfiniteCanvasRect, InfiniteCanvasState } from "./types";

type Kind = "demo";

const rectAt = (x: number, width = 300): InfiniteCanvasRect => ({ height: 200, width, x, y: 0 });

const twoFloating = (): InfiniteCanvasState<Kind> =>
  createInfiniteCanvasState<Kind>({
    viewport: { height: 800, width: 1200 },
    windows: [
      createInfiniteCanvasWindow({ id: "west", kind: "demo", rect: rectAt(0), title: "West" }),
      createInfiniteCanvasWindow({ id: "east", kind: "demo", rect: rectAt(400), title: "East" }),
    ],
  });

const docked = () =>
  reduceInfiniteCanvasState(twoFloating(), { direction: "right", type: "window.dockDirection" });

const close = (state: InfiniteCanvasState<Kind>, windowId: string) =>
  reduceInfiniteCanvasState(state, { type: "window.close", windowId });

test("closing one of two panes dissolves the shell around the survivor", () => {
  const after = close(docked(), "west");

  expect(after.groups).toEqual([]);
  expect(after.windows.map((window) => window.id)).toEqual(["east"]);
});

test("the survivor keeps its displayed pane bounds", () => {
  const before = docked();
  const displayedRect = getCanvasLayout(before).windowRects.get("east");
  const after = close(before, "west").windows.find((window) => window.id === "east")?.rect;

  expect(displayedRect).toBeDefined();
  expect(after).toEqual(displayedRect);
});

test("minimizing one of two panes dissolves it too — the pane is just as gone", () => {
  const after = reduceInfiniteCanvasState(docked(), {
    type: "window.minimize",
    windowId: "west",
  });

  expect(after.groups).toEqual([]);
});

test("undocking one of two panes keeps the shell, because that is rearrangement", () => {
  const after = reduceInfiniteCanvasState(docked(), { type: "window.undock" });

  expect(after.groups).toHaveLength(1);
  expect(getInfiniteCanvasGroupWindowIds(after.groups[0]!.tree)).toEqual(["east"]);
});

const groupOf = (windowIds: readonly string[], state = twoFloating()) =>
  createInfiniteCanvasGroup(state, {
    groupId: "made",
    rect: rectAt(0, 600),
    windowIds,
  });

test("a group deliberately made around one window is left alone", () => {
  const state = groupOf(["west"]);

  expect(state.groups).toHaveLength(1);
  expect(getInfiniteCanvasGroupWindowIds(state.groups[0]!.tree)).toEqual(["west"]);
});

test("closing a pane of a three-member group leaves a real group standing", () => {
  const three = createInfiniteCanvasState<Kind>({
    viewport: { height: 800, width: 1200 },
    windows: ["a", "b", "c"].map((id, index) =>
      createInfiniteCanvasWindow({ id, kind: "demo", rect: rectAt(index * 400), title: id }),
    ),
  });
  const after = close(groupOf(["a", "b", "c"], three), "a");

  expect(after.groups).toHaveLength(1);
  expect(getInfiniteCanvasGroupWindowIds(after.groups[0]!.tree)).toEqual(["b", "c"]);
});

test("closing the last member still drops the shell, as DOCK-005 always did", () => {
  expect(close(groupOf(["west"]), "west").groups).toEqual([]);
});

test("closing a group cancels its active move", () => {
  const grouped = groupOf(["west", "east"]);
  const moving = reduceInfiniteCanvasState(grouped, {
    pointerId: 7,
    point: { x: 100, y: 100 },
    target: { id: "made", type: "group" },
    type: "interaction.startMove",
  });
  const closed = reduceInfiniteCanvasState(moving, { groupId: "made", type: "group.close" });

  expect(moving.interaction?.kind).toBe("move");
  expect(closed.groups).toEqual([]);
  expect(closed.interaction).toBeNull();
  expect(closed.snapPreview).toBeNull();
});

test("closing a group cancels its active resize", () => {
  const grouped = groupOf(["west", "east"]);
  const resizing = reduceInfiniteCanvasState(grouped, {
    groupId: "made",
    handle: "south-east",
    minSize: { height: 100, width: 100 },
    pointerId: 8,
    point: { x: 600, y: 200 },
    type: "interaction.startGroupResize",
  });
  const closed = reduceInfiniteCanvasState(resizing, { groupId: "made", type: "group.close" });

  expect(resizing.interaction?.kind).toBe("groupResize");
  expect(closed.groups).toEqual([]);
  expect(closed.interaction).toBeNull();
  expect(closed.snapPreview).toBeNull();
});

test("a persisted group naming a window that no longer exists dissolves on reconciliation", () => {
  const grouped = groupOf(["west", "east"]);
  const displayedRect = getCanvasLayout(grouped).windowRects.get("east");
  const stale: InfiniteCanvasState<Kind> = {
    ...grouped,
    windows: grouped.windows.filter((window) => window.id !== "west"),
  };
  const after = reconcileInfiniteCanvasGroups(stale);

  expect(after.groups).toEqual([]);
  expect(after.windows.find((window) => window.id === "east")?.rect).toEqual(displayedRect);
});

test("a persisted group that still has two live windows survives reconciliation", () => {
  const after = reconcileInfiniteCanvasGroups(groupOf(["west", "east"]));

  expect(after.groups).toHaveLength(1);
  expect(getInfiniteCanvasGroupWindowIds(after.groups[0]!.tree)).toEqual(["west", "east"]);
});

test("a group saved already collapsed to one live member reopens still collapsed", () => {
  const after = reconcileInfiniteCanvasGroups(groupOf(["west"]));

  expect(after.groups).toHaveLength(1);
  expect(getInfiniteCanvasGroupWindowIds(after.groups[0]!.tree)).toEqual(["west"]);
});

test("an undocked shell is written to the document, which is what makes the two indistinguishable", () => {
  const undocked = reduceInfiniteCanvasState(docked(), { type: "window.undock" });
  const stored = createInfiniteCanvasStore({ initialState: undocked }).snapshot().groups;

  expect(stored).toHaveLength(1);
  expect(stored[0]?.tree).toEqual({ id: "east", kind: "window", weight: 1 });
});
