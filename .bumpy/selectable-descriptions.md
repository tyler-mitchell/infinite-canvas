---
"@hyphened/infinite-canvas": patch
---

The descriptions for `selection.selectAllVisible` and `view.fitAll` state which windows each command includes. Both include every non-minimized window on the current desktop.

This set includes offscreen windows and windows behind group tabs. Command behavior is unchanged.

The documentation for `getSelectableWindowIds` uses the same rule.

`getSelectableWindowIds` filters by `mode` and desktop membership. It does not read the camera.

`isSelectableWindow` also reads `mode` without the group projection.

`selectAllVisible` keeps its existing command ID.
