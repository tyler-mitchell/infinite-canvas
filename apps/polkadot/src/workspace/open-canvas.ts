import { observable } from "@legendapp/state";

/**
 * Which canvas is open, the way `open-project.ts` holds which project is.
 *
 * That file closes with "Set once by the workspace from the route's loaded canvas, which is the only
 * thing that genuinely knows", and the same was true one level down and had nowhere to be said. The
 * canvas id was threaded as a prop to whatever happened to need it, so the surfaces that sit deepest
 * — the selection rail and the context menu, which already ask `openProject$` for the project — had
 * no way to name the document they were acting in.
 *
 * That is what kept the app's verb vocabulary from having any canvas verb at all: `AppActionContext`
 * could say which project and which framework state, and could not say which canvas, so no verb
 * could duplicate the open one or report where it was.
 *
 * **Two primitives rather than one `{ id, title }`.** Legend State commits per field and does not
 * replace the root, so a component subscribed to the root of an object observable is subscribed to
 * something that never changes — the trap that left this app's autosave watching a constant for
 * weeks, and the scroll fades frozen after that. Both are recorded in `ROADMAP.md`. Nothing reads
 * these reactively today, and writing them as an object would leave the first thing that tries to
 * looking correct and never firing.
 */

const openCanvasId$ = observable<string | null>(null);

/** Carried because a copy is named after the original, and only the route knows what that is. */
const openCanvasTitle$ = observable<string | null>(null);

function setOpenCanvas(canvas: Readonly<{ id: string; title: string }>) {
  openCanvasId$.set(canvas.id);
  openCanvasTitle$.set(canvas.title);
}

export { openCanvasId$, openCanvasTitle$, setOpenCanvas };
