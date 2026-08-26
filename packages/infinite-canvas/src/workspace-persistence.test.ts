import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { parseInfiniteCanvasStateJson, stringifyInfiniteCanvasState } from "./persistence";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * A renamed, reordered desktop has to still be renamed and reordered after a reload.
 *
 * Reaching the reducer is not the same as surviving storage, and this repository has already
 * shipped that exact gap: autosave was ticked off for weeks while the subscription it depended on
 * never fired, so nothing was written and the status pill said "saved" throughout. Reading the
 * serializer and concluding "it spreads the whole array, so it must be fine" is the same kind of
 * reasoning that missed it.
 *
 * So this drives the round trip rather than inspecting it: mutate through the real actions, take
 * the string a host would store, parse it back, and assert on what came out. It fails if the
 * serializer drops a field, if the parser drops one, or if either reorders the array on the way.
 */

function stateWithWorkspaces(ids: readonly string[]): InfiniteCanvasState<"note"> {
  return ids.reduce<InfiniteCanvasState<"note">>(
    (state, workspaceId) =>
      reduceInfiniteCanvasState(state, { type: "workspace.create", workspaceId }),
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

/**
 * The exact path a host takes: string out, string in.
 *
 * The fallback deliberately has no workspaces. `parseInfiniteCanvasStateJson` returns it when a
 * document does not parse, so a fallback that already held the right desktops would let every
 * assertion below pass while nothing was actually restored — the test would be measuring its own
 * fixture. An empty one fails loudly instead.
 */
function roundTrip(state: InfiniteCanvasState<"note">) {
  const restored = parseInfiniteCanvasStateJson<"note">(
    stringifyInfiniteCanvasState(state),
    createInfiniteCanvasState<"note">({ viewport: state.viewport, windows: [] }),
  );

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

  // Order *and* the titles that rode with it — a parser that rebuilt the array from ids would
  // pass an order check while losing the names, and vice versa.
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
