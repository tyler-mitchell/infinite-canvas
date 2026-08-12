---
"@hyphened/infinite-canvas": minor
---

Bulk lifecycle verbs, and a keyboard-reachable camera.

`selection.close`, `selection.minimize`, and `selection.togglePinned` act on the whole selection as one undoable edit, rather than one entry per window. `togglePinned` brings the selection to one state and picks the one that is not already universal. There is deliberately no bulk maximize — five maximized windows are five windows filling the same viewport.

`view.zoomBy` binds `=` and `-`. Not `Mod` with those, which browsers own above the page.
