import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { getInfiniteCanvasMinimapLayout, getInfiniteCanvasMinimapWorldPoint } from "./minimap";
import { getInfiniteCanvasOffscreenIndicators } from "./offscreen";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const state = (): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({
    camera: { center: { x: 120, y: 80 }, zoom: 0.75 },
    windows: [
      createInfiniteCanvasWindow<Kind>({
        id: "a",
        kind: "note",
        rect: { height: 200, width: 300, x: -400, y: -250 },
        title: "A",
      }),
      createInfiniteCanvasWindow<Kind>({
        id: "b",
        kind: "note",
        rect: { height: 180, width: 260, x: 700, y: 520 },
        title: "B",
      }),
    ],
  }),
  viewport: { height: 800, width: 1200 },
});

test("a canvas with no windows has no map", () => {
  const empty = {
    ...createInfiniteCanvasState<Kind>({
      camera: { center: { x: 0, y: 0 }, zoom: 1 },
      windows: [],
    }),
    viewport: { height: 800, width: 1200 },
  };

  expect(getInfiniteCanvasMinimapLayout(empty, { height: 104, width: 156 })).toBeNull();
});

test("a desktop admitting none of the canvas's windows has no map either", () => {
  const populated = state();
  const elsewhere: InfiniteCanvasState<Kind> = {
    ...populated,
    activeWorkspaceId: "empty",
    workspaces: [
      {
        camera: { center: { x: 0, y: 0 }, zoom: 1 },
        id: "empty",
        selection: { anchorWindowId: null, windowIds: [] },
        title: "Empty",
        windowIds: [],
      },
    ],
  };

  expect(getInfiniteCanvasMinimapLayout(populated, { height: 104, width: 156 })).not.toBeNull();
  expect(getInfiniteCanvasMinimapLayout(elsewhere, { height: 104, width: 156 })).toBeNull();
});

const offscreenState = (): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
    windows: [
      createInfiniteCanvasWindow<Kind>({
        id: "near",
        kind: "note",
        rect: { height: 200, width: 300, x: 2_000, y: 0 },
        title: "Near",
      }),
      createInfiniteCanvasWindow<Kind>({
        id: "far",
        kind: "note",
        rect: { height: 200, width: 300, x: 9_000, y: 4_000 },
        title: "Far",
      }),
    ],
  }),
  viewport: { height: 800, width: 1200 },
});

const MINIMAP_SIZE = { height: 132, width: 200 };

test("the world point of a projected window round-trips to where it came from", () => {
  const layout = getInfiniteCanvasMinimapLayout(state(), MINIMAP_SIZE);

  expect(layout).not.toBeNull();

  const projected = layout!.windows.find((window) => window.windowId === "a");

  expect(projected).toBeDefined();

  const roundTripped = getInfiniteCanvasMinimapWorldPoint(layout!, {
    x: projected!.rect.x,
    y: projected!.rect.y,
  });

  expect(roundTripped.x).toBeCloseTo(-400, 6);
  expect(roundTripped.y).toBeCloseTo(-250, 6);
});

test("the inverse holds across the whole box, not just at a window", () => {
  const layout = getInfiniteCanvasMinimapLayout(state(), MINIMAP_SIZE)!;

  for (const point of [
    { x: 0, y: 0 },
    { x: MINIMAP_SIZE.width, y: 0 },
    { x: 0, y: MINIMAP_SIZE.height },
    { x: MINIMAP_SIZE.width, y: MINIMAP_SIZE.height },
    { x: MINIMAP_SIZE.width / 2, y: MINIMAP_SIZE.height / 2 },
  ]) {
    const world = getInfiniteCanvasMinimapWorldPoint(layout, point);
    const reprojected = {
      x: layout.offset.x + (world.x - layout.bounds.x) * layout.scale,
      y: layout.offset.y + (world.y - layout.bounds.y) * layout.scale,
    };

    expect(reprojected.x).toBeCloseTo(point.x, 6);
    expect(reprojected.y).toBeCloseTo(point.y, 6);
  }
});

