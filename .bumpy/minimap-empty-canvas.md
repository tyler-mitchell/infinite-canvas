---
"@hyphened/infinite-canvas": patch
---

For a filtered desktop with no mappable windows, `getInfiniteCanvasMinimapLayout` returns `null`.

An empty canvas no longer returns a layout that contains only the viewport indicator.

A consumer that renders only non-null layouts requires no change.

If a consumer renders minimap chrome without a layout, it must hide that chrome for `null`.

`bounds` includes the visible camera rectangle. Previously, this made `bounds` non-empty and let `bounds` contain only the viewport.

The empty rule uses the filtered map set instead of `state.windows`. `window.reveal` uses the same desktop filter.

The layout remains `@experimental`.
