import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasWindowPresence } from "./window-presence";
import type { InfiniteCanvasState } from "./types";

type PresenceWindowKind = "demo";

const presenceState: InfiniteCanvasState<PresenceWindowKind> = {
  activeWindowId: "active-window",
  camera: {
    center: {
      x: 0,
      y: 0,
    },
    zoom: 1,
  },
  groups: [],
  history: { future: [], past: [] },
  interaction: null,
  selection: {
    anchorWindowId: "active-window",
    windowIds: ["active-window"],
  },
  snapPreview: null,
  viewport: {
    height: 600,
    width: 800,
  },
  windows: [
    {
      id: "minimized-window",
      isPinned: false,
      kind: "demo",
      minSize: {
        height: 120,
        width: 160,
      },
      mode: "minimized",
      rect: {
        height: 220,
        width: 320,
        x: 0,
        y: 0,
      },
      title: "Minimized",
      zIndex: 3,
    },
    {
      id: "active-window",
      isPinned: true,
      kind: "demo",
      minSize: {
        height: 120,
        width: 160,
      },
      mode: "normal",
      rect: {
        height: 220,
        width: 320,
        x: 0,
        y: 0,
      },
      title: "Active",
      zIndex: 2,
    },
    {
      id: "background-window",
      isPinned: false,
      kind: "demo",
      minSize: {
        height: 120,
        width: 160,
      },
      mode: "normal",
      rect: {
        height: 220,
        width: 320,
        x: 0,
        y: 0,
      },
      title: "Background",
      zIndex: 1,
    },
  ],
};

test("window presence groups visible, minimized, pinned, and active windows", () => {
  const presence = getInfiniteCanvasWindowPresence(presenceState);

  expect(presence.activeWindow?.id).toBe("active-window");
  expect(presence.windows.map((window) => window.id)).toEqual([
    "minimized-window",
    "active-window",
    "background-window",
  ]);
  expect(presence.visible.map((window) => window.id)).toEqual([
    "active-window",
    "background-window",
  ]);
  expect(presence.minimized.map((window) => window.id)).toEqual(["minimized-window"]);
  expect(presence.pinned.map((window) => window.id)).toEqual(["active-window"]);
});
