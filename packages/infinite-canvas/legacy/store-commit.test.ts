import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./operations";
import { createInfiniteCanvasStore } from "./store";
import type { InfiniteCanvasAction, InfiniteCanvasState } from "./types";

type Kind = "note";

const pane = (id: string) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x: 0, y: 0 },
    title: id,
  });

const base = (): InfiniteCanvasState<Kind> =>
  createInfiniteCanvasState<Kind>({ windows: [pane("a"), pane("b")] });

const ACTIONS: readonly InfiniteCanvasAction<Kind>[] = [
  { title: "Research", type: "workspace.create", windowIds: ["a"], workspaceId: "research" },
  { type: "workspace.activate", workspaceId: "research" },
  { type: "window.open", window: pane("c") },
  { type: "window.focus", windowId: "b" },
  {
    type: "selection.replace",
    targets: [
      { type: "window" as const, id: "a" },
      { type: "window" as const, id: "b" },
    ],
  },
  { anchor: { x: 600, y: 400 }, type: "camera.zoomAt", zoom: 2 },
  { type: "viewport.set", viewport: { height: 800, width: 1200 } },
  { type: "window.close", windowId: "b" },
];

test("dispatching leaves the store holding exactly what the reducer produced", () => {
  const store = createInfiniteCanvasStore({ initialState: base() });

  const expected = ACTIONS.reduce<InfiniteCanvasState<Kind>>((state, action) => {
    store.dispatch(action);

    return reduceInfiniteCanvasState(state, action);
  }, base());

  expect(store.state$.peek()).toEqual(expected);
});

test("a workspace action reaches the store at all", () => {
  const store = createInfiniteCanvasStore({ initialState: base() });

  store.dispatch({
    title: "Research",
    type: "workspace.create",
    windowIds: ["a"],
    workspaceId: "research",
  });
  store.dispatch({ type: "workspace.activate", workspaceId: "research" });

  const state = store.state$.peek();

  expect(state.workspaces).toHaveLength(1);
  expect(state.workspaces[0]?.windowIds).toEqual(["a"]);
  expect(state.activeWorkspaceId).toBe("research");
});

test("an action that changes nothing writes nothing", () => {
  const store = createInfiniteCanvasStore({ initialState: base() });
  const before = store.state$.peek();

  store.dispatch({ type: "window.focus", windowId: before.activeWindowId ?? "a" });

  expect(store.state$.peek().windows).toBe(before.windows);
});

test("cancelling a drag preserves an edit to another window", () => {
  const store = createInfiniteCanvasStore({ initialState: base() });
  store.dispatch({
    type: "interaction.startMove",
    pointerId: 1,
    point: { x: 0, y: 0 },
    target: { type: "window", id: "a" },
  });
  store.dispatch({ type: "interaction.step", pointerId: 1, point: { x: 100, y: 0 } });
  store.dispatch({ type: "window.setData", windowId: "b", data: { text: "Saved during drag" } });
  store.dispatch({ type: "desktop.cancel" });
  expect(store.getState().windows.find((window) => window.id === "a")?.rect.x).toBe(0);
  expect(store.getState().windows.find((window) => window.id === "b")?.data).toEqual({
    text: "Saved during drag",
  });
});
