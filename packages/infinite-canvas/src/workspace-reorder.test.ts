import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * Workspaces are an ordered list that nothing could reorder.
 *
 * `createInfiniteCanvasWorkspace` appends, and until `workspace.reorder` there was no action that
 * touched the order — so a desktop strip showed desktops in creation order forever. Every case
 * below is asymmetric on purpose: a three-item list where the move is a no-op under an
 * off-by-one, or where "remove then insert" and "insert then remove" disagree.
 */

function stateWithWorkspaces(ids: readonly string[]): InfiniteCanvasState<"note"> {
  return ids.reduce<InfiniteCanvasState<"note">>(
    (state, workspaceId) =>
      reduceInfiniteCanvasState(state, { type: "workspace.create", workspaceId }),
    createInfiniteCanvasState<"note">({ viewport: { height: 800, width: 1200 }, windows: [] }),
  );
}

const order = (state: InfiniteCanvasState<"note">) =>
  state.workspaces.map((workspace) => workspace.id);

const reorder = (state: InfiniteCanvasState<"note">, workspaceId: string, toIndex: number) =>
  reduceInfiniteCanvasState(state, { toIndex, type: "workspace.reorder", workspaceId });

const ABC = stateWithWorkspaces(["a", "b", "c"]);

test("workspaces start in creation order", () => {
  expect(order(ABC)).toEqual(["a", "b", "c"]);
});

test("moving the first workspace to the end puts it last", () => {
  expect(order(reorder(ABC, "a", 2))).toEqual(["b", "c", "a"]);
});

test("moving the last workspace to the front puts it first", () => {
  expect(order(reorder(ABC, "c", 0))).toEqual(["c", "a", "b"]);
});

/**
 * The case that catches an insert-before-remove implementation.
 *
 * Moving "a" to index 1 must yield b, a, c. An implementation that inserts into the original list
 * before removing the original entry lands it at b, a, c only by accident on some indices and gets
 * a, b, c — a silent no-op — on others.
 */
test("moving a workspace one place later lands after its former neighbour", () => {
  expect(order(reorder(ABC, "a", 1))).toEqual(["b", "a", "c"]);
});

test("moving a workspace one place earlier lands before its former neighbour", () => {
  expect(order(reorder(ABC, "c", 1))).toEqual(["a", "c", "b"]);
});

test("an index past the end clamps to last rather than being refused", () => {
  expect(order(reorder(ABC, "a", 99))).toEqual(["b", "c", "a"]);
});

test("a negative index clamps to first", () => {
  expect(order(reorder(ABC, "c", -5))).toEqual(["c", "a", "b"]);
});

test("moving a workspace to where it already is changes nothing", () => {
  const next = reorder(ABC, "b", 1);

  expect(order(next)).toEqual(["a", "b", "c"]);
  expect(next.workspaces).toBe(ABC.workspaces);
});

test("reordering an unknown workspace changes nothing", () => {
  const next = reorder(ABC, "nope", 0);

  expect(next.workspaces).toBe(ABC.workspaces);
});

/** Order is the only thing that moves — membership, camera, and titles ride along untouched. */
test("a reordered workspace keeps its own contents", () => {
  const named = reduceInfiniteCanvasState(ABC, {
    title: "Research",
    type: "workspace.setTitle",
    workspaceId: "c",
  });
  const moved = reorder(named, "c", 0);

  expect(moved.workspaces[0]?.title).toBe("Research");
  expect(moved.workspaces[0]?.id).toBe("c");
});
