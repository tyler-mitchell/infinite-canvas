import { expect, test } from "vite-plus/test";

import {
  getInfiniteCanvasLongestUnoccludedRun,
  getInfiniteCanvasLongestUnoccludedSegment,
  getInfiniteCanvasUnoccludedRuns,
  getInfiniteCanvasWorldPath,
  getInfiniteCanvasWorldPathPointAtProgress,
} from "./scene-layer-geometry";
import type { InfiniteCanvasRect } from "./types";

/**
 * A run is a contiguous visible stretch; a segment is one leg of the description.
 *
 * `getInfiniteCanvasLongestUnoccludedSegment` promised "the longest run" and returned the longest
 * *segment*, never merging adjacent pieces. Every rect-to-rect connector is routed as an elbow, so
 * a path nothing covers is still three segments and the "longest" is one leg — putting anything
 * anchored at its midpoint a quarter along the visible stretch instead of halfway.
 *
 * These pin the difference rather than the fix, because the two functions are both correct now and
 * a reader has to be able to tell which one they want.
 */

const rect = (x: number, y: number, width: number, height: number): InfiniteCanvasRect => ({
  height,
  width,
  x,
  y,
});

/** An elbow: right along the top, down the side. Nothing covers it. */
const elbow = getInfiniteCanvasWorldPath([
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
]);

test("an unoccluded elbow is one run and more than one segment", () => {
  const runs = getInfiniteCanvasUnoccludedRuns(elbow.segments, []);

  expect(elbow.segments.length).toBeGreaterThan(1);
  expect(runs).toHaveLength(1);
  expect(runs[0]?.length).toBeCloseTo(200);
});

test("the longest run is the whole elbow where the longest segment is one leg", () => {
  const run = getInfiniteCanvasLongestUnoccludedRun(elbow.segments, []);
  const segment = getInfiniteCanvasLongestUnoccludedSegment(elbow.segments, []);

  // The discrepancy the run query exists to close, stated as one comparison.
  expect(run?.length).toBeCloseTo(200);
  expect(segment?.length).toBeCloseTo(100);
});

test("the anchor moves from a quarter along to halfway", () => {
  /*
   * What a consumer actually reads off these. Halfway along a 200-unit elbow is the corner at
   * (100, 0); halfway along the longest *segment* is (50, 0) — a quarter of the way along the run.
   */
  const run = getInfiniteCanvasLongestUnoccludedRun(elbow.segments, []);
  const anchor = run === null ? null : getInfiniteCanvasWorldPathPointAtProgress(run, 0.5);

  expect(anchor?.x).toBeCloseTo(100);
  expect(anchor?.y).toBeCloseTo(0);
});

test("an occluder in the middle splits one run into two", () => {
  // A band across the top leg leaves a stub before it and everything after it.
  const runs = getInfiniteCanvasUnoccludedRuns(elbow.segments, [rect(40, -5, 20, 10)]);

  expect(runs).toHaveLength(2);
  // The far side is longer: 40 units of top leg remaining plus the whole 100-unit descent.
  expect(
    getInfiniteCanvasLongestUnoccludedRun(elbow.segments, [rect(40, -5, 20, 10)])?.length,
  ).toBeCloseTo(140);
});

test("a path hidden along its whole length has no run", () => {
  const covered = [rect(-50, -50, 400, 400)];

  expect(getInfiniteCanvasUnoccludedRuns(elbow.segments, covered)).toStrictEqual([]);
  expect(getInfiniteCanvasLongestUnoccludedRun(elbow.segments, covered)).toBeNull();
});

test("on a straight line a run and a segment are the same answer", () => {
  // Which is why the segment query is kept rather than deleted: it is the cheaper one where the
  // distinction does not exist.
  const line = getInfiniteCanvasWorldPath([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ]);
  const blocker = [rect(20, -5, 30, 10)];

  expect(getInfiniteCanvasLongestUnoccludedRun(line.segments, blocker)?.length).toBeCloseTo(
    getInfiniteCanvasLongestUnoccludedSegment(line.segments, blocker)?.length ?? -1,
  );
});
