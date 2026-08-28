---
"@hyphened/infinite-canvas": patch
---

Taking a docked window off a desktop now actually takes it off.

`workspace.removeActiveWindow` was a silent no-op on anything docked into a group.
`removeInfiniteCanvasWindowFromWorkspace` dropped the named id alone, and then
`reconcileInfiniteCanvasWorkspaces` — which re-expands every workspace to whole groups after
every action, because membership is group-complete — pulled the pane straight back into the
desktop it had just left. Measured on a three-window canvas with two of them docked: membership
before and after the command was `["a", "b", "c"]` both times, and the active window stayed
active on a desktop it was supposed to have left.

This is the exact failure `workspace-move.test.ts` guards for the move direction and nothing
guarded for the remove direction. `moveInfiniteCanvasWindowsToWorkspace` avoids it by naming the
group-complete set up front; the removal half never did.

It now removes the same expanded set. Whole shell rather than a refusal, for the reason
`normalizeInfiniteCanvasWorkspaceWindowIds` already gives about the other direction: the honest
reading of "take this off the desktop" includes the thing the window is docked into.

Its counterpart `addInfiniteCanvasWindowToWorkspace` is unchanged and needs no expansion.
Reconciliation _completes_ an under-filled membership, so adding one pane already brings its
siblings — add was redundant with the invariant where remove was defeated by it.

`workspace.moveActiveWindow` and `workspace.removeActiveWindow` both say the group rule now.
Move already behaved this way and its description did not mention it; a caller reads one
sentence, not the pair, so both carry it.
