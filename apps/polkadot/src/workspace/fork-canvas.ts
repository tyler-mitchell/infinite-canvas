import type { InfiniteCanvasSerializedState } from "@hyphened/infinite-canvas";

import type { WindowKind } from "../canvas/window-registry";
import * as database from "../database/operations";
import { withNamingLock } from "../naming-lock";
import { getNextSuffixedTitle } from "../titles";

/**
 * Keep a conflicted arrangement by giving it a canvas of its own.
 *
 * The naming was `${canvasTitle} (recovered)`, written inline where the button is, and it was the
 * same rule `create-canvas.ts` already exists to stop being written inline — whose docstring ends
 * "`open-note.ts` found and recorded exactly this for notes; the lesson stayed with notes." It
 * stayed with `createCanvas` too. This is the third copy of the mistake and the second file to fix
 * it the same way.
 *
 * Two failures, both reachable in a normal session:
 *
 * A second conflict on the same canvas produced a second "Main canvas (recovered)" — two canvases
 * with one name, in the switcher that exists to tell them apart. `getNextRepeatTitle` is the rule
 * for a label that is already a real name: bare first, numbered after, which is what every file
 * manager does.
 *
 * And forking a fork compounded the mark — "Main canvas (recovered) (recovered)" — because the
 * suffix was appended to whatever the title happened to be. A recovery of a recovery is still a
 * recovery *of the original*, so the mark is stripped before it is reapplied and the numbering
 * carries the difference.
 */

/**
 * What a fork of this canvas is called, given the names already taken.
 *
 * Both failures above are the ones any appended mark has, so the rule is `titles.ts`'s rather than
 * this file's: the canvas switcher's "Duplicate" had written the same two bugs out again under a
 * different word. This owns the word; the numbering and the stripping are shared.
 */
function getForkedCanvasTitle(canvasTitle: string, takenTitles: readonly string[]): string {
  return getNextSuffixedTitle({ mark: "(recovered)", takenTitles, title: canvasTitle });
}

/**
 * Archived canvases are asked about too, for the reason `createCanvas` gives: they keep their
 * titles, so a name skipped here collides the moment someone restores one — a defect that surfaces
 * long after the action that caused it.
 */
async function forkCanvas(
  input: Readonly<{
    canvasTitle: string;
    /** `handle.snapshot()` — the same serializer the write loop uses, so the fork holds exactly
     * what would have been saved had the revision still been good. */
    layout: InfiniteCanvasSerializedState<WindowKind>;
    projectId: string;
  }>,
) {
  // Locked like every other default-named create. A fork happens on a save conflict, which is
  // exactly when a second tab may be doing the same thing to the same canvas.
  return withNamingLock(async () => {
    const [offered, archived] = await Promise.all([
      database.canvases.list(input.projectId),
      database.canvases.listArchived(input.projectId),
    ]);

    return database.canvases.create({
      layout: input.layout,
      projectId: input.projectId,
      title: getForkedCanvasTitle(
        input.canvasTitle,
        [...offered, ...archived].map((canvas) => canvas.title),
      ),
    });
  });
}

export { forkCanvas, getForkedCanvasTitle };
