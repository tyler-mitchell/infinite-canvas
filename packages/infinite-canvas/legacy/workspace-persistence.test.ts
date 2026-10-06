import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { createInfiniteCanvasStore } from "./store";
import { reduceInfiniteCanvasState } from "./operations";
import type { InfiniteCanvasState } from "./types";

function stateWithWorkspaces(ids: readonly string[]): InfiniteCanvasState<"note"> {
  return ids.reduce<InfiniteCanvasState<"note">>(
    (state, workspaceId) =>
      reduceInfiniteCanvasState(state, { activate: false, type: "workspace.create", workspaceId }),
    createInfiniteCanvasState<"note">({
      viewport: { height: 800, width: 1200 },
      windows: [
        createInfiniteCanvasWindow<"note">({
          id: "w1",
          kind: "note",
          rect: { height: 200, width: 400, x: 0, y: 0 },
          title: "note",
        }),
      ],
    }),
  );
}

function roundTrip(state: InfiniteCanvasState<"note">) {
  const restored = createInfiniteCanvasStore<"note">({
    document: JSON.parse(
      JSON.stringify(createInfiniteCanvasStore({ initialState: state }).snapshot()),
    ),
  }).getState();

  if (restored === null) {
    throw new Error("the serialized document did not parse back");
  }

  return restored;
}

const RENAMED_AND_REORDERED = [
  { title: "Research", workspaceId: "b" },
  { title: "Inbox", workspaceId: "a" },
  { title: "Archive", workspaceId: "c" },
].reduce(
  (state, input) => reduceInfiniteCanvasState(state, { ...input, type: "workspace.setTitle" }),
  stateWithWorkspaces(["a", "b", "c"]),
);

test("a workspace rename survives the round trip", () => {
  expect(roundTrip(RENAMED_AND_REORDERED).workspaces.map((workspace) => workspace.title)).toEqual([
    "Inbox",
    "Research",
    "Archive",
  ]);
});

test("a workspace reorder survives the round trip", () => {
  const moved = reduceInfiniteCanvasState(RENAMED_AND_REORDERED, {
    toIndex: 0,
    type: "workspace.reorder",
    workspaceId: "c",
  });

  expect(
    roundTrip(moved).workspaces.map((workspace) => `${workspace.id}:${workspace.title}`),
  ).toEqual(["c:Archive", "a:Inbox", "b:Research"]);
});

test("which desktop was active survives the round trip", () => {
  const activated = reduceInfiniteCanvasState(RENAMED_AND_REORDERED, {
    type: "workspace.activate",
    workspaceId: "b",
  });

  expect(roundTrip(activated).activeWorkspaceId).toBe("b");
});

test("a desktop's membership survives the round trip", () => {
  const withMember = reduceInfiniteCanvasState(RENAMED_AND_REORDERED, {
    type: "workspace.addWindow",
    windowId: "w1",
    workspaceId: "a",
  });
  const restored = roundTrip(withMember);

  expect(restored.workspaces.find((workspace) => workspace.id === "a")?.windowIds).toEqual(["w1"]);
});
