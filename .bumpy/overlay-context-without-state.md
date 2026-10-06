---
"@hyphened/infinite-canvas": major
---

Removed state from the overlay render context. Overlays read state with useInfiniteCanvasSelector or useInfiniteCanvasState, so renderOverlay no longer renders on every camera step.
