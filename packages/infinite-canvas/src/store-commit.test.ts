import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import { createInfiniteCanvasStore } from "./store";
import type { InfiniteCanvasAction, InfiniteCanvasState } from "./types";

/**
 * The store's observable state is the reduced state. All of it.
 *
 * `commitInfiniteCanvasState` writes changed fields individually rather than replacing the root,
 * because a `set` on the root would invalidate every observer on every action. That is the right
 * design and it came with a hand-written list of fields — which went out of date the moment a
 * field was added, and did: `workspaces` and `activeWorkspaceId` were absent, so **every
 * workspace action was silently dropped by the store**.
 *
 * The reducer was correct the whole time. The bug lived only on the public path — and since
 * `reduceInfiniteCanvasState` is not exported, the store *is* the public path, which made the
 * entire workspaces feature unreachable for a consumer except through `initialState`. Every unit
 * test passed throughout, because they all drive the reducer directly.
 *
 * This is the third time a hand-listed enumeration of state fields dropped `workspaces` —
 * `cloneInfiniteCanvasState` and the persistence envelope were the first two. The commit loop is
 * now generic over the state's own keys, so there is no list left to forget, and these assert
 * the property rather than the list.
 */

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

/**
 * One action per field the reducer can touch, so a field the commit forgets shows up here as a
 * disagreement rather than as a feature nobody can reach.
 */
const ACTIONS: readonly InfiniteCanvasAction<Kind>[] = [
  { title: "Research", type: "workspace.create", windowIds: ["a"], workspaceId: "research" },
  { type: "workspace.activate", workspaceId: "research" },
  { type: "window.open", window: pane("c") },
  { type: "window.focus", windowId: "b" },
  { type: "selection.replace", windowIds: ["a", "b"] },
  { anchor: { x: 600, y: 400 }, type: "camera.zoomAt", zoom: 2 },
  { type: "viewport.set", viewport: { height: 800, width: 1200 } },
  { type: "window.close", windowId: "b" },
];

test("dispatching leaves the store holding exactly what the reducer produced", () => {
  // The whole invariant in one assertion, and the one that would have caught the dropped
  // workspaces on the day it landed: whatever the reducer returns is what an observer reads.
  const store = createInfiniteCanvasStore(base());

  const expected = ACTIONS.reduce<InfiniteCanvasState<Kind>>((state, action) => {
    store.commands.dispatch(action);

    return reduceInfiniteCanvasState(state, action);
  }, base());

  expect(store.state$.peek()).toEqual(expected);
});

test("a workspace action reaches the store at all", () => {
  // Stated separately and bluntly, because "the store equals the reducer" is the kind of
  // assertion that can be satisfied by both sides being equally empty.
  const store = createInfiniteCanvasStore(base());

  store.commands.dispatch({
    title: "Research",
    type: "workspace.create",
    windowIds: ["a"],
    workspaceId: "research",
  });
  store.commands.dispatch({ type: "workspace.activate", workspaceId: "research" });

  const state = store.state$.peek();

  expect(state.workspaces).toHaveLength(1);
  expect(state.workspaces[0]?.windowIds).toEqual(["a"]);
  expect(state.activeWorkspaceId).toBe("research");
});

test("an action that changes nothing writes nothing", () => {
  // The reason the commit compares before writing. Focusing the already-active window is not an
  // edit, and a store that wrote anyway would invalidate every observer on a no-op.
  const store = createInfiniteCanvasStore(base());
  const before = store.state$.peek();

  store.commands.dispatch({ type: "window.focus", windowId: before.activeWindowId ?? "a" });

  expect(store.state$.peek().windows).toBe(before.windows);
});
