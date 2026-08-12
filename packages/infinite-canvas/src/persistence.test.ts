import { expect, test } from "vite-plus/test";

import {
  getInfiniteCanvasScopedStorageKey,
  parseInfiniteCanvasStateJson,
  stringifyInfiniteCanvasState,
} from "./persistence";
import type { InfiniteCanvasState } from "./types";

type PersistedWindowKind = "demo";

const state: InfiniteCanvasState<PersistedWindowKind> = {
  activeWindowId: "demo-window",
  camera: {
    center: {
      x: 24,
      y: -12,
    },
    zoom: 1.5,
  },
  activeWorkspaceId: null,
  groups: [],
  workspaces: [],
  history: { future: [], past: [] },
  interaction: {
    kind: "pan",
    originCamera: {
      center: {
        x: 0,
        y: 0,
      },
      zoom: 1,
    },
    originPointer: {
      x: 0,
      y: 0,
    },
    pointerId: 1,
  },
  selection: {
    anchorWindowId: "demo-window",
    windowIds: ["demo-window"],
  },
  snapPreview: {
    guides: [],
    rect: {
      height: 120,
      width: 160,
      x: 0,
      y: 0,
    },
    windowId: "demo-window",
  },
  viewport: {
    height: 700,
    width: 900,
  },
  windows: [
    {
      id: "demo-window",
      isPinned: true,
      kind: "demo",
      minSize: {
        height: 120,
        width: 160,
      },
      mode: "maximized",
      rect: {
        height: 480,
        width: 640,
        x: -20,
        y: 30,
      },
      restoreRect: {
        height: 240,
        width: 320,
        x: 10,
        y: 20,
      },
      title: "Demo",
      zIndex: 4,
    },
  ],
};

test("scoped storage keys isolate persisted layouts by document identity", () => {
  expect(
    getInfiniteCanvasScopedStorageKey({
      documentKey: "workspace/A",
      storageKey: "canvas-layout",
    }),
  ).toBe("canvas-layout::document::workspace%2FA");
  expect(
    getInfiniteCanvasScopedStorageKey({
      storageKey: "canvas-layout",
    }),
  ).toBe("canvas-layout");
  expect(
    getInfiniteCanvasScopedStorageKey({
      documentKey: "workspace/A",
    }),
  ).toBeUndefined();
});

test("serializing layout strips volatile interaction and viewport state on parse", () => {
  const restored = parseInfiniteCanvasStateJson(stringifyInfiniteCanvasState(state), {
    ...state,
    interaction: null,
    snapPreview: null,
    viewport: {
      height: 0,
      width: 0,
    },
  });

  expect(restored?.activeWindowId).toBe("demo-window");
  expect(restored?.camera).toEqual(state.camera);
  expect(restored?.interaction).toBe(null);
  expect(restored?.selection).toEqual(state.selection);
  expect(restored?.snapPreview).toBe(null);
  expect(restored?.viewport).toEqual({
    height: 0,
    width: 0,
  });
  expect(restored?.windows[0]?.restoreRect).toEqual(state.windows[0]?.restoreRect);
});

test("parsing older layouts without selection selects the active window", () => {
  const serialized = JSON.stringify({
    activeWindowId: "demo-window",
    camera: state.camera,
    version: 1,
    windows: state.windows,
  });
  const restored = parseInfiniteCanvasStateJson(serialized, {
    ...state,
    selection: {
      anchorWindowId: null,
      windowIds: [],
    },
  });

  expect(restored?.selection).toEqual({
    anchorWindowId: "demo-window",
    windowIds: ["demo-window"],
  });
});

test("parsing persisted layouts preserves non-window selection targets", () => {
  const target = {
    data: {
      relationId: "edge-1",
    },
    id: "edge-1",
    kind: "dependency",
    type: "edge",
  };
  const serialized = JSON.stringify({
    activeWindowId: "demo-window",
    camera: state.camera,
    selection: {
      anchorWindowId: null,
      targets: [target, target],
      windowIds: [],
    },
    version: 1,
    windows: state.windows,
  });
  const restored = parseInfiniteCanvasStateJson(serialized, state);

  expect(restored?.activeWindowId).toBeNull();
  expect(restored?.selection).toEqual({
    anchorTarget: target,
    anchorWindowId: null,
    targets: [target],
    windowIds: [],
  });
});

test("parsing empty persisted layouts keeps an empty document valid", () => {
  const serialized = JSON.stringify({
    activeWindowId: "missing-window",
    camera: state.camera,
    selection: {
      anchorWindowId: "missing-window",
      windowIds: ["missing-window"],
    },
    version: 1,
    windows: [],
  });
  const restored = parseInfiniteCanvasStateJson(serialized, state);

  expect(restored?.activeWindowId).toBeNull();
  expect(restored?.selection).toEqual({
    anchorWindowId: null,
    windowIds: [],
  });
  expect(restored?.windows).toEqual([]);
});

test("parsing persisted layouts recovers duplicate window ids", () => {
  const serialized = JSON.stringify({
    activeWindowId: "demo-window",
    camera: state.camera,
    version: 1,
    windows: [
      state.windows[0],
      {
        ...state.windows[0],
        title: "Recovered duplicate",
      },
    ],
  });
  const restored = parseInfiniteCanvasStateJson(serialized, state);

  expect(restored?.windows).toHaveLength(1);
  expect(restored?.windows[0]?.title).toBe("Recovered duplicate");
  expect(restored?.selection).toEqual({
    anchorWindowId: "demo-window",
    windowIds: ["demo-window"],
  });
});

test("parsing persisted layouts recovers camera and window-level corruption", () => {
  const serialized = JSON.stringify({
    activeWindowId: "broken-window",
    camera: {
      center: {
        x: Number.POSITIVE_INFINITY,
        y: 0,
      },
      zoom: 0,
    },
    selection: {
      anchorWindowId: "broken-window",
      windowIds: ["broken-window", "demo-window"],
    },
    version: 1,
    windows: [
      {
        ...state.windows[0],
        id: "broken-window",
        rect: {
          ...state.windows[0]?.rect,
          width: -1,
        },
      },
      state.windows[0],
    ],
  });
  const restored = parseInfiniteCanvasStateJson(serialized, state);

  expect(restored?.camera).toEqual(state.camera);
  expect(restored?.activeWindowId).toBe("demo-window");
  expect(restored?.selection).toEqual({
    anchorWindowId: "demo-window",
    windowIds: ["demo-window"],
  });
  expect(restored?.windows.map((window) => window.id)).toEqual(["demo-window"]);
});
