import * as database from "../database/operations";

/**
 * Where entering a project lands you, or `null` when it is not a move.
 *
 * A project is entered through one of its canvases, most recent first — the same rule `/` uses, so
 * entering a project and entering the app arrive the same way. That rule was written twice, in the
 * project switcher and in the palette's project rows, and the two copies did not agree: the
 * switcher returned early when you picked the project you were already in, and the palette did not.
 *
 * **That disagreement is a defect rather than a detail.** `fn::list_canvases` orders by
 * `updated_at`, which is the last time a canvas was *written*, not the last time it was looked at.
 * So sitting on a canvas you have not edited and picking your own project in the palette moved you
 * to whichever canvas you last typed in. You asked to go somewhere you already were and the app
 * changed the document under you.
 *
 * Both halves are one decision and live here together. "Already there" is not a guard bolted onto
 * the lookup — it is the first thing the question answers, which is also why it costs no query.
 */
async function getProjectEntryCanvas(
  input: Readonly<{
    /** The project the app is in right now. */
    openProjectId: string;
    /** The project the person asked for. */
    projectId: string;
  }>,
): Promise<string | null> {
  // Answered before the database is touched: going where you are is not a navigation.
  if (input.projectId === input.openProjectId) {
    return null;
  }

  const [first] = await database.canvases.list(input.projectId);

  // A project with every canvas archived has nowhere to land, and moving to a route that does not
  // resolve is worse than not moving.
  return first?.id ?? null;
}

export { getProjectEntryCanvas };
