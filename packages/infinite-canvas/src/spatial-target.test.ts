import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import {
  createInfiniteCanvasEdgeTargetResolver,
  createInfiniteCanvasOverlayTargetResolver,
  createInfiniteCanvasSceneObjectTargetResolver,
  getInfiniteCanvasSelectableTargetFromSpatialTarget,
  resolveInfiniteCanvasSpatialTarget,
} from "./spatial-target";

function createTargetState() {
  return createInfiniteCanvasState({
    camera: {
      center: {
        x: 200,
        y: 150,
      },
      zoom: 1,
    },
    viewport: {
      height: 300,
      width: 400,
    },
    windows: [
      createInfiniteCanvasWindow({
        id: "back",
        kind: "card",
        rect: {
          height: 120,
          width: 180,
          x: 120,
          y: 100,
        },
        zIndex: 1,
      }),
      createInfiniteCanvasWindow({
        id: "front",
        kind: "card",
        rect: {
          height: 120,
          width: 180,
          x: 140,
          y: 110,
        },
        zIndex: 2,
      }),
    ],
  });
}

test("resolves empty world targets", () => {
  expect(
    resolveInfiniteCanvasSpatialTarget({
      state: createTargetState(),
      viewportPoint: {
        x: 12,
        y: 24,
      },
    }),
  ).toMatchObject({
    type: "empty-world",
  });
});

test("resolves the topmost window at a viewport point", () => {
  const target = resolveInfiniteCanvasSpatialTarget({
    state: createTargetState(),
    viewportPoint: {
      x: 170,
      y: 130,
    },
  });

  expect(target).toMatchObject({
    area: "header",
    type: "window",
    windowId: "front",
  });
});

test("classifies window body and resize handles", () => {
  const state = createTargetState();

  expect(
    resolveInfiniteCanvasSpatialTarget({
      state,
      viewportPoint: {
        x: 220,
        y: 180,
      },
    }),
  ).toMatchObject({
    area: "body",
    type: "window",
    windowId: "front",
  });

  expect(
    resolveInfiniteCanvasSpatialTarget({
      state,
      viewportPoint: {
        x: 312,
        y: 222,
      },
    }),
  ).toMatchObject({
    area: "resize-handle",
    resizeHandle: "south-east",
    type: "window",
    windowId: "front",
  });
});

test("custom spatial resolvers can run before or after windows", () => {
  const state = createTargetState();
  const beforeWindowTarget = resolveInfiniteCanvasSpatialTarget({
    resolvers: [
      {
        id: "overlay-target",
        phase: "before-windows",
        resolve: ({ viewportPoint, worldPoint }) => ({
          id: "asset-tray",
          kind: "tray",
          type: "overlay",
          viewportPoint,
          worldPoint,
        }),
      },
    ],
    state,
    viewportPoint: {
      x: 170,
      y: 130,
    },
  });
  const windowTarget = resolveInfiniteCanvasSpatialTarget({
    resolvers: [
      {
        id: "scene-target",
        phase: "after-windows",
        resolve: ({ viewportPoint, worldPoint }) => ({
          id: "node-1",
          kind: "node",
          type: "scene-object",
          viewportPoint,
          worldPoint,
        }),
      },
    ],
    state,
    viewportPoint: {
      x: 170,
      y: 130,
    },
  });
  const afterWindowTarget = resolveInfiniteCanvasSpatialTarget({
    resolvers: [
      {
        id: "scene-target",
        phase: "after-windows",
        resolve: ({ viewportPoint, worldPoint }) => ({
          id: "node-1",
          kind: "node",
          type: "scene-object",
          viewportPoint,
          worldPoint,
        }),
      },
    ],
    state,
    viewportPoint: {
      x: 12,
      y: 24,
    },
  });

  expect(beforeWindowTarget).toMatchObject({
    id: "asset-tray",
    type: "overlay",
  });
  expect(windowTarget).toMatchObject({
    type: "window",
    windowId: "front",
  });
  expect(afterWindowTarget).toMatchObject({
    id: "node-1",
    type: "scene-object",
  });
});

