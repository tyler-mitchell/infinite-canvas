import { initialLayout } from "../canvas/canvas-document";
import * as database from "../database/operations";
import { withNamingLock } from "../naming-lock";
import { getNextNumberedTitle } from "../titles";

// Default titles include active and archived project names.
// The naming lock prevents concurrent projects from choosing the same title.
async function createProject(input: Readonly<{ title?: string }> = {}) {
  return withNamingLock(async () => {
    const chosen = input.title?.trim();

    if (chosen !== undefined && chosen !== "") {
      return database.projects.create({ layout: initialLayout, title: chosen });
    }

    const [offered, archived] = await Promise.all([
      database.projects.list(),
      database.projects.listArchived(),
    ]);

    return database.projects.create({
      layout: initialLayout,
      title: getNextNumberedTitle(
        "Project",
        [...offered, ...archived].map((project) => project.title),
      ),
    });
  });
}

export { createProject };
