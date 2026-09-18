import { initialLayout } from "../canvas/canvas-document";
import * as database from "../database/operations";
import { namingQueue } from "../naming-queue";
import { getNextNumberedTitle } from "../titles";

// Default titles include active and archived project names.
async function createProject(input: Readonly<{ title?: string }> = {}) {
  return namingQueue.add(async () => {
    const chosen = input.title?.trim();

    if (chosen !== undefined && chosen !== "") {
      return database.projects.create({ layout: initialLayout, title: chosen });
    }

    const titles = await database.projects.titles();

    return database.projects.create({
      layout: initialLayout,
      title: getNextNumberedTitle("Project", titles),
    });
  });
}

export { createProject };
