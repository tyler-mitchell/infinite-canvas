import { expect, test } from "vite-plus/test";

import { isInfiniteCanvasCommandEnabled } from "./operations";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import {
  createInfiniteCanvasEdgeTargetResolver,
  createInfiniteCanvasOverlayTargetResolver,
  createInfiniteCanvasSceneObjectTargetResolver,
  getInfiniteCanvasSelectionBounds,
} from "./spatial-target";

const EDGE_TARGET = {
  data: undefined,
  id: "edge-1",
  kind: "relation",
  type: "edge",
} as const;

const SCENE_TARGET = {
  data: undefined,
  id: "region-1",
  kind: "region",
  type: "scene-object",
} as const;

const edgeResolver = createInfiniteCanvasEdgeTargetResolver({
  id: "edges",
  targets: [
    {
      end: { x: 300, y: 260 },
      id: "edge-1",
      kind: "relation",
      start: { x: 100, y: 200 },
    },
  ],
});

const sceneResolver = createInfiniteCanvasSceneObjectTargetResolver({
  id: "regions",
  targets: [
    {
      id: "region-1",
      kind: "region",
      rect: { height: 40, width: 60, x: 500, y: 40 },
    },
  ],
});

const stateWith = (targets: readonly (typeof EDGE_TARGET | typeof SCENE_TARGET)[]) =>
  createInfiniteCanvasState({
    selection: { anchorTarget: targets.at(-1) ?? null, targets },
    viewport: { height: 600, width: 800 },
    windows: [
      createInfiniteCanvasWindow({
        id: "note",
        kind: "card",
        rect: { height: 100, width: 100, x: 0, y: 0 },
      }),
    ],
  });

test("an edge's bounds is the box its segment spans", () => {
  expect(
    getInfiniteCanvasSelectionBounds({
      resolvers: [edgeResolver],
      state: stateWith([EDGE_TARGET]),
    }),
  ).toStrictEqual({ height: 60, width: 200, x: 100, y: 200 });
});

test("several selected targets union, across resolvers", () => {
  expect(
    getInfiniteCanvasSelectionBounds({
      resolvers: [edgeResolver, sceneResolver],
      state: stateWith([EDGE_TARGET, SCENE_TARGET]),
    }),
  ).toStrictEqual({ height: 220, width: 460, x: 100, y: 40 });
});

test("a target nothing answers for contributes nothing, rather than the origin", () => {
  expect(
    getInfiniteCanvasSelectionBounds({
      resolvers: [sceneResolver],
      state: stateWith([EDGE_TARGET]),
    }),
  ).toBeNull();
  expect(
    getInfiniteCanvasSelectionBounds({ resolvers: [], state: stateWith([EDGE_TARGET]) }),
  ).toBeNull();
});

test("an overlay resolver does not answer, because its rect is in viewport pixels", () => {
  expect(
    createInfiniteCanvasOverlayTargetResolver({
      id: "overlays",
      targets: [{ id: "edge-1", kind: "relation", rect: { height: 10, width: 10, x: 0, y: 0 } }],
    }).getTargetRect,
  ).toBeUndefined();
});

test("selection bounds covers the windows and the targets together", () => {
  const state = createInfiniteCanvasState({
    selection: {
      anchorTarget: EDGE_TARGET,
      targets: [{ type: "window" as const, id: "note" }, EDGE_TARGET],
    },
    viewport: { height: 600, width: 800 },
    windows: [
      createInfiniteCanvasWindow({
        id: "note",
        kind: "card",
        rect: { height: 100, width: 100, x: 0, y: 0 },
      }),
    ],
  });

  expect(getInfiniteCanvasSelectionBounds({ resolvers: [edgeResolver], state })).toStrictEqual({
    height: 260,
    width: 300,
    x: 0,
    y: 0,
  });
});

test("with no resolvers the answer is the window bounds, so a canvas without targets is unaffected", () => {
  const state = createInfiniteCanvasState({
    selection: {
      anchorTarget: { type: "window" as const, id: "note" },
      targets: [{ type: "window" as const, id: "note" }],
    },
    viewport: { height: 600, width: 800 },
    windows: [
      createInfiniteCanvasWindow({
        id: "note",
        kind: "card",
        rect: { height: 100, width: 100, x: 0, y: 0 },
      }),
    ],
  });

  expect(getInfiniteCanvasSelectionBounds({ state })).toStrictEqual({
    height: 100,
    width: 100,
    x: 0,
    y: 0,
  });
});

test("fit-selection is offered for an edge-only selection, which is the defect this closes", () => {
  const state = stateWith([EDGE_TARGET]);
  const bounds = getInfiniteCanvasSelectionBounds({ resolvers: [edgeResolver], state });

  expect(isInfiniteCanvasCommandEnabled(state, { type: "view.fitSelection" })).toBe(false);
  expect(
    isInfiniteCanvasCommandEnabled(state, { type: "view.fitSelection" }, undefined, bounds),
  ).toBe(true);
});
