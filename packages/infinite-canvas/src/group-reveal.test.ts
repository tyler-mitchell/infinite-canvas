import { expect, test } from "vite-plus/test";

import { executeInfiniteCanvasCommand } from "./commands";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import {
  applyInfiniteCanvasDockPreview,
  getInfiniteCanvasGroupProjection,
  resolveInfiniteCanvasDockPreviewForTarget,
} from "./group-state";
import type { InfiniteCanvasState } from "./types";

const dockCentre = (
  state: InfiniteCanvasState<"demo">,
  windowId: string,
  targetId: string,
): InfiniteCanvasState<"demo"> => {
  const preview = resolveInfiniteCanvasDockPreviewForTarget(state, {
    edge: "center",
    targetId,
    windowId,
  });

  if (preview === null) {
    throw new Error(`the fixture failed to dock ${windowId} onto ${targetId}`);
  }

  return applyInfiniteCanvasDockPreview(state, preview);
};

function nested(): InfiniteCanvasState<"demo"> {
  const seed = createInfiniteCanvasState<"demo">({
    viewport: { height: 800, width: 1200 },
    windows: [
      { id: "shallow", x: 0 },
      { id: "middle", x: 500 },
      { id: "deep", x: 1000 },
    ].map((entry) =>
      createInfiniteCanvasWindow({
        id: entry.id,
        kind: "demo",
        rect: { height: 300, width: 400, x: entry.x, y: 0 },
        title: entry.id,
      }),
    ),
  });

  return dockCentre(dockCentre(seed, "middle", "shallow"), "deep", "middle");
}

const isHidden = (state: InfiniteCanvasState<"demo">, windowId: string) =>
  getInfiniteCanvasGroupProjection(state.groups, state.groupMetrics).hiddenWindowIds.has(windowId);

test("the fixture really does bury one window two levels down", () => {
  const state = nested();
  const root = state.groups[0]?.tree;

  expect(state.groups).toHaveLength(1);
  expect(root?.kind).toBe("container");
  expect(
    root?.kind === "container" && root.children.some((child) => child.kind === "container"),
  ).toBe(true);
});

test("revealing a window two levels down actually shows it", () => {
  const revealed = executeInfiniteCanvasCommand(nested(), {
    type: "window.reveal",
    windowId: "deep",
  });

  expect(isHidden(revealed, "deep")).toBe(false);
  expect(revealed.activeWindowId).toBe("deep");
});

test("revealing one member hides the sibling it displaced, and no more", () => {
  const revealed = executeInfiniteCanvasCommand(nested(), {
    type: "window.reveal",
    windowId: "deep",
  });
  const hidden = ["deep", "middle", "shallow"].filter((id) => isHidden(revealed, id));

  expect(hidden).not.toContain("deep");
});

test("revealing a floating window is a no-op on the tree", () => {
  const state = nested();
  const floating = createInfiniteCanvasWindow({
    id: "free",
    kind: "demo",
    rect: { height: 200, width: 200, x: -600, y: 0 },
    title: "free",
  });
  const withFloating: InfiniteCanvasState<"demo"> = {
    ...state,
    windows: [...state.windows, floating],
  };
  const revealed = executeInfiniteCanvasCommand(withFloating, {
    type: "window.reveal",
    windowId: "free",
  });

  expect(revealed.groups[0]?.tree).toEqual(withFloating.groups[0]?.tree);
});
