import * as database from "../database/operations";

// The current project and a project with no active canvas both return null.
async function getProjectEntryCanvas(
  input: Readonly<{
    openProjectId: string;
    projectId: string;
  }>,
): Promise<string | null> {
  if (input.projectId === input.openProjectId) {
    return null;
  }

  const [first] = await database.canvases.list(input.projectId);

  return first?.id ?? null;
}

export { getProjectEntryCanvas };
