---
"@hyphened/infinite-canvas": patch
---

The active-window lifecycle descriptions state their behavior for docked windows.

`activeWindow.togglePinned` describes a change to the stacking band. It does not claim that a pinned window is screen-anchored.

`toggleWindowPinned` moves a window into the pinned stacking band. `getVisibleWindowBounds` does not read `isPinned`.

`pinned-window-behaviour.test.ts` covers pan and fit-all behavior.

`activeWindow.minimize` and `activeWindow.toggleMaximized` describe removal from the group. A restore does not return the window to its group.

`activeWindow.close` still removes a window from groups and desktops.

Behavior is unchanged.
