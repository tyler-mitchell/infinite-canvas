import { getSelectedWindowIds } from "./selection";
import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./operations";
import type { InfiniteCanvasState } from "./types";

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
    activate: false,
    title: "Research",
    type: "workspace.create",
    windowIds: ["a", "b"],
    workspaceId: "research",
  });

  return reduceInfiniteCanvasState(research, {
    activate: false,
    title: "Writing",
    type: "workspace.create",
    windowIds: [],
    workspaceId: "writing",
  });
};

const enter = (state: InfiniteCanvasState<Kind>, workspaceId: string) =>
  reduceInfiniteCanvasState(state, { type: "workspace.enter", workspaceId });

const targetIds = (state: InfiniteCanvasState<Kind>) =>
  (state.selection.targets ?? []).map((target) => target.id);

const withSelectedEdge = () =>
  reduceInfiniteCanvasState(enter(twoDesktops(), "research"), {
    targets: [edge],
    type: "selection.add",
  });

test("an edge can be selected on a desktop", () => {
  expect(targetIds(withSelectedEdge())).toStrictEqual([edge.id]);
});

test("leaving a desktop does not carry its targets to the next one", () => {
  expect(targetIds(enter(withSelectedEdge(), "writing"))).toStrictEqual([]);
});

test("the desktop you left keeps the target, and hands it back on return", () => {
  const away = enter(withSelectedEdge(), "writing");
  const stored = away.workspaces.find((workspace) => workspace.id === "research");

  expect((stored?.selection.targets ?? []).map((target) => target.id)).toStrictEqual([edge.id]);
  expect(targetIds(enter(away, "research"))).toStrictEqual([edge.id]);
});

test("a stored window id is cleaned while the stored target beside it is not", () => {
  const away = enter(withSelectedEdge(), "writing");
  const closed = reduceInfiniteCanvasState(away, { type: "window.close", windowId: "a" });
  const stored = closed.workspaces.find((workspace) => workspace.id === "research");

  expect(getSelectedWindowIds(stored!.selection)).not.toContain("a");
  expect((stored?.selection.targets ?? []).map((target) => target.id)).toStrictEqual([edge.id]);
});
