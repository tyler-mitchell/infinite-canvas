import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * A desktop stores the selection you left it with, targets included.
 *
 * `selection-target-lifetime.test.ts` pins that the framework never prunes `selection.targets`,
 * because it cannot know what a consumer's scene objects are. This is the path by which that
 * becomes reachable rather than theoretical: switching desktops *saves* the outgoing selection onto
 * the outgoing workspace, and `reconcileInfiniteCanvasWorkspaces` cleans a stored selection's
 * `windowIds` and `anchorWindowId` and never its `targets`. Come back, and a target naming an
 * object deleted while you were away is restored with the rest.
 *
 * The switch itself is not the leak, which is worth being exact about — entering a desktop restores
 * *that* desktop's stored selection, so a target does not ride along into somewhere it never was.
 * The leak is that the one left behind keeps its targets through everything that cleans the rest.
 */

type Kind = "note";

const edge = { id: "edge-that-gets-cut", kind: "relation", type: "edge" } as const;

const twoDesktops = (): InfiniteCanvasState<Kind> => {
  const base = {
    ...createInfiniteCanvasState<Kind>({
      windows: [
        createInfiniteCanvasWindow<Kind>({
          id: "a",
          kind: "note",
          rect: { height: 200, width: 300, x: 0, y: 0 },
          title: "a",
        }),
        createInfiniteCanvasWindow<Kind>({
          id: "b",
          kind: "note",
          rect: { height: 200, width: 300, x: 400, y: 0 },
          title: "b",
        }),
      ],
    }),
    viewport: { height: 800, width: 1200 },
  };
  const research = reduceInfiniteCanvasState(base, {
    title: "Research",
    type: "workspace.create",
    windowIds: ["a", "b"],
    workspaceId: "research",
  });

  return reduceInfiniteCanvasState(research, {
    title: "Writing",
    type: "workspace.create",
    windowIds: [],
    workspaceId: "writing",
  });
};

const enter = (state: InfiniteCanvasState<Kind>, workspaceId: string) =>
  reduceInfiniteCanvasState(state, {
    command: { type: "workspace.enter", workspaceId },
    type: "command.execute",
  });

const targetIds = (state: InfiniteCanvasState<Kind>) =>
  (state.selection.targets ?? []).map((target) => target.id);

/** On Research, with an edge selected. */
const withSelectedEdge = () =>
  reduceInfiniteCanvasState(enter(twoDesktops(), "research"), {
    targets: [edge],
    type: "selection.targets.add",
  });

test("an edge can be selected on a desktop", () => {
  // The premise, so nothing below passes on an empty target list.
  expect(targetIds(withSelectedEdge())).toStrictEqual([edge.id]);
});

test("leaving a desktop does not carry its targets to the next one", () => {
  // Entering restores the *incoming* desktop's stored selection, which has none.
  expect(targetIds(enter(withSelectedEdge(), "writing"))).toStrictEqual([]);
});

test("the desktop you left keeps the target, and hands it back on return", () => {
  /*
   * The reachable path. Nothing between here and the return prunes it — not the switch, not
   * reconciliation, not a reload — so an object deleted while you were on the other desktop comes
   * back selected.
   */
  const away = enter(withSelectedEdge(), "writing");
  const stored = away.workspaces.find((workspace) => workspace.id === "research");

  expect((stored?.selection.targets ?? []).map((target) => target.id)).toStrictEqual([edge.id]);
  expect(targetIds(enter(away, "research"))).toStrictEqual([edge.id]);
});

test("a stored window id is cleaned while the stored target beside it is not", () => {
  /*
   * The asymmetry again, this time inside a *stored* workspace selection rather than the live one.
   * `reconcileInfiniteCanvasWorkspaces` states its own reason for cleaning: "a window closed once
   * leaves its name in a document forever". That reason applies word for word to the target, and
   * the framework cannot act on it.
   */
  const away = enter(withSelectedEdge(), "writing");
  const closed = reduceInfiniteCanvasState(away, { type: "window.close", windowId: "a" });
  const stored = closed.workspaces.find((workspace) => workspace.id === "research");

  expect(stored?.selection.windowIds ?? []).not.toContain("a");
  expect((stored?.selection.targets ?? []).map((target) => target.id)).toStrictEqual([edge.id]);
});
