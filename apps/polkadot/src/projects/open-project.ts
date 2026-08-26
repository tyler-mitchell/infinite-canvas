import { observable } from "@legendapp/state";

/**
 * Which project is open, as a fact in its own right.
 *
 * It was not held anywhere until now, which is the defect this closes — and the shape of the defect
 * is worth keeping, because it looked like duplication and was not. `projectNotes$` carries a
 * `projectId` and `relation-store` keeps a `loadedProject`, and both look like a third and fourth
 * copy of this. They are not: those answer *which project is this cache for*, which is what lets a
 * stale read be told from a current one, and they are correct where they are.
 *
 * What was missing is the question a window body actually asks — "which project am I in" — and with
 * nowhere to ask it, the note body read the answer off the notes cache's guard. That worked. Then a
 * collection of *images* had to read a listing of *notes* to learn its own project, and the seam
 * showed: a cache's guard is not an authority, and the moment two caches disagree during a
 * navigation, whoever is reading one of them is holding the wrong answer with no way to know.
 *
 * Set once by the workspace from the route's loaded canvas, which is the only thing that genuinely
 * knows. Nothing else writes it.
 */

const openProject$ = observable<string | null>(null);

function setOpenProject(projectId: string) {
  openProject$.set(projectId);
}

export { openProject$, setOpenProject };
