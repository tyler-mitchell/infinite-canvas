import { expect, test } from "vite-plus/test";

import {
  getInfiniteCanvasLongestUnoccludedSegment,
  getInfiniteCanvasSegmentsWithinRect,
  getInfiniteCanvasUnoccludedSegments,
  getInfiniteCanvasWorldPath,
} from "./scene-layer-geometry";
import type { InfiniteCanvasRect } from "./types";

const path = (...points: readonly (readonly [number, number])[]) =>
  getInfiniteCanvasWorldPath(points.map(([x, y]) => ({ x, y })));

const rect = (x: number, y: number, width: number, height: number): InfiniteCanvasRect => ({
  height,
  width,
  x,
  y,
});

const spans = (segments: readonly { start: { x: number }; end: { x: number } }[]) =>
  segments.map((segment) => [Math.round(segment.start.x), Math.round(segment.end.x)]);

test("a line nothing covers comes back whole", () => {
  const line = path([0, 0], [100, 0]);

  expect(spans(getInfiniteCanvasUnoccludedSegments(line.segments, []))).toEqual([[0, 100]]);
});

test("a rect over the middle leaves the two ends, and they keep their own lengths", () => {
  const line = path([0, 0], [100, 0]);
  const uncovered = getInfiniteCanvasUnoccludedSegments(line.segments, [rect(20, -5, 30, 10)]);

  expect(spans(uncovered)).toEqual([
    [0, 20],
    [50, 100],
  ]);
});

test("a rect covering everything leaves nothing", () => {
  const line = path([0, 0], [100, 0]);

  expect(getInfiniteCanvasUnoccludedSegments(line.segments, [rect(-10, -10, 200, 20)])).toEqual([]);
});

test("a rect beside the line does not touch it", () => {
  const line = path([0, 0], [100, 0]);

  expect(spans(getInfiniteCanvasUnoccludedSegments(line.segments, [rect(20, 50, 30, 10)]))).toEqual(
    [[0, 100]],
  );
});

test("overlapping rects are one hole, not two", () => {
  const line = path([0, 0], [100, 0]);
  const uncovered = getInfiniteCanvasUnoccludedSegments(line.segments, [
    rect(20, -5, 30, 10),
    rect(40, -5, 30, 10),
  ]);

  expect(spans(uncovered)).toEqual([
    [0, 20],
    [70, 100],
  ]);
});

test("an elbow keeps the limbs a rect misses", () => {
  const elbow = path([0, 0], [50, 0], [50, 40], [100, 40]);
  const uncovered = getInfiniteCanvasUnoccludedSegments(elbow.segments, [rect(-10, -10, 30, 20)]);

  expect(uncovered.length).toBe(3);
  expect(Math.round(uncovered[0]?.start.x ?? -1)).toBe(20);
});

test("the longest run is the one returned, not the first", () => {
  const line = path([0, 0], [100, 0]);
  const longest = getInfiniteCanvasLongestUnoccludedSegment(line.segments, [rect(20, -5, 30, 10)]);

  expect(Math.round(longest?.start.x ?? -1)).toBe(50);
  expect(Math.round(longest?.length ?? -1)).toBe(50);
});

test("clipping to a rect keeps the inside, where occluding would keep the outside", () => {
  const line = path([0, 0], [100, 0]);
  const window = rect(20, -5, 30, 10);

  expect(spans(getInfiniteCanvasSegmentsWithinRect(line.segments, window))).toEqual([[20, 50]]);
  expect(spans(getInfiniteCanvasUnoccludedSegments(line.segments, [window]))).toEqual([
    [0, 20],
    [50, 100],
  ]);
});

test("a line wholly outside the rect is clipped away entirely", () => {
  const line = path([0, 40], [100, 40]);

  expect(getInfiniteCanvasSegmentsWithinRect(line.segments, rect(0, -10, 100, 20))).toEqual([]);
});

test("an elbow is clipped limb by limb", () => {
  const elbow = path([0, 0], [50, 0], [50, 40], [100, 40]);
  const within = getInfiniteCanvasSegmentsWithinRect(elbow.segments, rect(-10, -10, 70, 25));

  expect(within.length).toBe(2);
  expect(Math.round(within[1]?.end.y ?? -1)).toBe(15);
});

test("a fully hidden line has no longest run", () => {
  const line = path([0, 0], [100, 0]);

  expect(getInfiniteCanvasLongestUnoccludedSegment(line.segments, [rect(-10, -10, 200, 20)])).toBe(
    null,
  );
});

test("between two nearly-touching windows, the anchor is the gap and not the midpoint", () => {
  const left = rect(0, 0, 100, 60);
  const right = rect(110, 0, 100, 60);
  const line = path([50, 30], [160, 30]);
  const longest = getInfiniteCanvasLongestUnoccludedSegment(line.segments, [left, right]);

  expect(Math.round(longest?.start.x ?? -1)).toBe(100);
  expect(Math.round(longest?.end.x ?? -1)).toBe(110);
  expect(Math.round(longest?.length ?? -1)).toBe(10);
});
