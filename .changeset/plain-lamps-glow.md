---
"@hyphened/infinite-canvas": minor
---

Window chrome simplifies at far zoom instead of rendering illegibly.

Resize handles are a constant _screen_ size by design, so on a window a few tens of pixels wide each handle is larger than the window it surrounds. At `summary` detail a frame renders no resize handles, no title, and no control buttons, and a group shell drops its own eight handles on the same band.

Tab strips and accordion headers deliberately stay at every zoom: they are sized in world units so they shrink with the group, and they are focusable controls carrying roving `tabIndex` — the only means of switching a tab or a fold.
