import { initialLayout } from "../canvas/canvas-document";
import * as database from "../database/operations";
import { withNamingLock } from "../naming-lock";
import { getNextNumberedTitle } from "../titles";

/**
 * Make a project, named after the ones that already exist.
 *
 * The same count-shaped mistake `create-canvas.ts` describes, one level up:
 * `Project ${projectList.length + 1}` reads how many are listed rather than which names are taken,
 * so archiving the middle of three hands its name to the next one while a higher number still
 * holds. The list a caller had was also the offered one, and archived projects keep their titles.
 *
 * Returns the project's first canvas rather than the project, because that is what
 * `createProject` returns and why: the app addresses canvases, so a project with no canvas would
 * be unreachable, and creating one and landing on it is a single act.
 */
// Locked for the reason `createCanvas` is: reading the taken names and claiming one are two awaits.
async function createProject(
  /** A name somebody chose. Absent means number it after the projects that exist. */
  input: Readonly<{ title?: string }> = {},
) {
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
