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
 * A run is a contiguous visible stretch across segments; a segment is one leg. Both queries exist;
 * these pin the difference between them.
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

  expect(run?.length).toBeCloseTo(200);
  expect(segment?.length).toBeCloseTo(100);
});

test("the anchor moves from a quarter along to halfway", () => {
  // Halfway along the elbow is its corner (100, 0); halfway along the longest leg is (50, 0).
  const run = getInfiniteCanvasLongestUnoccludedRun(elbow.segments, []);
  const anchor = run === null ? null : getInfiniteCanvasWorldPathPointAtProgress(run, 0.5);

  expect(anchor?.x).toBeCloseTo(100);
  expect(anchor?.y).toBeCloseTo(0);
});

test("an occluder in the middle splits one run into two", () => {
  // A band across the top leg leaves a stub before it and the remainder after it.
  const runs = getInfiniteCanvasUnoccludedRuns(elbow.segments, [rect(40, -5, 20, 10)]);

  expect(runs).toHaveLength(2);
  // The far side is longer: 40 units of remaining top leg plus the 100-unit descent.
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
  // Which is why the cheaper segment query is still exported.
  const line = getInfiniteCanvasWorldPath([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ]);
  const blocker = [rect(20, -5, 30, 10)];

  expect(getInfiniteCanvasLongestUnoccludedRun(line.segments, blocker)?.length).toBeCloseTo(
    getInfiniteCanvasLongestUnoccludedSegment(line.segments, blocker)?.length ?? -1,
  );
});
