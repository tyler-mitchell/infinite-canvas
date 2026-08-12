---
"@hyphened/infinite-canvas": minor
---

Workspaces, offscreen culling, bulk selection verbs, and a keyboard-reachable camera.

**Workspaces** are virtual desktops: a named set of windows carrying the camera and selection you left it at. Switching is a single undo entry, survives a reload, and membership is group-complete — docking a window into a shell brings the shell's other panes with it. Reached through `workspace.create`, `workspace.activate`, `workspace.cycle`, `workspace.showAll`, and `workspace.removeActiveWindow`.

**Offscreen windows and group shells are culled without unmounting.** A frame more than 480 screen pixels outside the viewport renders `content-visibility: auto` and stops re-rendering on camera ticks, while staying in the document — so focus, portal roots, body scroll, video playback, and uncontrolled input state all survive a pan-away. Only the active window is exempt; a selection is unbounded, so exempting it would switch culling off exactly when it matters.

**Chrome simplifies at far zoom.** Resize handles are a constant screen size, so on a window a few tens of pixels wide they are larger than the window itself. At `summary` detail the frame renders no handles, no title, and no control buttons. Tab strips and accordion headers deliberately stay: they scale with the group and are the only way to switch a tab or fold.

**Bulk lifecycle verbs.** `selection.close`, `selection.minimize`, and `selection.togglePinned` act on the whole selection as one undoable edit. There is no bulk maximize — five maximized windows are five windows filling the same viewport.

**The camera is reachable from the keyboard.** `view.zoomBy` binds `=` and `-`. Not `Mod`+those, which browsers own above the page.

Fixes:

- A window opened while a workspace was active joined no workspace, so the window layer dropped it on the frame it was created and nothing appeared.
- The store dropped every workspace action. `commitInfiniteCanvasState` wrote a hand-listed set of fields that omitted `workspaces` and `activeWorkspaceId`, which made the whole feature unreachable through the public API. The commit is now generic over the state's own keys.
- Closing a window from a command left its id a phantom member of every workspace that held it; only the action path detached.
- `cloneInfiniteCanvasState` and the persistence envelope both dropped `workspaces`, so it could not survive a clone or a reload.
- A `process.env.NODE_ENV` reference leaked a `@types/node` requirement onto every consumer that typechecks this package's source.
