---
"@hyphened/infinite-canvas": patch
---

`workspace.removeActiveWindow` removes the full docked group from the current desktop. The group-complete workspace invariant no longer restores the selected pane.

`workspace.moveActiveWindow` and `workspace.removeActiveWindow` describe this group rule.

`addInfiniteCanvasWindowToWorkspace` is unchanged. Reconciliation still adds all siblings when a consumer adds one group member.

`removeInfiniteCanvasWindowFromWorkspace` previously removed one ID. Then `reconcileInfiniteCanvasWorkspaces` restored the full group.

`workspace-move.test.ts` covers the move direction through `moveInfiniteCanvasWindowsToWorkspace`.

`normalizeInfiniteCanvasWorkspaceWindowIds` defines the group-complete invariant.
