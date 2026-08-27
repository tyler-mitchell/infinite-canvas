import { initialLayout } from "../canvas/canvas-document";
import * as database from "../database/operations";
import { withNamingLock } from "../naming-lock";
import { getNextNumberedTitle } from "../titles";

/**
 * Make a canvas in this project, named after the ones that already exist.
 *
 * Both surfaces that offer a new canvas — the canvas switcher and the palette — wrote
 * `Canvas ${canvases.length + 1}` inline, so the naming rule was a duplicated expression rather
 * than a decision anything owned. It was also the wrong rule twice over.
 *
 * A count is not a fact about which names are taken. Delete "Canvas 2" of three and the next
 * create offers "Canvas 3", which already exists — two canvases with one name, in the switcher
 * that exists to tell them apart. `open-note.ts` found and recorded exactly this for notes; the
 * lesson stayed with notes.
 *
 * The list a caller had was the *offered* one, and archived canvases keep their titles. A name
 * skipped here collides the moment someone restores one, which is a defect that surfaces long
 * after the action that caused it — the reason this asks the database rather than taking whatever
 * the caller was already rendering.
 *
 * Creating and navigating stay apart: the switcher and the palette both open what they made, but
 * they reach the route differently, and where you go afterwards is not a fact about the canvas.
 */
// Locked, because the list and the create are separate awaits: two canvases made at once both read
// the same names and both take the next one. See `naming-lock.ts` for the note that found it.
async function createCanvas(projectId: string) {
  return withNamingLock(async () => {
    const [offered, archived] = await Promise.all([
      database.canvases.list(projectId),
      database.canvases.listArchived(projectId),
    ]);

    return database.canvases.create({
      layout: initialLayout,
      projectId,
      title: getNextNumberedTitle(
        "Canvas",
        [...offered, ...archived].map((canvas) => canvas.title),
      ),
    });
  });
}

export { createCanvas };
