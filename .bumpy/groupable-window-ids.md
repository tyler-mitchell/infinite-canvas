---
"@hyphened/infinite-canvas": minor
---

`getInfiniteCanvasGroupableWindowIds(state, windowIds)` returns the IDs that `createInfiniteCanvasGroup` accepts. It preserves the input order.

The function removes IDs for missing, minimized, or grouped windows. `createInfiniteCanvasGroup` uses the same function.

Consumers can use the result to control group-command availability.
