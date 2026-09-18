import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./operations";
import type { InfiniteCanvasState } from "./types";
import { isInfiniteCanvasWindowInActiveWorkspace } from "./workspace-membership";

type Kind = "note";

const pane = (id: string) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x: 0, y: 0 },
    title: id,
  });

const twoDesktops = (): InfiniteCanvasState<Kind> => {
  const research = reduceInfiniteCanvasState(
    createInfiniteCanvasState<Kind>({ windows: [pane("sources"), pane("draft")] }),
    {
      activate: false,
      title: "Research",
      type: "workspace.create",
      windowIds: ["sources"],
      workspaceId: "research",
    },
  );
  const writing = reduceInfiniteCanvasState(research, {
    activate: false,
    title: "Writing",
    type: "workspace.create",
    windowIds: ["draft"],
    workspaceId: "writing",
  });

  return reduceInfiniteCanvasState(writing, { type: "workspace.activate", workspaceId: "writing" });
};

const reveal = (state: InfiniteCanvasState<Kind>, windowId: string) =>
  reduceInfiniteCanvasState(state, { type: "window.reveal", windowId });

test("revealing a window on another desktop switches to that desktop", () => {
  const revealed = reveal(twoDesktops(), "sources");

  expect(revealed.activeWorkspaceId).toBe("research");
});

test("the revealed window is one the canvas will actually render", () => {
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

/*
 * Reveal means "make sure you can see it", so a window already in full view keeps the camera where
 * it is. Without this, clicking a note you are looking at pulls the canvas under you.
 */
// Off centre on purpose: a centred window cannot tell a skipped camera move from a no-op one.
const inView = () =>
  createInfiniteCanvasState<Kind>({
    camera: { center: { x: 400, y: 300 }, zoom: 1 },
    viewport: { height: 800, width: 1200 },
    windows: [pane("sources")],
  });

test("a window already in full view is revealed without moving the camera", () => {
  const before = inView();

  expect(reveal(before, "sources").camera).toEqual(before.camera);
});

test("a window off screen is revealed by bringing the camera to it", () => {
  const before = {
    ...inView(),
    camera: { center: { x: 9000, y: 9000 }, zoom: 1 },
  } satisfies InfiniteCanvasState<Kind>;

  expect(reveal(before, "sources").camera).not.toEqual(before.camera);
});
