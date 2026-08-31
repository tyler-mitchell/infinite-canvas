import { expect, test } from "vite-plus/test";

import { executeInfiniteCanvasCommand } from "./commands";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import {
  applyInfiniteCanvasDockPreview,
  createInfiniteCanvasGroup,
  resolveInfiniteCanvasDockPreviewForTarget,
} from "./group-state";
import type { InfiniteCanvasRect, InfiniteCanvasState } from "./types";

const overlaps = (a: InfiniteCanvasRect, b: InfiniteCanvasRect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

function docked(): InfiniteCanvasState<"demo"> {
  const seed = createInfiniteCanvasState<"demo">({
    viewport: { height: 900, width: 1400 },
    windows: [
      createInfiniteCanvasWindow({
        id: "host",
        kind: "demo",
        rect: { height: 300, width: 400, x: 0, y: 0 },
      }),
      createInfiniteCanvasWindow({
        id: "guest",
        kind: "demo",
        rect: { height: 300, width: 400, x: 500, y: 0 },
      }),
    ],
  });
  const preview = resolveInfiniteCanvasDockPreviewForTarget(seed, {
    edge: "center",
    targetId: "host",
    windowId: "guest",
  });

  if (preview === null) {
    throw new Error("the fixture failed to dock");
  }

  return { ...applyInfiniteCanvasDockPreview(seed, preview), activeWindowId: "guest" };
}

test("the fixture really is docked, so the test below is about undocking", () => {
  const state = docked();

  expect(state.groups).toHaveLength(1);
  expect(JSON.stringify(state.groups[0]?.tree)).toContain("guest");
});

test("a commanded undock leaves the window clear of the shell it left", () => {
  const state = docked();
  const after = executeInfiniteCanvasCommand(state, { type: "window.undock" });
  const freed = after.windows.find((window) => window.id === "guest");
  const shell = after.groups[0];

  expect(JSON.stringify(after.groups.map((group) => group.tree))).not.toContain("guest");
  expect(freed).toBeDefined();
  expect(shell).toBeDefined();
  expect(overlaps(freed?.rect ?? shell!.rect, shell!.rect)).toBe(false);
});

test("it keeps the window's size, moving it rather than reshaping it", () => {
  const before = docked().windows.find((window) => window.id === "guest");
  const after = executeInfiniteCanvasCommand(docked(), { type: "window.undock" }).windows.find(
    (window) => window.id === "guest",
  );

  expect(after?.rect.width).toBe(before?.rect.width);
  expect(after?.rect.height).toBe(before?.rect.height);
});

const SOLO_SHELL: InfiniteCanvasRect = { height: 720, width: 544, x: 0, y: 0 };

const solo = (): InfiniteCanvasState<"demo"> => {
  const seed = createInfiniteCanvasState<"demo">({
    viewport: { height: 900, width: 1400 },
    windows: [
      createInfiniteCanvasWindow({
        id: "only",
        kind: "demo",
        rect: { height: 200, width: 300, x: 0, y: 0 },
      }),
      createInfiniteCanvasWindow({
        id: "far",
        kind: "demo",
        rect: { height: 200, width: 300, x: 5000, y: 5000 },
      }),
    ],
  });

  return {
    ...createInfiniteCanvasGroup(seed, {
      groupId: "solo",
      rect: SOLO_SHELL,
      windowIds: ["only"],
    }),
    activeWindowId: "only",
  };
};

test("undocking the last member leaves it where the shell was, rather than beside it", () => {
  const before = solo();

  expect(before.windows.find((window) => window.id === "only")?.rect).toEqual(SOLO_SHELL);

  const after = executeInfiniteCanvasCommand(before, { type: "window.undock" });

  expect(after.groups).toEqual([]);
  expect(after.windows.find((window) => window.id === "only")?.rect).toEqual(SOLO_SHELL);
});

test("the two verbs agree about where a solitary member lands", () => {
  const undocked = executeInfiniteCanvasCommand(solo(), { type: "window.undock" });
  const dissolved = executeInfiniteCanvasCommand(solo(), { type: "group.dissolve" });
  const rectOf = (state: InfiniteCanvasState<"demo">) =>
    state.windows.find((window) => window.id === "only")?.rect;

  expect(rectOf(undocked)).toEqual(rectOf(dissolved));
});
