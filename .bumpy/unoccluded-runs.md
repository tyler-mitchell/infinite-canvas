---
"@hyphened/infinite-canvas": minor
---

`getInfiniteCanvasUnoccludedRuns` merges adjacent visible path segments into contiguous runs. Each run is an `InfiniteCanvasWorldPath`.

`getInfiniteCanvasLongestUnoccludedRun` returns the longest run.

Use `getInfiniteCanvasWorldPathPointAtProgress(run, 0.5)` to get its midpoint.

The merge accepts floating-point differences at segment joints.

For a straight path, `getInfiniteCanvasLongestUnoccludedSegment` returns the same result with less work.
