---
"@hyphened/infinite-canvas": minor
---

The minimap's viewport indicator is withheld when it would trace the box's own edge.

`bounds` unions the camera's visible rect in unconditionally — correctly, so a traveller who pans
away from every window still has somewhere to be inside the map. The consequence is that a camera
which _contains_ everything drawn becomes the bounds, and the projection then maps the indicator
onto the whole inner area. It cannot move, cannot shrink, and carries no information at any zoom.

The empty-canvas rule already refused exactly this projection, and its note described the mechanism
in full — "`bounds` _is_ the visible rect, so the projection maps it onto the whole inner area,
every time, at every zoom". That fix stopped at the case where there is no content at all. The same
degeneracy with content present is far more common: every fit-all lands in it, and so does every
canvas whose windows happen to be on screen together.

Seen in a browser rather than reasoned about. The indicator measured 144×90 inside a 156×104 map —
a six-pixel inset all round, which is the padding — so it read as an accent border on the overview
panel rather than as a position within it. Polkadot's own minimap had recorded the symptom as a
styling constraint, in a comment explaining that the viewport "covers most of the map at ordinary
zoom" and therefore had to be stroked rather than filled.

`viewport` is now `InfiniteCanvasRect | null`, so a consumer cannot draw the meaningless one by
accident. Exact equality against the visible rect decides it, not a tolerance: `bounds` is a union,
so when the camera contains the content all four numbers came from it unchanged, while a camera a
hair larger than its content is a real position worth drawing.

Panning away from every window is unaffected and is asserted both ways — that case keeps its
indicator, and the module's existing test for it now pins non-null rather than reading through it.
