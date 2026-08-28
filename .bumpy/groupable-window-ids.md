---
"@hyphened/infinite-canvas": minor
---

What `createGroup` will accept can be asked before dispatching it.

`createInfiniteCanvasGroup` drops members that are missing, minimized, or already inside another
group — dropped rather than stolen, since a window lives in at most one tree. That rule was applied
inside the function and reachable nowhere, so a consumer building a "group these" control had no way
to predict it.

What that costs is enablement. A control counting its own selection offers itself when nothing would
happen: two panes of one shell are both dropped, no members survive, and the call returns the
identical state while the control reports success. One surviving member is worse — it builds a
single-pane group nobody asked for.

`getInfiniteCanvasGroupableWindowIds(state, windowIds)` returns the accepted subset, in the order
given, and `createInfiniteCanvasGroup` now filters through it rather than restating it. Order is
preserved because members lay out in the order they arrive.

Extracted rather than reimplemented, which matters: the alternative a consumer reaches for is a copy
of the predicate, and a copy goes stale the moment this rule is refined — silently, and in the
direction of offering a verb that does nothing.
