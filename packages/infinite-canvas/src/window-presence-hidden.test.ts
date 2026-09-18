import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import {
  applyInfiniteCanvasDockPreview,
  resolveInfiniteCanvasDockPreviewForTarget,
} from "./group-state";
import { getInfiniteCanvasWindowPresence } from "./window-presence";
import type { InfiniteCanvasState } from "./types";

const seed = (): InfiniteCanvasState<"demo"> =>
  createInfiniteCanvasState<"demo">({
    viewport: { height: 800, width: 1200 },
    windows: [
      createInfiniteCanvasWindow({
        id: "host",
        kind: "demo",
        rect: { height: 300, width: 400, x: 0, y: 0 },
        title: "Host",
      }),
      createInfiniteCanvasWindow({
        id: "guest",
        kind: "demo",
        rect: { height: 300, width: 400, x: 500, y: 0 },
        title: "Guest",
      }),
    ],
  });

function tabbed(): InfiniteCanvasState<"demo"> {
  const state = seed();
  const preview = resolveInfiniteCanvasDockPreviewForTarget(state, {
    edge: "center",
    targetId: "host",
    windowId: "guest",
  });

  if (preview === null) {
    throw new Error("the fixture failed to dock");
  }

  return applyInfiniteCanvasDockPreview(state, preview);
}

const ids = (items: readonly Readonly<{ id: string }>[]) => items.map((item) => item.id).sort();

test("a window behind an inactive tab is not visible, and says so", () => {
  const presence = getInfiniteCanvasWindowPresence(tabbed());
  const hidden = presence.windows.filter((window) => window.isHidden);

  expect(hidden).toHaveLength(1);
  expect(presence.visible).toHaveLength(1);
  expect(presence.visible[0]?.isHidden).toBe(false);
  expect(ids(presence.windows)).toEqual(["guest", "host"]);
});

test("a hidden member is still a window, so it can be listed and reached", () => {
  const presence = getInfiniteCanvasWindowPresence(tabbed());

  expect(presence.windows).toHaveLength(2);
});

test("a window another desktop holds is not visible either", () => {
  const state: InfiniteCanvasState<"demo"> = {
    ...seed(),
    activeWorkspaceId: "desk",
    workspaces: [
      {
        camera: { center: { x: 0, y: 0 }, zoom: 1 },
        id: "desk",
        selection: { anchorTarget: null, targets: [] },
        title: "Desk",
        windowIds: ["host"],
      },
    ],
  };
  const presence = getInfiniteCanvasWindowPresence(state);

  expect(ids(presence.visible)).toEqual(["host"]);
  expect(presence.windows.find((window) => window.id === "guest")?.isAdmitted).toBe(false);
  expect(presence.windows).toHaveLength(2);
});

test("with no groups and no workspaces every unminimized window is visible", () => {
  const presence = getInfiniteCanvasWindowPresence(seed());

  expect(ids(presence.visible)).toEqual(["guest", "host"]);
  expect(presence.windows.every((window) => !window.isHidden && window.isAdmitted)).toBe(true);
});
