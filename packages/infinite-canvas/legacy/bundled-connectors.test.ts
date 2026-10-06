import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasRectBundledConnectorPaths } from "./scene-layer-geometry";
import type { InfiniteCanvasRect } from "./types";

const rect = (x: number, y: number): InfiniteCanvasRect => ({ height: 100, width: 200, x, y });

const HUB = rect(0, 250);

test("every target on one face leaves through the same point", () => {
  /*
   * The defect this closes: routed in isolation, each connector meets the hub wherever its own
   * ray crosses the boundary, so five relations leave a card at five different places and read as
   * five unrelated lines rather than one fan.
   */
  const paths = getInfiniteCanvasRectBundledConnectorPaths(HUB, [
    rect(600, 0),
    rect(600, 250),
    rect(600, 500),
  ]);
  const starts = paths.map((path) => path.points[0]);

  expect(starts).toStrictEqual([
    { x: 200, y: 300 },
    { x: 200, y: 300 },
    { x: 200, y: 300 },
  ]);
});

test("and shares one trunk, so the fan turns at a single column", () => {
  const paths = getInfiniteCanvasRectBundledConnectorPaths(HUB, [
    rect(600, 0),
    rect(600, 250),
    rect(600, 500),
  ]);
  // Second point of each path is the turn onto the trunk. Midway between x=200 and x=600.
  const trunks = paths.map((path) => path.points[1]?.x);

  expect(trunks).toStrictEqual([400, 400, 400]);
});

test("a target behind the hub gets its own trunk rather than a line doubling back", () => {
  /*
   * Grouping by face is the reason this works. One shared trunk for every target regardless of
   * side would route a westward connector across the hub itself.
   */
  const paths = getInfiniteCanvasRectBundledConnectorPaths(HUB, [rect(600, 250), rect(-600, 250)]);
  const [east, west] = paths;

  expect(east?.points[0]).toStrictEqual({ x: 200, y: 300 });
  expect(west?.points[0]).toStrictEqual({ x: 0, y: 300 });
  expect(east?.points[1]?.x).toBe(400);
  expect(west?.points[1]?.x).toBe(-200);
});

test("a target above takes the north face and a horizontal trunk", () => {
  const [path] = getInfiniteCanvasRectBundledConnectorPaths(HUB, [rect(0, -400)]);

  // Leaves the top edge, turns onto a row, and lands on the target's bottom edge.
  expect(path?.points[0]).toStrictEqual({ x: 100, y: 250 });
  expect(path?.points.at(-1)).toStrictEqual({ x: 100, y: -300 });
  expect(path?.points[1]?.y).toBe(-25);
});

test("the trunk follows the nearest target in its group, not the farthest", () => {
  /*
   * A far target must not push the turn out past a near one, or the fan crosses the near card.
   */
  const paths = getInfiniteCanvasRectBundledConnectorPaths(HUB, [rect(400, 0), rect(2000, 500)]);

  expect(paths.map((path) => path.points[1]?.x)).toStrictEqual([300, 300]);
});

test("paths come back in the order the targets were given", () => {
  const paths = getInfiniteCanvasRectBundledConnectorPaths(HUB, [
    rect(600, 500),
    rect(-600, 250),
    rect(600, 0),
  ]);

  expect(paths.map((path) => path.points.at(-1)?.x)).toStrictEqual([600, -400, 600]);
});

test("a target level with the hub collapses to a straight run", () => {
  /*
   * Both trunk points land on the same spot when there is no height to cross, and the path drops
   * the repeat rather than carrying a zero-length segment into rendering and hit-testing.
   */
  const [path] = getInfiniteCanvasRectBundledConnectorPaths(HUB, [rect(600, 250)]);

  expect(path?.points.map((point) => [point.x, point.y])).toStrictEqual([
    [200, 300],
    [400, 300],
    [600, 300],
  ]);
});

test("no targets is an empty result rather than a throw", () => {
  expect(getInfiniteCanvasRectBundledConnectorPaths(HUB, [])).toStrictEqual([]);
});
