import { expect, test } from "vite-plus/test";

import { executeInfiniteCanvasCommand } from "./commands";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import {
  applyInfiniteCanvasDockPreview,
  resolveInfiniteCanvasDockPreviewForTarget,
} from "./group-state";
import type { InfiniteCanvasRect, InfiniteCanvasState } from "./types";

/**
 * Undocking by command has to put the window somewhere it can be seen.
 *
 * A tear-out drag deliberately leaves the window where the solver drew it — the pointer is already
 * carrying it and a jump would fight the drag. Invoked from a palette there is no pointer, so the
 * same behaviour left the window inside the shell's footprint, under the tab strip it had just
 * left. Nothing appeared to happen.
 */

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

  // The tree, not the whole group: a group's *title* may legitimately still name a former member,
  // and stringifying the lot made this pass or fail on that rather than on membership.
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
