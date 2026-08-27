import * as database from "../database/operations";
import { withNamingLock } from "../naming-lock";
import { getNextSuffixedTitle } from "../titles";

/**
 * Copy a canvas, named so the copy and the original can be told apart.
 *
 * The switcher wrote `${title} copy` inline where the menu item is — the fourth copy of the
 * mistake `create-canvas.ts` was written to stop, and the one `fork-canvas.ts` calls "the third".
 * Both failures that file names were live here under a different word:
 *
 * Duplicate a canvas twice and both copies were called "Q3 copy", in the switcher that exists to
 * tell them apart. And duplicating a copy compounded the mark — "Q3 copy copy", then "Q3 copy copy
 * copy" — because the suffix went onto whatever the title happened to be.
 *
 * `getNextSuffixedTitle` owns both answers, so this file owns only the word. A copy of a copy is
 * still a copy of the original, and the numbering carries the difference: "Q3 copy 2", which is
 * what Finder gives for the same gesture.
 *
 * Creating and navigating stay apart, for the reason `createCanvas` gives: where you go afterwards
 * is not a fact about the canvas.
 */

/** What a copy of this canvas is called, given the names already taken. */
function getDuplicateCanvasTitle(canvasTitle: string, takenTitles: readonly string[]): string {
  return getNextSuffixedTitle({ mark: "copy", takenTitles, title: canvasTitle });
}

/**
 * Archived canvases are asked about too, for the reason `createCanvas` gives: they keep their
 * titles, so a name skipped here collides the moment someone restores one.
 */
// Locked like every other default-named create: the list and the duplicate are separate awaits, so
// two duplicates started together both read the same names and both take the next one.
async function duplicateCanvas(
  input: Readonly<{ canvasId: string; canvasTitle: string; projectId: string }>,
) {
  return withNamingLock(async () => {
    const [offered, archived] = await Promise.all([
      database.canvases.list(input.projectId),
      database.canvases.listArchived(input.projectId),
    ]);

    return database.canvases.duplicate({
      canvasId: input.canvasId,
      title: getDuplicateCanvasTitle(
        input.canvasTitle,
        [...offered, ...archived].map((canvas) => canvas.title),
      ),
    });
  });
}

export { duplicateCanvas, getDuplicateCanvasTitle };
