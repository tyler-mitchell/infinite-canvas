import { initialLayout } from "../canvas/canvas-document";
import * as database from "../database/operations";
import { namingQueue } from "../naming-queue";
import { getNextNumberedTitle } from "../titles";

// Default titles include active and archived canvas names.
async function createCanvas(
  input: Readonly<{
    projectId: string;
    title?: string;
  }>,
) {
  return namingQueue.add(async () => {
    const chosen = input.title?.trim();

    if (chosen !== undefined && chosen !== "") {
      return database.canvases.create({
        layout: initialLayout,
        projectId: input.projectId,
        title: chosen,
      });
    }

    const titles = await database.canvases.titles(input.projectId);

    return database.canvases.create({
      layout: initialLayout,
      projectId: input.projectId,
      title: getNextNumberedTitle("Canvas", titles),
    });
  });
}

export { createCanvas };
