import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./operations";
import { createInfiniteCanvasStore } from "./store";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const seed = (): InfiniteCanvasState<Kind> =>
  reduceInfiniteCanvasState(
    createInfiniteCanvasState<Kind>({
      windows: [
        createInfiniteCanvasWindow<Kind>({
          id: "note-1",
          kind: "note",
          rect: { height: 200, width: 300, x: 0, y: 0 },
          title: "Draft",
        }),
      ],
    }),
    { title: "Research", type: "workspace.create", windowIds: ["note-1"], workspaceId: "research" },
  );

test("the store isolates its state from caller-owned objects", () => {
  const source = seed();
  const clone = createInfiniteCanvasStore({ initialState: source }).getState();

  expect(clone.camera).not.toBe(source.camera);
  expect(clone.viewport).not.toBe(source.viewport);
  expect(clone.selection).not.toBe(source.selection);
  expect(clone.windows).not.toBe(source.windows);
  expect(clone.windows[0]).not.toBe(source.windows[0]);
  expect(clone.windows[0]?.rect).not.toBe(source.windows[0]?.rect);
  expect(clone.workspaces).not.toBe(source.workspaces);
  expect(clone.workspaces[0]).not.toBe(source.workspaces[0]);
  expect(clone.workspaces[0]?.camera).not.toBe(source.workspaces[0]?.camera);
  expect(clone.workspaces[0]?.selection).not.toBe(source.workspaces[0]?.selection);
});

test("caller mutations do not change store state", () => {
  const source = seed();
  const clone = createInfiniteCanvasStore({ initialState: source }).getState();

  const sourceWindow = source.windows[0];
  const sourceWorkspace = source.workspaces[0];

  expect(sourceWindow).toBeDefined();
  expect(sourceWorkspace).toBeDefined();

  (source.camera as { zoom: number }).zoom = 99;
  (sourceWindow!.rect as { x: number }).x = 99;
  (sourceWorkspace!.camera as { zoom: number }).zoom = 99;
  (sourceWorkspace as { title: string } | undefined)!.title = "Tampered";

  expect(clone.camera.zoom).toBe(1);
  expect(clone.windows[0]?.rect.x).toBe(0);
  expect(clone.workspaces[0]?.camera.zoom).toBe(1);
  expect(clone.workspaces[0]?.title).toBe("Research");
});

test("a store cannot be reached through the state its caller handed over", () => {
  const initialState = seed();
  const store = createInfiniteCanvasStore({ initialState: initialState });

  (initialState.workspaces[0] as { title: string }).title = "Tampered";
  (initialState.windows[0] as { title: string }).title = "Tampered";

  const live = store.state$.peek();

  expect(live.workspaces[0]?.title).toBe("Research");
  expect(live.windows[0]?.title).toBe("Draft");
});

test("store isolation preserves the supplied document", () => {
  const source = seed();

  expect(createInfiniteCanvasStore({ initialState: source }).snapshot()).toEqual(
    createInfiniteCanvasStore({ initialState: source }).snapshot(),
  );
});