test("the camera's visible rect is inside the box even when it looks at empty space", () => {
  const lost: InfiniteCanvasState<Kind> = {
    ...state(),
    camera: { center: { x: 90_000, y: 90_000 }, zoom: 0.75 },
  };
  const layout = getInfiniteCanvasMinimapLayout(lost, MINIMAP_SIZE)!;
  const { viewport } = layout;

  expect(viewport).not.toBeNull();

  if (viewport === null) {
    return;
  }

  expect(viewport.x).toBeGreaterThanOrEqual(-0.001);
  expect(viewport.y).toBeGreaterThanOrEqual(-0.001);
  expect(viewport.x + viewport.width).toBeLessThanOrEqual(MINIMAP_SIZE.width + 0.001);
  expect(viewport.y + viewport.height).toBeLessThanOrEqual(MINIMAP_SIZE.height + 0.001);
});

test("an unmeasured viewport yields no layout rather than a degenerate one", () => {
  const unmeasured: InfiniteCanvasState<Kind> = { ...state(), viewport: { height: 0, width: 0 } };

  expect(getInfiniteCanvasMinimapLayout(unmeasured, MINIMAP_SIZE)).toBeNull();
  expect(getInfiniteCanvasMinimapLayout(state(), { height: 4, width: 4 })).toBeNull();
});

test("offscreen indicators point at what left the viewport, nearest first", () => {
  const indicators = getInfiniteCanvasOffscreenIndicators(offscreenState());

  expect(indicators.length).toBeGreaterThan(0);

  for (let index = 1; index < indicators.length; index += 1) {
    expect(indicators[index]!.distancePx).toBeGreaterThanOrEqual(indicators[index - 1]!.distancePx);
  }
});

test("a desktop filters the ring: no arrow points at a window it hides", () => {
  const base = offscreenState();
  const filtered: InfiniteCanvasState<Kind> = {
    ...base,
    activeWorkspaceId: "desk",
    workspaces: [
      {
        camera: base.camera,
        id: "desk",
        selection: { anchorWindowId: null, windowIds: [] },
        title: "Desk",
        windowIds: ["near"],
      },
    ],
  };
  const filteredIds = getInfiniteCanvasOffscreenIndicators(filtered).map(
    (indicator) => indicator.id,
  );

  expect(filteredIds).toContain("near");
  expect(filteredIds).not.toContain("far");
  expect(
    getInfiniteCanvasOffscreenIndicators(base)
      .map((indicator) => indicator.id)
      .sort(),
  ).toEqual(["far", "near"]);
});

test("an indicator's angle actually points from the viewport centre toward its target", () => {
  const current = offscreenState();
  const indicators = getInfiniteCanvasOffscreenIndicators(current);

  for (const indicator of indicators) {
    const center = {
      x:
        (indicator.rect.x + indicator.rect.width / 2 - current.camera.center.x) *
          current.camera.zoom +
        current.viewport.width / 2,
      y:
        (indicator.rect.y + indicator.rect.height / 2 - current.camera.center.y) *
          current.camera.zoom +
        current.viewport.height / 2,
    };
    const expected = Math.atan2(
      center.y - current.viewport.height / 2,
      center.x - current.viewport.width / 2,
    );

    expect(indicator.angle).toBeCloseTo(expected, 6);
  }
});

test("a window inside the viewport gets no indicator", () => {
  const onScreen: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({
      camera: { center: { x: 150, y: 100 }, zoom: 1 },
      windows: [
        createInfiniteCanvasWindow<Kind>({
          id: "visible",
          kind: "note",
          rect: { height: 200, width: 300, x: 0, y: 0 },
          title: "Visible",
        }),
      ],
    }),
    viewport: { height: 800, width: 1200 },
  };

  expect(getInfiniteCanvasOffscreenIndicators(onScreen)).toEqual([]);
});

test("a desktop filters the map: a window it hides is neither drawn nor measured", () => {
  const base = state();
  const onDesktop: InfiniteCanvasState<Kind> = {
    ...base,
    activeWorkspaceId: "desk",
    workspaces: [
      {
        camera: base.camera,
        id: "desk",
        selection: { anchorWindowId: null, windowIds: [] },
        title: "Desk",
        windowIds: ["a"],
      },
    ],
  };

  const everything = getInfiniteCanvasMinimapLayout(base, { height: 200, width: 200 });
  const filtered = getInfiniteCanvasMinimapLayout(onDesktop, { height: 200, width: 200 });

  expect(filtered?.windows.map((window) => window.windowId)).toEqual(["a"]);
  expect(filtered?.bounds.width).toBeLessThan(everything?.bounds.width ?? 0);
});
