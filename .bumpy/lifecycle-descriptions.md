---
"@hyphened/infinite-canvas": patch
---

The three lifecycle verbs say what they do to a docked window, and pinning stops claiming to move things.

`activeWindow.togglePinned` read "Pin the active window so panning and fit-all leave it in place".
Neither half was true. Nothing in the camera, the pan handler, or `getVisibleWindowBounds` reads
`isPinned` — fit-all measures every window that is not minimized, pinned or not — and no window is
screen-anchored, so a pinned one travels across the viewport under a pan like any other. What
`toggleWindowPinned` does is move the window into the pinned stacking band, above every unpinned
one, and that is now what it says.

Asserted rather than corrected and left, because a wrong description fails no typecheck and breaks
no test: `pinned-window-behaviour.test.ts` pins that panning leaves a pinned window's rect
untouched, and that fit-all's bounds are identical whether or not the far window is pinned.

`activeWindow.minimize` and `activeWindow.toggleMaximized` both detach a window from its group
before acting — a pane in the dock, or filling the viewport, cannot hold a layout slot — and neither
said so. Maximizing is the sharper one: it takes a docked window out of its group and restoring does
not put it back, so a round trip through maximize permanently removes a pane from its shell.

`activeWindow.close` also detaches, from groups and from every desktop, and is left alone: closing a
window is the one case where removing it from what held it is the only coherent outcome.

Behaviour is unchanged throughout. This is what the sentences failed to say, not what the verbs
failed to do.
