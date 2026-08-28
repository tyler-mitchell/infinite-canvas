import { expect, test } from "vite-plus/test";

import { isInfiniteCanvasCommandEnabled } from "./commands";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import {
  createInfiniteCanvasEdgeTargetResolver,
  createInfiniteCanvasOverlayTargetResolver,
  createInfiniteCanvasSceneObjectTargetResolver,
  getInfiniteCanvasSelectionBounds,
  getInfiniteCanvasSelectionTargetBounds,
} from "./spatial-target";

/**
 * A selection that is not windows still has a place, and the canvas can ask where.
 *
 * Selecting a connector filled `selection.targets`, left `windowIds` empty, and every control that
 * frames a selection withdrew: the HUD's fit button reads a selection's bounds, and bounds were
 * windows only. The geometry was never missing — the resolvers that hit-test an edge hold it — it
 * just could not be asked for outside a pointer event.
 *
 * A lookup rather than a rect kept on the target: a rect copied onto a selection goes stale the
 * moment the object moves, and an object that has been removed has no rect at all.
 */

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
    selection: {
      anchorTarget: targets.at(-1) ?? null,
      anchorWindowId: null,
      targets,
      windowIds: [],
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

test("an edge's bounds is the box its segment spans", () => {
  expect(
    getInfiniteCanvasSelectionTargetBounds({
      resolvers: [edgeResolver],
      state: stateWith([EDGE_TARGET]),
    }),
  ).toStrictEqual({ height: 60, width: 200, x: 100, y: 200 });
});

test("several selected targets union, across resolvers", () => {
  expect(
    getInfiniteCanvasSelectionTargetBounds({
      resolvers: [edgeResolver, sceneResolver],
      state: stateWith([EDGE_TARGET, SCENE_TARGET]),
    }),
  ).toStrictEqual({ height: 220, width: 460, x: 100, y: 40 });
});

test("a target nothing answers for contributes nothing, rather than the origin", () => {
  /*
   * The removed-object case, and the unmounted-resolver case, are the same shape. Answering (0,0)
   * for either would drag the fit to a corner nothing is in — worse than not offering the fit,
   * because it looks like it worked.
   */
  expect(
    getInfiniteCanvasSelectionTargetBounds({
      resolvers: [sceneResolver],
      state: stateWith([EDGE_TARGET]),
    }),
  ).toBeNull();
  expect(
    getInfiniteCanvasSelectionTargetBounds({ resolvers: [], state: stateWith([EDGE_TARGET]) }),
  ).toBeNull();
});

test("an overlay resolver does not answer, because its rect is in viewport pixels", () => {
  // Fitting a camera to a screen-space rect would frame a world position that means nothing. Its
  // targets are unselectable anyway, so this is the type saying so rather than a runtime guard.
  expect(
    createInfiniteCanvasOverlayTargetResolver({
      id: "overlays",
      targets: [{ id: "edge-1", kind: "relation", rect: { height: 10, width: 10, x: 0, y: 0 } }],
    }).getTargetRect,
  ).toBeUndefined();
});

test("selection bounds covers the windows and the targets together", () => {
  // A mixed selection is the case neither half answers alone: the window is at the origin, the edge
  // ends at (300, 260), and framing either one on its own leaves the other off screen.
  const state = createInfiniteCanvasState({
    selection: {
      anchorTarget: EDGE_TARGET,
      anchorWindowId: "note",
      targets: [EDGE_TARGET],
      windowIds: ["note"],
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
    selection: { anchorWindowId: "note", windowIds: ["note"] },
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
  /*
   * The witness: a connector was selected, visibly, and the one control that would frame it was
   * disabled — `view.fitSelection` asked `getSelectedWindowBounds`, which an edge selection cannot
   * answer. Without the bounds argument it still cannot, which is what a caller that has not asked
   * its resolvers should see.
   */
  const state = stateWith([EDGE_TARGET]);
  const bounds = getInfiniteCanvasSelectionBounds({ resolvers: [edgeResolver], state });

  expect(isInfiniteCanvasCommandEnabled(state, { type: "view.fitSelection" })).toBe(false);
  expect(
    isInfiniteCanvasCommandEnabled(state, { type: "view.fitSelection" }, undefined, bounds),
  ).toBe(true);
});
