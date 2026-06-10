import { expect, test } from "vite-plus/test";

import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "#/experiments/infinite-canvas/factory";
import { DEFAULT_INFINITE_CANVAS_CHROME } from "#/experiments/infinite-canvas/constants";
import {
  assertInfiniteCanvasStateMatchesWindowRegistry,
  normalizeInfiniteCanvasStateForWindowRegistry,
  recoverInfiniteCanvasStateForWindowRegistry,
} from "#/experiments/infinite-canvas/registry";
import { getInfiniteCanvasWindowProxies } from "#/experiments/infinite-canvas/window-proxy";
import { parseInfiniteCanvasSerializedState } from "#/experiments/infinite-canvas/validation";
import type {
  InfiniteCanvasState,
  InfiniteCanvasWindowRegistry,
} from "#/experiments/infinite-canvas/types";

type BoundaryWindowKind = "demo" | "note";

const windowRegistry = defineInfiniteCanvasWindowRegistry<BoundaryWindowKind>({
  demo: {
    kind: "demo",
  },
  note: {
    kind: "note",
  },
});

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
    anchorWindowId: "note-window",
    windowIds: ["note-window"],
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
  const validatedEmptyState = assertInfiniteCanvasStateMatchesWindowRegistry(
    emptyState,
    windowRegistry,
  );

  expect(validatedEmptyState).toEqual({
    ...emptyState,
    activeWindowId: null,
    selection: {
      anchorWindowId: null,
      windowIds: [],
    },
  });
  expect(duplicateState.windows).toHaveLength(1);
  expect(duplicateState.windows[0]?.title).toBe("Latest demo");
  expect(duplicateState.selection).toEqual({
    anchorWindowId: "demo-window",
    windowIds: ["demo-window"],
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
  const proxies = getInfiniteCanvasWindowProxies(state, DEFAULT_INFINITE_CANVAS_CHROME);

  expect(proxies.map((proxy) => proxy.id)).toEqual(["demo-window", "note-window"]);
  expect(proxies[1]).toMatchObject({
    bodyLocalRect: {
      height: 118,
      width: 236,
      x: 2,
      y: 40,
    },
    bodyScenePosition: [480, -179, 0],
    bodyWorldRect: {
      height: 118,
      width: 236,
      x: 362,
      y: 120,
    },
    center: {
      x: 480,
      y: 160,
    },
    frameScenePosition: [480, -160, 0],
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
    screenPosition: [440, -330, 0],
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
  const [proxy] = getInfiniteCanvasWindowProxies(state, DEFAULT_INFINITE_CANVAS_CHROME, 2);

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
  expect(proxy?.screenPosition).toEqual([454.5, -301, 0]);
});

test("arktype persisted-state parser rejects unsafe geometry and defaults window mode", () => {
  const parsed = parseInfiniteCanvasSerializedState<BoundaryWindowKind>({
    activeWindowId: "demo-window",
    camera: {
      center: {
        x: 0,
        y: 0,
      },
      zoom: 1,
    },
    extraPersistedField: "deleted",
    version: 1,
    windows: [
      {
        extraWindowField: "deleted",
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
  const invalid = parseInfiniteCanvasSerializedState({
    activeWindowId: "demo-window",
    camera: {
      center: {
        x: Number.POSITIVE_INFINITY,
        y: 0,
      },
      zoom: 1,
    },
    version: 1,
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
  const invalidMode = parseInfiniteCanvasSerializedState({
    activeWindowId: "demo-window",
    camera: {
      center: {
        x: 0,
        y: 0,
      },
      zoom: 1,
    },
    version: 1,
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

  expect(parsed?.windows[0]?.mode).toBe("normal");
  expect("extraPersistedField" in (parsed ?? {})).toBe(false);
  expect("extraWindowField" in (parsed?.windows[0] ?? {})).toBe(false);
  expect(invalid).toBeNull();
  expect(invalidMode).toBeNull();
});

test("registry normalization drops stale persisted window kinds", () => {
  const staleState: InfiniteCanvasState<string> = {
    activeWindowId: "stale-window",
    camera: {
      center: {
        x: 0,
        y: 0,
      },
      zoom: 1,
    },
    interaction: null,
    selection: {
      anchorWindowId: "stale-window",
      windowIds: ["stale-window", "demo-window"],
    },
    snapPreview: null,
    viewport: {
      height: 0,
      width: 0,
    },
    windows: [
      {
        ...demoWindow,
        kind: "demo",
      },
      {
        ...demoWindow,
        id: "stale-window",
        kind: "removed-kind",
      },
    ],
  };
  const normalized = normalizeInfiniteCanvasStateForWindowRegistry(staleState, windowRegistry);

  expect(normalized?.windows.map((window) => window.id)).toEqual(["demo-window"]);
  expect(normalized?.activeWindowId).toBe("demo-window");
  expect(normalized?.selection).toEqual({
    anchorWindowId: "demo-window",
    windowIds: ["demo-window"],
  });
});

test("registry recovery can clear fully stale runtime windows", () => {
  const staleState = createInfiniteCanvasState<string>({
    activeWindowId: "stale-window",
    selection: ["stale-window"],
    windows: [
      {
        ...demoWindow,
        id: "stale-window",
        kind: "removed-kind",
      },
    ],
  });
  const recovered = recoverInfiniteCanvasStateForWindowRegistry(staleState, windowRegistry);

  expect(recovered.windows).toEqual([]);
  expect(recovered.activeWindowId).toBeNull();
  expect(recovered.interaction).toBeNull();
  expect(recovered.snapPreview).toBeNull();
  expect(recovered.selection).toEqual({
    anchorWindowId: null,
    windowIds: [],
  });
});

test("initial state registry assertion fails loudly for unregistered window kinds", () => {
  const broadRegistry = windowRegistry as unknown as InfiniteCanvasWindowRegistry<string>;

  expect(() => {
    assertInfiniteCanvasStateMatchesWindowRegistry(
      createInfiniteCanvasState<string>({
        windows: [
          {
            ...demoWindow,
            kind: "removed-kind",
          },
        ],
      }),
      broadRegistry,
    );
  }).toThrow(/unregistered window kind/);
});
