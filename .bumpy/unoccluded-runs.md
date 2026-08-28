---
"@hyphened/infinite-canvas": minor
---

"The longest run of a path that nothing covers" is a query you can now actually make.

`getInfiniteCanvasLongestUnoccludedSegment` promised exactly that sentence and returned the longest
_segment_: it reduces over the per-segment clips and never merges adjacent pieces. Every
rect-to-rect connector is routed as an elbow, so a path with nothing covering any of it is still
three segments, and the "longest" is one leg. Anything anchored at its midpoint lands a quarter
along the visible stretch instead of halfway — worst in the case the anchor exists for, a short
stretch between two windows that nearly touch.

`getInfiniteCanvasUnoccludedRuns` merges the clips into contiguous runs, and
`getInfiniteCanvasLongestUnoccludedRun` picks the longest. A run is an `InfiniteCanvasWorldPath`
rather than a new type, because that is what a run is — a polyline with a length and bounds — so
`getInfiniteCanvasWorldPathPointAtProgress(run, 0.5)` is the anchor and no new arithmetic is
introduced.

Adjacency is decided on the joint rather than on which input segment a piece came from, within a
hair: the clip is arithmetic on parametric spans, so a piece ending exactly where the next begins
comes back with the last bit of float error between them, and comparing exactly would split a run
that is visibly continuous.

`getInfiniteCanvasLongestUnoccludedSegment` stays, with a docstring that says segment and means it.
On a straight line a run and a segment are the same answer, and it is the cheaper query there. It
points at the run version for anything routed.

The merge existed in Polkadot as a local workaround and is deleted there. It never belonged in a
consumer — this is path geometry the canvas owns, and both docstrings in this module already said
so.
