---
"@hyphened/infinite-canvas": patch
---

The seventeen selection-moving verbs say what they do with a docked window.

`window.nudge.*` translates a docked pane's whole **shell**, and each group moves once however many
of its panes are selected. `window.align.*`, `window.distribute.*` and `window.swap` do the
opposite: a docked pane is **skipped** and only floating windows move.

Both are deliberate. A member's rect is its group's projection, so nudging one directly would be
undone by the next solve — nudging is the keyboard twin of dragging that member's header, which
moves the shell too. `getArrangeableWindows` refuses that route for the arrange verbs on its own
stated ground: moving the shell there "would mean a single command that sometimes moves one window
and sometimes moves five".

Neither was in any description. A caller with one docked pane in a four-window selection got the
whole shell translated by one verb and the pane ignored by its apparent sibling, with nothing in
either sentence to predict it. Measured on exactly that fixture: `window.nudge.right` moved all four
windows and moved the two-member shell the same distance as the floaters, while `window.align.left`
aligned the two floaters and left both shell members untouched.

The behaviour is unchanged — this is what the descriptions failed to say, not what the verbs
failed to do. Enablement was already correct and is untouched: `window.nudge` is offered only with a
non-empty selection, and `window.place` / `window.resize` report unavailable when the active window
is docked, so neither is a silent no-op.

Written as two shared clauses interpolated into the seventeen rather than typed out seventeen times.
A caller reads one description, so every one has to carry it, and hand-copied sentences are exactly
how a consumer's descriptions drifted from these.
