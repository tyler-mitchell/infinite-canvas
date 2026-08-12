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
  // The promise as a consumer experiences it, across the boundary that motivates the clone.
  const initialState = seed();
  const store = createInfiniteCanvasStore(initialState);

  (initialState.workspaces[0] as { title: string }).title = "Tampered";
  (initialState.windows[0] as { title: string }).title = "Tampered";

  const live = store.state$.peek();

  expect(live.workspaces[0]?.title).toBe("Research");
  expect(live.windows[0]?.title).toBe("Draft");
});

/**
 * Every shared reference, found rather than listed.
 *
 * The tests above name the fields they check, which is the same shape as the bug: a list that
 * goes out of date the moment a field is added. `workspaces` was missing from `clone`'s list
 * for a day and would have been missing from an assertion list just as easily.
 *
 * This walks the whole state instead, so a new field is checked by default and forgetting it
 * makes the test fail rather than silently pass. Sharing that *is* deliberate is declared
 * below — and a declaration is safe in a way an omission is not, because adding one is a
 * decision someone had to write down.
 */

/** Paths where source and clone deliberately share a reference. */
const DELIBERATELY_SHARED = [
  // Trees are rebuilt wholesale by every mutation, never edited in place. `cloneGroup` shares
  // them for the same reason.
  /^groups\[\d+\]\.tree/,
  // The consumer's own payload. The framework treats it as opaque, and deep-copying it would
  // both cost more than it can know and break any identity the consumer relies on.
  /^windows\[\d+\]\.data/,
  // Rebuilt by every reducer that touches membership, like a tree.
  /^workspaces\[\d+\]\.windowIds/,
  // Not cloned at all: an undo stack holds documents that hold the same windows and groups,
  // and copying it would multiply the whole history by the depth of the stack. `reset`
  // replaces it outright rather than restoring it.
  /^history/,
];

const findSharedReferences = (source: unknown, clone: unknown, path: string): readonly string[] => {
  if (source === null || typeof source !== "object") {
    return [];
  }

  if (DELIBERATELY_SHARED.some((allowed) => allowed.test(path))) {
    return [];
  }

  if (source === clone) {
    return [path];
  }

  return Object.keys(source).flatMap((key) =>
    findSharedReferences(
      (source as Record<string, unknown>)[key],
      (clone as Record<string, unknown>)[key],
      Array.isArray(source) ? `${path}[${key}]` : path === "" ? key : `${path}.${key}`,
    ),
  );
};

test("no reference is shared between a state and its clone except by declaration", () => {
  const source = seed();

  expect(findSharedReferences(source, cloneInfiniteCanvasState(source), "")).toEqual([]);
});

test("a clone is equal to its source, so isolation is not achieved by losing data", () => {
  // The check that keeps the ones above honest: a clone that dropped `workspaces` entirely
  // would share nothing and pass every identity assertion in this file.
  const source = seed();

  expect(cloneInfiniteCanvasState(source)).toEqual(source);
});
