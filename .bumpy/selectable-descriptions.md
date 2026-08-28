---
"@hyphened/infinite-canvas": patch
---

`selection.selectAllVisible` and `view.fitAll` say what they select instead of calling it "visible".

The published descriptions read "Select every visible window on the canvas" and "Fit all visible windows inside the viewport". A caller reads "visible" as "what I can see", which is a reasonable reading and the wrong one: `getSelectableWindowIds` filters on `mode` and workspace membership and never consults the camera.

Measured through WebMCP on a canvas panned away from one of three windows — `selection.selectAllVisible` selected all three, and nothing in the command's name or its sentence said it would. The report that made it visible had to say "offscreen" first.

They now read "every window on this desktop that is not minimized", which is the actual rule. Deliberately not "on screen": a window behind a tab is selected too, because `isSelectableWindow` tests `mode` alone and never asks the group projection.

`getSelectableWindowIds`' own docstring said "selectable means on screen" and is corrected with them — that phrase is where both descriptions came from.

Behaviour is unchanged and correct as it stands. Making selection depend on the camera would mean panning silently changes what "select all" means, and an arrange verb would act on a different set depending on where somebody happened to be looking.

Command ids are untouched. `selectAllVisible` still carries the word in its name, which is a rename and a breaking change; the description is what a caller actually reads and it can be right today.
