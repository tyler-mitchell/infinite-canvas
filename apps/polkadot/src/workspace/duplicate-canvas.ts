import * as database from "../database/operations";
import { withNamingLock } from "../naming-lock";
import { getNextSuffixedTitle } from "../titles";

function getDuplicateCanvasTitle(canvasTitle: string, takenTitles: readonly string[]): string {
  return getNextSuffixedTitle({ mark: "copy", takenTitles, title: canvasTitle });
}

// Active and archived names participate in default copy naming.
// The naming lock prevents concurrent copies from choosing the same title.
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
