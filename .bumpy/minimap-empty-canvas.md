---
"@hyphened/infinite-canvas": patch
---

`getInfiniteCanvasMinimapLayout` returns `null` when there is nothing to map, as it documented.

Its docstring already promised `null` for an empty canvas, and the code could not deliver it. The camera's visible rect is unioned into `bounds` unconditionally — correctly, so a traveller is never pushed outside the box — which also means `bounds` is never empty and the early return never fired. A canvas with no windows returned a layout whose only content was the viewport indicator, and by construction that indicator then filled the entire box: `bounds` _is_ the visible rect, so it projects onto the whole inner area at every zoom and every position. It could show one thing, forever, and answered "where am I in it" with "there is no it".

That is the degenerate projection the docstring's own closing rule exists to refuse.

"Nothing to map" is the function's already-filtered set rather than `state.windows`, so a desktop admitting none of a full canvas's windows is correctly nothing too — the same correction `window.reveal`, the offscreen ring, and this function's own desktop filter each took.

Found by drawing the map in a browser for the first time, which is also the first moment anyone could have seen it: the module shipped `@experimental` on the stated ground that no minimap had ever been rendered.

Consumers that render the map only when the layout is non-null need no change. One that renders chrome around it unconditionally will now get `null` on an empty canvas and should drop the chrome with it.
