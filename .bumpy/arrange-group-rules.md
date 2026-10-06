---
"@hyphened/infinite-canvas": patch
---

The descriptions for seventeen selection commands state their rules for docked windows.

`window.nudge.*` moves each selected group shell once. `window.align.*`, `window.distribute.*`, and `window.swap` skip docked windows.

Command behavior and availability are unchanged.

`getArrangeableWindows` supplies the skipped set for arrange commands.

`window.nudge.right` moves group shells. `window.align.left` skips docked panes.

`window.nudge` requires a non-empty selection. `window.place` and `window.resize` remain unavailable for a docked active window.
