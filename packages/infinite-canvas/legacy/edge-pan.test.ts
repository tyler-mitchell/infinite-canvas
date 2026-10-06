import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_EDGE_PAN } from "./constants";
import { getInfiniteCanvasEdgePanVelocity, panCameraByScreenDelta } from "./geometry";
import type { InfiniteCanvasViewport } from "./types";

const viewport: InfiniteCanvasViewport = { height: 800, width: 1280 };

const velocityAt = (
  x: number,
  y: number,
  insets?: Parameters<typeof getInfiniteCanvasEdgePanVelocity>[3],
) => getInfiniteCanvasEdgePanVelocity(viewport, { x, y }, DEFAULT_INFINITE_CANVAS_EDGE_PAN, insets);

test("a pointer clear of every edge does not pan", () => {
  expect(velocityAt(640, 400)).toBeNull();
});

test("the band is the only thing that starts a pan, and it starts from zero", () => {
  const { bandPx } = DEFAULT_INFINITE_CANVAS_EDGE_PAN;

  // Just outside the band on the inner side.
  expect(velocityAt(bandPx + 1, 400)).toBeNull();
  // At the band's inner lip the speed is zero, so entering it is not a jolt.
  expect(velocityAt(bandPx, 400)).toBeNull();
  expect(velocityAt(bandPx - 1, 400)?.x).toBeLessThan(0);
});

test("speed eases across the band and reaches full at the edge", () => {
  const { bandPx, maxSpeedPxPerSecond } = DEFAULT_INFINITE_CANVAS_EDGE_PAN;

  expect(velocityAt(bandPx / 2, 400)?.x).toBeCloseTo(-maxSpeedPxPerSecond / 2, 6);
  expect(velocityAt(0, 400)?.x).toBe(-maxSpeedPxPerSecond);
});

test("a pointer dragged past the edge keeps travelling instead of stalling", () => {
  const { maxSpeedPxPerSecond } = DEFAULT_INFINITE_CANVAS_EDGE_PAN;

  expect(velocityAt(-500, 400)?.x).toBe(-maxSpeedPxPerSecond);
  expect(velocityAt(viewport.width + 500, 400)?.x).toBe(maxSpeedPxPerSecond);
});

test("each edge drives its own axis, and a corner drives both", () => {
  expect(velocityAt(640, 2)?.y).toBeLessThan(0);
  expect(velocityAt(640, viewport.height - 2)?.y).toBeGreaterThan(0);

  const corner = velocityAt(2, 2);

  expect(corner?.x).toBeLessThan(0);
  expect(corner?.y).toBeLessThan(0);
});

test("the band follows the content edge, so chrome cannot hide it", () => {
  const insets = { bottom: 0, left: 264, right: 0, top: 0 };
  const { maxSpeedPxPerSecond } = DEFAULT_INFINITE_CANVAS_EDGE_PAN;

  // 300 is clear of the raw viewport edge but inside the content band, which is
  // the whole point: a 264px rail would otherwise bury the band under itself.
  expect(velocityAt(300, 400)).toBeNull();
  expect(velocityAt(300, 400, insets)?.x).toBeLessThan(0);

  // Behind the rail is past the content edge, and past the edge is full speed —
  // the same rule as a pointer dragged outside the window. Stopping here would
  // halt the pan exactly when the drag has pushed furthest.
  expect(velocityAt(10, 400, insets)?.x).toBe(-maxSpeedPxPerSecond);
});

test("panning left by the returned velocity moves the camera left", () => {
  const velocity = velocityAt(0, 400);
  const camera = { center: { x: 0, y: 0 }, zoom: 1 };
  const panned = panCameraByScreenDelta(camera, {
    x: (velocity?.x ?? 0) * 0.1,
    y: (velocity?.y ?? 0) * 0.1,
  });

  // A pointer held at the left edge reveals world to the left, so the centre decreases.
  expect(panned.center.x).toBeLessThan(camera.center.x);
});
