import { expect, test } from "vite-plus/test";

import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { DEFAULT_INFINITE_CANVAS_CHROME } from "./constants";
import { getCanvasLayout } from "./layout";
import { getInfiniteCanvasWindowProxies } from "./window-proxy";
import { canvasModel } from "./schema";
import type { InfiniteCanvasWindowRegistry } from "./types";

type BoundaryWindowKind = "demo" | "note";

const demoWindow = createInfiniteCanvasWindow<BoundaryWindowKind>({
  id: "demo-window",
  kind: "demo",
  rect: {
    height: 180,
    width: 260,
    x: 20,
    y: 40,
  },
});

const noteWindow = createInfiniteCanvasWindow<BoundaryWindowKind>({
  id: "note-window",
  kind: "note",
  rect: {
    height: 160,
    width: 240,
    x: 360,
    y: 40,
  },
});

test("consumer factories fill volatile state defaults and normalize selection", () => {
  const state = createInfiniteCanvasState({
    selection: ["missing-window", "note-window"],
    windows: [demoWindow, noteWindow],
  });

  expect(state.activeWindowId).toBe("note-window");
  expect(state.interaction).toBeNull();
  expect(state.snapPreview).toBeNull();
  expect(state.viewport).toEqual({
    height: 0,
    width: 0,
  });
  expect(state.selection).toEqual({
    anchorTarget: { type: "window", id: "note-window" },
    targets: [{ type: "window", id: "note-window" }],
  });
  expect(state.windows[0]).toMatchObject({
    id: "demo-window",
    minSize: {
      height: 160,
      width: 240,
    },
    title: "demo-window",
  });
});

test("consumer factories support empty documents and recover duplicate window ids", () => {
  const emptyState = createInfiniteCanvasState<BoundaryWindowKind>({
    windows: [],
  });
  const duplicateState = createInfiniteCanvasState({
    activeWindowId: "demo-window",
    selection: ["demo-window"],
    windows: [
      demoWindow,
      {
        ...demoWindow,
        rect: {
          ...demoWindow.rect,
          x: 120,
        },
        title: "Latest demo",
      },
    ],
  });
  expect(emptyState).toEqual({
    ...emptyState,
    activeWindowId: null,
    selection: {
      anchorTarget: null,
      targets: [],
    },
  });
  expect(duplicateState.windows).toHaveLength(1);
  expect(duplicateState.windows[0]?.title).toBe("Latest demo");
  expect(duplicateState.selection).toEqual({
    anchorTarget: { type: "window", id: "demo-window" },
    targets: [{ type: "window", id: "demo-window" }],
  });
});

test("consumer window registries fail early when keys and kinds drift apart", () => {
  expect(() => {
    defineInfiniteCanvasWindowRegistry({
      demo: {
        kind: "note",
      },
    } as unknown as InfiniteCanvasWindowRegistry<string>);
  }).toThrow(/registry keys must match/);
});

test("window proxies expose read-only window projection for R3F layers", () => {
  const state = createInfiniteCanvasState({
    activeWindowId: "note-window",
    camera: {
      center: {
        x: 400,
        y: 100,
      },
      zoom: 0.5,
    },
    selection: ["note-window"],
    viewport: {
      height: 600,
      width: 800,
    },
    viewportInsets: { bottom: 0, left: 0, right: 0, top: 0 },
    windows: [
      demoWindow,
      {
        ...noteWindow,
        rect: {
          height: 160,
          width: 240,
          x: 360,
          y: 80,
        },
      },
      {
        ...demoWindow,
        id: "minimized-window",
        mode: "minimized",
      },
    ],
  });
  const proxies = getInfiniteCanvasWindowProxies({
    chrome: DEFAULT_INFINITE_CANVAS_CHROME,
    canvasLayout: getCanvasLayout(state),
    state,
  });

  expect(proxies.map((proxy) => proxy.id)).toEqual([
    "demo-window",
    "note-window",
    "minimized-window",
  ]);
  expect(proxies[1]).toMatchObject({
    bodyLocalRect: {
      height: 116,
      width: 236,
      x: 2,
      y: 42,
    },
    bodyWorldRect: {
      height: 116,
      width: 236,
      x: 362,
      y: 122,
    },
    center: {
      x: 480,
      y: 160,
    },
    frameWorldRect: {
      height: 160,
      width: 240,
      x: 360,
      y: 80,
    },
    isActive: true,
    isSelected: true,
    screenCenter: {
      x: 440,
      y: 330,
    },
    screenRect: {
      height: 80,
      width: 120,
      x: 380,
      y: 290,
    },
    screenSize: {
      height: 80,
      width: 120,
    },
    size: {
      height: 160,
      width: 240,
    },
  });
});

