---
"@hyphened/infinite-canvas": minor
---

A group draws its name.

`title` was modelled, persisted, and settable through `setGroupTitle`, but the only places it reached were the shell's `aria-label` and a fallback tab label for a nested split — so a named group looked exactly like an unnamed one. Measured in a browser: a two-member split named "Reading list" rendered that string zero times.

It is now drawn above the shell's top edge, the way a frame is labelled: outside the rect, so it reserves no room the layout solver would have to give it and can never sit over a pane. Styled through the new `group-label` slot and `--icx-group-label-fg`; a group whose title is empty draws nothing.
