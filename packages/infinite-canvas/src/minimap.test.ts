import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { getInfiniteCanvasMinimapLayout, getInfiniteCanvasMinimapWorldPoint } from "./minimap";
import { getInfiniteCanvasOffscreenIndicators } from "./offscreen";
import type { InfiniteCanvasState } from "./types";

/**
 * The two navigation-geometry modules, neither of which had a test.
 *
 * Both are claimed in `README.md` — "projects windows, groups, and the camera's visible rect into
 * a box of your choosing, and `getInfiniteCanvasMinimapWorldPoint` inverts it for
 * click-to-navigate" — and `minimap.ts` says in its own comment that the inverse "must stay the
 * inverse: a consumer that re-derives it will disagree at the edges, and the camera will land a
 * few units from where the user clicked." That is a falsifiable arithmetic claim, and nothing
 * was falsifying it.
 */

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

/**
 * Windows placed genuinely outside the visible rect.
 *
 * The first draft of the offscreen tests reused the fixture above and asserted that both of its
 * windows were offscreen. They are not: at zoom 0.75 in a 1200x800 viewport the camera sees
 * x -680..920 and y -453..613, which contains both. The function was right and the test was
 * wrong — the same way round as the semantic-LOD case, and worth stating rather than quietly
 * moving the numbers.
 */
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
  // The inverse claim, stated as a round trip rather than as an implementation detail: project a
  // world rect into the box, hand its minimap origin back, and the world origin must return.
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
  // Edge behaviour is where a re-derived inverse goes wrong, so sample the corners and centre.
  const layout = getInfiniteCanvasMinimapLayout(state(), MINIMAP_SIZE)!;

  for (const point of [
    { x: 0, y: 0 },
    { x: MINIMAP_SIZE.width, y: 0 },
    { x: 0, y: MINIMAP_SIZE.height },
    { x: MINIMAP_SIZE.width, y: MINIMAP_SIZE.height },
    { x: MINIMAP_SIZE.width / 2, y: MINIMAP_SIZE.height / 2 },
  ]) {
    const world = getInfiniteCanvasMinimapWorldPoint(layout, point);
    // Re-project by hand using only the layout's published fields — the exact arithmetic a
    // consumer would write — and require it to land back on the input.
    const reprojected = {
      x: layout.offset.x + (world.x - layout.bounds.x) * layout.scale,
      y: layout.offset.y + (world.y - layout.bounds.y) * layout.scale,
    };

    expect(reprojected.x).toBeCloseTo(point.x, 6);
    expect(reprojected.y).toBeCloseTo(point.y, 6);
  }
});

test("the camera's visible rect is inside the box even when it looks at empty space", () => {
  // The documented reason the camera rect is unioned into the bounds: pan away from every window
  // and the position marker must still have somewhere to be, or the overview loses you exactly
  // when you reached for it.
  const lost: InfiniteCanvasState<Kind> = {
    ...state(),
    camera: { center: { x: 90_000, y: 90_000 }, zoom: 0.75 },
  };
  const layout = getInfiniteCanvasMinimapLayout(lost, MINIMAP_SIZE)!;

  expect(layout.viewport.x).toBeGreaterThanOrEqual(-0.001);
  expect(layout.viewport.y).toBeGreaterThanOrEqual(-0.001);
  expect(layout.viewport.x + layout.viewport.width).toBeLessThanOrEqual(MINIMAP_SIZE.width + 0.001);
  expect(layout.viewport.y + layout.viewport.height).toBeLessThanOrEqual(
    MINIMAP_SIZE.height + 0.001,
  );
});

test("an unmeasured viewport yields no layout rather than a degenerate one", () => {
  const unmeasured: InfiniteCanvasState<Kind> = { ...state(), viewport: { height: 0, width: 0 } };

  expect(getInfiniteCanvasMinimapLayout(unmeasured, MINIMAP_SIZE)).toBeNull();
  // A box too small to hold its own padding is the other degenerate case.
  expect(getInfiniteCanvasMinimapLayout(state(), { height: 4, width: 4 })).toBeNull();
});

test("offscreen indicators point at what left the viewport, nearest first", () => {
  // Both windows sit far outside the visible rect, so both are offscreen, and the nearer one
  // must come first — the sort is what makes a capped list meaningful.
  const indicators = getInfiniteCanvasOffscreenIndicators(offscreenState());

  expect(indicators.length).toBeGreaterThan(0);

  for (let index = 1; index < indicators.length; index += 1) {
    expect(indicators[index]!.distancePx).toBeGreaterThanOrEqual(indicators[index - 1]!.distancePx);
  }
});

test("an indicator's angle actually points from the viewport centre toward its target", () => {
  // The claim a consumer relies on: rotate a right-pointing chevron by `angle` and it aims at the
  // window. Recompute the bearing from the returned rect and require agreement.
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
  // The lane must stay off for what the user can already see, or the arrows are noise.
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
