---
"@hyphened/infinite-canvas": minor
---

The minimap omits a viewport indicator that matches the full inner map area. A camera that contains all mapped content causes this case.

The `viewport` property is `InfiniteCanvasRect | null`. A camera away from mapped windows produces a non-null value.

`bounds` combines the content and camera rectangles. A camera that contains all content supplies the four `bounds` values.

The function omits the indicator when the camera rectangle equals `bounds`.
