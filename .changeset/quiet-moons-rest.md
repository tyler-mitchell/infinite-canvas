---
"@hyphened/infinite-canvas": minor
---

Offscreen windows and group shells are culled without unmounting.

A frame more than 480 screen pixels outside the viewport renders `content-visibility: auto` and stops re-rendering on camera ticks, while staying in the document. Focus, portal roots, body scroll, video playback, and uncontrolled input state all survive a pan-away — which dropping the window from the rendered set would destroy.

Only the active window is exempt. A selection is unbounded, so exempting it would switch culling off under `Mod+A`, which is the one case it exists for.
