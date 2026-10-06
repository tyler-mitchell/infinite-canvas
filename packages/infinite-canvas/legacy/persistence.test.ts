import { expect, test } from "vite-plus/test";
import { createInfiniteCanvasStore } from "./store";
import { DEFAULT_INFINITE_CANVAS_GROUP_METRICS } from "./layout";
import type { InfiniteCanvasState } from "./types";

type PersistedWindowKind = "demo";

const state: InfiniteCanvasState<PersistedWindowKind> = {
  activeWindowId: "demo-window",
  connections: [],
  camera: {
    center: {
      x: 24,
      y: -12,
    },
    zoom: 1.5,
  },
  activeWorkspaceId: null,
  viewportOccluders: [],
  groupMetrics: DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  groups: [],
  workspaces: [],
  interaction: null,
  selection: {
    anchorTarget: { type: "window" as const, id: "demo-window" },
    targets: [{ type: "window" as const, id: "demo-window" }],
  },
  snapPreview: null,
  viewport: {
    height: 700,
    width: 900,
  },
  viewportInsets: { bottom: 0, left: 0, right: 0, top: 0 },
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

test("serializing layout strips volatile interaction and viewport state on parse", () => {
  const store = createInfiniteCanvasStore({ initialState: state });
  store.dispatch({ type: "interaction.startPan", pointerId: 1, point: { x: 0, y: 0 } });
  expect(store.getState().interaction?.kind).toBe("pan");
  const document = store.snapshot();
  expect(document).not.toHaveProperty("interaction");
  expect(document).not.toHaveProperty("snapPreview");
  expect(document).not.toHaveProperty("viewport");
  const restored = createInfiniteCanvasStore({
    document: JSON.parse(JSON.stringify(document)),
  }).getState();

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

test("omitted selection selects the active window", () => {
  const serialized = JSON.stringify({
    activeWindowId: "demo-window",
    camera: state.camera,
    version: 4,
    windows: state.windows,
  });
  const restored = createInfiniteCanvasStore({ document: JSON.parse(serialized) }).getState();

  expect(restored?.selection).toEqual({
    anchorTarget: { type: "window" as const, id: "demo-window" },
    targets: [{ type: "window" as const, id: "demo-window" }],
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
    selection: { anchorTarget: null, targets: [target, target] },
    version: 4,
    windows: state.windows,
  });
  const restored = createInfiniteCanvasStore({ document: JSON.parse(serialized) }).getState();

  expect(restored?.activeWindowId).toBeNull();
  expect(restored?.selection).toEqual({ anchorTarget: target, targets: [target] });
});

test("parsing empty persisted layouts keeps an empty document valid", () => {
  const serialized = JSON.stringify({
    activeWindowId: "missing-window",
    camera: state.camera,
    selection: {
      anchorTarget: { type: "window" as const, id: "missing-window" },
      targets: [{ type: "window" as const, id: "missing-window" }],
    },
    version: 4,
    windows: [],
  });
  const restored = createInfiniteCanvasStore({ document: JSON.parse(serialized) }).getState();

  expect(restored?.activeWindowId).toBeNull();
  expect(restored?.selection).toEqual({ anchorTarget: null, targets: [] });
  expect(restored?.windows).toEqual([]);
});

test("parsing persisted layouts recovers duplicate window ids", () => {
  const serialized = JSON.stringify({
    activeWindowId: "demo-window",
    camera: state.camera,
    version: 4,
    windows: [
      state.windows[0],
      {
        ...state.windows[0],
        title: "Recovered duplicate",
      },
    ],
  });
  const restored = createInfiniteCanvasStore({ document: JSON.parse(serialized) }).getState();

  expect(restored?.windows).toHaveLength(1);
  expect(restored?.windows[0]?.title).toBe("Recovered duplicate");
  expect(restored?.selection).toEqual({
    anchorTarget: { type: "window" as const, id: "demo-window" },
    targets: [{ type: "window" as const, id: "demo-window" }],
  });
});

test.each([1, 2, 3])("document version %s is rejected", (version) => {
  const document = {
    version,
    activeWindowId: state.activeWindowId,
    camera: state.camera,
    windows: state.windows,
  };
  expect(() => createInfiniteCanvasStore({ document })).toThrow(/version/);
});

test.each([
  {
    name: "camera position",
    patch: { camera: { center: { x: Number.POSITIVE_INFINITY, y: 0 }, zoom: 1 } },
  },
  { name: "zoom", patch: { camera: { center: { x: 0, y: 0 }, zoom: 0 } } },
  {
    name: "window rectangle",
    patch: { windows: [{ ...state.windows[0], rect: { ...state.windows[0]!.rect, width: -1 } }] },
  },
])("invalid persisted $name is rejected", ({ patch }) => {
  const serialized = JSON.stringify({
    version: 4,
    activeWindowId: state.activeWindowId,
    camera: state.camera,
    windows: state.windows,
    ...patch,
  });
  expect(() => createInfiniteCanvasStore({ document: JSON.parse(serialized) })).toThrow();
});
