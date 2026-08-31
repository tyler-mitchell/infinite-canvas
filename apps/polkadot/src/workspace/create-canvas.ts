import { initialLayout } from "../canvas/canvas-document";
import * as database from "../database/operations";
import { withNamingLock } from "../naming-lock";
import { getNextNumberedTitle } from "../titles";

// Default titles include active and archived canvas names.
// The naming lock prevents concurrent canvases from choosing the same title.
async function createCanvas(
  input: Readonly<{
    projectId: string;
    title?: string;
  }>,
) {
  return withNamingLock(async () => {
    const chosen = input.title?.trim();

    if (chosen !== undefined && chosen !== "") {
      return database.canvases.create({
        layout: initialLayout,
        projectId: input.projectId,
        title: chosen,
      });
    }

    const [offered, archived] = await Promise.all([
      database.canvases.list(input.projectId),
      database.canvases.listArchived(input.projectId),
    ]);

    return database.canvases.create({
      layout: initialLayout,
      projectId: input.projectId,
      title: getNextNumberedTitle(
        "Canvas",
        [...offered, ...archived].map((canvas) => canvas.title),
      ),
    });
  });
}

export { createCanvas };
