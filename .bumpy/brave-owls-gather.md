---
"@hyphened/infinite-canvas": minor
---

Workspaces: virtual desktops for the canvas.

A workspace is one canvas plus a membership filter — a named set of windows carrying the camera and selection you left it at. Switching is a single undo entry and survives a reload. Membership is group-complete: docking a window into a shell brings the shell's other panes with it.

`workspace.create`, `workspace.activate`, `workspace.cycle`, `workspace.showAll`, `workspace.removeActiveWindow`, and `workspace.moveActiveWindow` — the last of which sends the active window to another desktop as one edit, taking its whole shell along, because leaving siblings behind would have reconciliation pull it straight back.

Deliberately not nested canvases: a canvas inside a canvas needs a second camera and a second input plane, which is a different program.