test("scene object resolver targets world-space rectangles after windows", () => {
  const resolver = createInfiniteCanvasSceneObjectTargetResolver({
    id: "scene-objects",
    targets: [
      {
        id: "node-1",
        kind: "task-node",
        rect: {
          height: 80,
          width: 90,
          x: 20,
          y: 10,
        },
      },
    ],
  });

  expect(
    resolveInfiniteCanvasSpatialTarget({
      resolvers: [resolver],
      state: createTargetState(),
      viewportPoint: {
        x: 40,
        y: 40,
      },
    }),
  ).toMatchObject({
    id: "node-1",
    kind: "task-node",
    type: "scene-object",
  });

  expect(
    resolveInfiniteCanvasSpatialTarget({
      resolvers: [resolver],
      state: createTargetState(),
      viewportPoint: {
        x: 170,
        y: 130,
      },
    }),
  ).toMatchObject({
    type: "window",
    windowId: "front",
  });
});

test("overlay resolver targets screen-space rectangles before windows", () => {
  const target = resolveInfiniteCanvasSpatialTarget({
    resolvers: [
      createInfiniteCanvasOverlayTargetResolver({
        id: "overlay-targets",
        targets: [
          {
            id: "asset-tray",
            kind: "tray",
            rect: {
              height: 80,
              width: 120,
              x: 150,
              y: 100,
            },
          },
        ],
      }),
    ],
    state: createTargetState(),
    viewportPoint: {
      x: 170,
      y: 130,
    },
  });

  expect(target).toMatchObject({
    id: "asset-tray",
    kind: "tray",
    type: "overlay",
  });
});

test("edge resolver targets the nearest world-space segment inside hit radius", () => {
  const resolver = createInfiniteCanvasEdgeTargetResolver({
    id: "edges",
    targets: [
      {
        end: {
          x: 300,
          y: 40,
        },
        hitRadius: 8,
        id: "far-edge",
        kind: "connector",
        start: {
          x: 20,
          y: 40,
        },
      },
      {
        end: {
          x: 300,
          y: 70,
        },
        hitRadius: 8,
        id: "near-edge",
        kind: "connector",
        start: {
          x: 20,
          y: 70,
        },
      },
    ],
  });

  expect(
    resolveInfiniteCanvasSpatialTarget({
      resolvers: [resolver],
      state: createTargetState(),
      viewportPoint: {
        x: 170,
        y: 68,
      },
    }),
  ).toMatchObject({
    id: "near-edge",
    kind: "connector",
    type: "edge",
  });

  expect(
    resolveInfiniteCanvasSpatialTarget({
      resolvers: [resolver],
      state: createTargetState(),
      viewportPoint: {
        x: 170,
        y: 90,
      },
    }),
  ).toMatchObject({
    type: "empty-world",
  });
});

test("selectable targets are derived only from scene objects and edges", () => {
  const edgeTarget = getInfiniteCanvasSelectableTargetFromSpatialTarget({
    data: {
      label: "depends on",
    },
    id: "edge-a",
    kind: "connector",
    type: "edge",
    viewportPoint: {
      x: 100,
      y: 120,
    },
    worldPoint: {
      x: 100,
      y: 120,
    },
  });
  const windowTarget = getInfiniteCanvasSelectableTargetFromSpatialTarget({
    area: "body",
    type: "window",
    viewportPoint: {
      x: 100,
      y: 120,
    },
    window: createTargetState().windows[0]!,
    windowId: "back",
    worldPoint: {
      x: 100,
      y: 120,
    },
  });

  expect(edgeTarget).toEqual({
    data: {
      label: "depends on",
    },
    id: "edge-a",
    kind: "connector",
    type: "edge",
  });
  expect(windowTarget).toBeNull();
});
