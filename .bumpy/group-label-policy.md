---
"@hyphened/infinite-canvas": minor
---

The `groupLabel` property lets a consumer define the frame label for each group. The callback receives the group and its windows.

This property is independent of `groupTabLabel`.

The default uses `getInfiniteCanvasGroupTitle`. The `groupLabel` callback can return `""` to hide one group label.

Set `chrome.groupLabelSize` to `0` to hide all group labels.
