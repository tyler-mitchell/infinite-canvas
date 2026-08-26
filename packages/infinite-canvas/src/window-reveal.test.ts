import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";
import { isInfiniteCanvasWindowInActiveWorkspace } from "./workspace-membership";

/**
 * Going to a window means going where it is.
 *
 * `getNavigableWindow` filters on `minimized` alone, so a window a desktop hides is still a
 * navigation target — the camera travelled to a rect nothing renders and the window read as lost.
 * Every consumer that names a window off-canvas hit this, and none of them had changed.
 */

type Kind = "note";

const pane = (id: string) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x: 0, y: 0 },
    title: id,
  });

/** `sources` filed on Research, `draft` on Writing, and Writing is the one you are looking at. */
const twoDesktops = (): InfiniteCanvasState<Kind> => {
  const research = reduceInfiniteCanvasState(
    createInfiniteCanvasState<Kind>({ windows: [pane("sources"), pane("draft")] }),
    {
      title: "Research",
      type: "workspace.create",
      windowIds: ["sources"],
      workspaceId: "research",
    },
  );
  const writing = reduceInfiniteCanvasState(research, {
    title: "Writing",
    type: "workspace.create",
    windowIds: ["draft"],
    workspaceId: "writing",
  });

  return reduceInfiniteCanvasState(writing, { type: "workspace.activate", workspaceId: "writing" });
};

const reveal = (state: InfiniteCanvasState<Kind>, windowId: string) =>
  reduceInfiniteCanvasState(state, {
    command: { type: "window.reveal", windowId },
    type: "command.execute",
  });

test("revealing a window on another desktop switches to that desktop", () => {
  const revealed = reveal(twoDesktops(), "sources");

  expect(revealed.activeWorkspaceId).toBe("research");
});

test("the revealed window is one the canvas will actually render", () => {
  // The property the desktop switch is a proxy for, asserted through the predicate the window
  // layer consults. Landing on the right desktop with the window still filtered out is the bug.
  const revealed = reveal(twoDesktops(), "sources");

  expect(isInfiniteCanvasWindowInActiveWorkspace(revealed, "sources")).toBe(true);
});

test("it focuses the window it reveals", () => {
  const revealed = reveal(twoDesktops(), "sources");

  expect(revealed.activeWindowId).toBe("sources");
});

test("a window on no desktop is revealed by leaving the current one", () => {
  const orphan = reduceInfiniteCanvasState(twoDesktops(), {
    type: "window.open",
    window: pane("loose"),
  });
  // Opening put it on Writing, so take it back off to model the window that belongs nowhere.
  const filed = reduceInfiniteCanvasState(orphan, {
    type: "workspace.setWindows",
    windowIds: ["draft"],
    workspaceId: "writing",
  });

  const revealed = reveal(filed, "loose");

  expect(revealed.activeWorkspaceId).toBeNull();
  expect(isInfiniteCanvasWindowInActiveWorkspace(revealed, "loose")).toBe(true);
});

test("a minimized window is restored on the way", () => {
  const minimized = reduceInfiniteCanvasState(twoDesktops(), {
    type: "window.minimize",
    windowId: "sources",
  });

  const revealed = reveal(minimized, "sources");

  expect(revealed.windows.find((window) => window.id === "sources")?.mode).not.toBe("minimized");
});

test("a window on the desktop you are already on does not move you off it", () => {
  const revealed = reveal(twoDesktops(), "draft");

  expect(revealed.activeWorkspaceId).toBe("writing");
  expect(revealed.activeWindowId).toBe("draft");
});

test("a canvas with no desktops still focuses and keeps showing everything", () => {
  const plain = createInfiniteCanvasState<Kind>({ windows: [pane("sources"), pane("draft")] });

  const revealed = reveal(plain, "sources");

  expect(revealed.activeWindowId).toBe("sources");
  expect(revealed.activeWorkspaceId).toBeNull();
});
