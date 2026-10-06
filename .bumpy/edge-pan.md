---
"@hyphened/infinite-canvas": minor
---

A drag held near a viewport edge pans the camera, so an object can be placed outside the region that was visible when the drag started. Every interaction that moves or resizes gets this. A pan interaction does not, because it already moves the camera.

`InfiniteCanvasDesktop` and `InfiniteCanvasViewport` take an `edgePan` prop. It accepts an `InfiniteCanvasEdgePanPolicy` with `bandPx` and `maxSpeedPxPerSecond`. `false` holds the camera still. The default is `DEFAULT_INFINITE_CANVAS_EDGE_PAN`. Memoize a supplied object.

The band is measured from the content viewport, so `viewportInsets` moves it. Chrome cannot bury the band under itself.

Speed is zero at the band's inner lip and eases to full speed at the edge. A pointer dragged past the edge holds full speed, so the pan continues instead of stopping at the boundary.

`getInfiniteCanvasEdgePanVelocity` reports the speed for a point. It returns `null` when the pointer is clear of every edge.
