import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import { cloneInfiniteCanvasState } from "./state";
import { createInfiniteCanvasStore } from "./store";
import type { InfiniteCanvasState } from "./types";

/**
 * `cloneInfiniteCanvasState` promises a caller's object cannot be mutated underneath the
 * canvas, and nothing asserted it — for any field.
 *
 * `createInfiniteCanvasStore` clones its `initialState` for exactly this reason: a consumer
 * who builds a state object, hands it over, and then keeps a reference to it must not be able
 * to reach into the running canvas through that reference. The promise was kept by a list of
 * fields in one function, and the list went out of date the moment a field was added — which
 * is how `workspaces` came to be shared by every clone the day workspaces landed.
 *
 * TypeScript calls the state `Readonly`, so these tests cast to mutate. That is the point:
 * the type stops a TypeScript consumer at compile time and stops a JavaScript one not at all,
 * and the isolation has to hold for both.
 */

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

test("a clone shares no mutable object with its source", () => {
  const source = seed();
  const clone = cloneInfiniteCanvasState(source);

  // Every collection and every value object inside one. A field that is only spread would
  // fail here by identity, which is what `workspaces` did before 2026-08-12.
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

test("mutating the source after cloning does not reach the clone", () => {
  // Identity is the mechanism; this is the property. Asserted separately because a future
  // clone that copied one level deep would satisfy the identity checks above and still let a
  // nested write through.
  const source = seed();
  const clone = cloneInfiniteCanvasState(source);

  (source.camera as { zoom: number }).zoom = 99;
  (source.windows[0]?.rect as { x: number }).x = 99;
  (source.workspaces[0]?.camera as { zoom: number }).zoom = 99;
  (source.workspaces[0] as { title: string }).title = "Tampered";

  expect(clone.camera.zoom).toBe(1);
  expect(clone.windows[0]?.rect.x).toBe(0);
  expect(clone.workspaces[0]?.camera.zoom).toBe(1);
  expect(clone.workspaces[0]?.title).toBe("Research");
});

test("a store cannot be reached through the state its caller handed over", () => {
  // The promise as a consumer experiences it, across the boundary that motivates the clone.
  const initialState = seed();
  const store = createInfiniteCanvasStore(initialState);

  (initialState.workspaces[0] as { title: string }).title = "Tampered";
  (initialState.windows[0] as { title: string }).title = "Tampered";

  const live = store.state$.peek();

  expect(live.workspaces[0]?.title).toBe("Research");
  expect(live.windows[0]?.title).toBe("Draft");
});

test("a clone is equal to its source, so isolation is not achieved by losing data", () => {
  // The check that keeps the ones above honest: a clone that dropped `workspaces` entirely
  // would share nothing and pass every identity assertion in this file.
  const source = seed();

  expect(cloneInfiniteCanvasState(source)).toEqual(source);
});