test("window proxies use the same device-pixel-snapped screen projection as DOM windows", () => {
  const state = createInfiniteCanvasState({
    camera: {
      center: {
        x: 100,
        y: 40,
      },
      zoom: 0.65,
    },
    viewport: {
      height: 600,
      width: 800,
    },
    viewportInsets: { bottom: 0, left: 0, right: 0, top: 0 },
    windows: [
      {
        ...demoWindow,
        rect: {
          height: 220,
          width: 320,
          x: 23.477,
          y: -68.092,
        },
      },
    ],
  });
  const [proxy] = getInfiniteCanvasWindowProxies({
    chrome: DEFAULT_INFINITE_CANVAS_CHROME,
    devicePixelRatio: 2,
    canvasLayout: getCanvasLayout(state),
    state,
  });

  expect(proxy?.screenRect).toEqual({
    height: 143,
    width: 208,
    x: 350.5,
    y: 229.5,
  });
  expect(proxy?.screenCenter).toEqual({
    x: 454.5,
    y: 301,
  });
});

test("the document schema validates known fields and preserves extensions", () => {
  const parsed = canvasModel.SerializedState.assert({
    activeWindowId: "demo-window",
    camera: {
      center: {
        x: 0,
        y: 0,
      },
      zoom: 1,
    },
    extraPersistedField: "preserved",
    version: 4,
    windows: [
      {
        extraWindowField: "preserved",
        id: "demo-window",
        isPinned: false,
        kind: "demo",
        minSize: {
          height: 120,
          width: 160,
        },
        rect: {
          height: 180,
          width: 260,
          x: 20,
          y: 40,
        },
        title: "Demo",
        zIndex: 0,
      },
    ],
  });
  const invalid = canvasModel.SerializedState.allows({
    activeWindowId: "demo-window",
    camera: {
      center: {
        x: Number.POSITIVE_INFINITY,
        y: 0,
      },
      zoom: 1,
    },
    version: 4,
    windows: [
      {
        id: "demo-window",
        isPinned: false,
        kind: "demo",
        minSize: {
          height: 120,
          width: 160,
        },
        rect: {
          height: 180,
          width: -260,
          x: 20,
          y: 40,
        },
        title: "Demo",
        zIndex: 0,
      },
    ],
  });
  const invalidMode = canvasModel.SerializedState.allows({
    activeWindowId: "demo-window",
    camera: {
      center: {
        x: 0,
        y: 0,
      },
      zoom: 1,
    },
    version: 4,
    windows: [
      {
        id: "demo-window",
        isPinned: false,
        kind: "demo",
        minSize: {
          height: 120,
          width: 160,
        },
        mode: "floating",
        rect: {
          height: 180,
          width: 260,
          x: 20,
          y: 40,
        },
        title: "Demo",
        zIndex: 0,
      },
    ],
  });

  expect(parsed).toMatchObject({
    extraPersistedField: "preserved",
    windows: [{ extraWindowField: "preserved", mode: "normal" }],
  });
  expect(invalid).toBe(false);
  expect(invalidMode).toBe(false);
});
