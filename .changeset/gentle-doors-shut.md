---
"@hyphened/infinite-canvas": patch
---

Fix workspaces being unreachable through the public API.

`commitInfiniteCanvasState` wrote a hand-listed set of state fields into the observable, and `workspaces` and `activeWorkspaceId` were not on it — so every workspace action reduced correctly and was then thrown away. Since the reducer is not exported, the store is the public path, which made the whole feature unusable except through `initialState`. The commit is now generic over the state's own keys, so there is no list left to go stale.

Also fixed, all from the same shape of defect:

- A window opened while a desktop was active joined no desktop, so the window layer dropped it on the frame it was created.
- Closing a window from a command left its id a phantom member of every workspace holding it; only the action path detached.
- `cloneInfiniteCanvasState` and the persistence envelope both dropped `workspaces`, so it survived neither a clone nor a reload.
