import { observable } from "@legendapp/state";

import type { ContentItemRecord } from "../database/database.client";
import { content } from "../database/operations";
import { rememberUndoableAction } from "./undoable-action";

type ProjectContent = Readonly<{
  items: readonly ContentItemRecord[];
  projectId: string;
}>;

// null means that no read has returned.
const projectContent$ = observable<ProjectContent | null>(null);

// Return null when the listing belongs to another project.
function getProjectContent(listing: ProjectContent | null, projectId: string) {
  return listing?.projectId === projectId ? listing.items : null;
}

function getProjectContentOfKind(
  input: Readonly<{ kind: string; listing: ProjectContent | null; projectId: string }>,
) {
  return (
    getProjectContent(input.listing, input.projectId)?.filter((item) => item.kind === input.kind) ??
    null
  );
}

async function loadProjectContent(projectId: string) {
  if (projectContent$.peek()?.projectId !== projectId) {
    projectContent$.set(null);
  }

  projectContent$.set({ items: await content.list({ projectId }), projectId });
}

async function archiveProjectItem(input: Readonly<{ itemId: string; projectId: string }>) {
  const archived = getProjectContent(projectContent$.peek(), input.projectId)?.find(
    (item) => item.id === input.itemId,
  );

  await content.archive(input.itemId);
  await loadProjectContent(input.projectId);

  rememberUndoableAction({
    describe:
      archived === undefined ? "Undo archiving" : `Undo archiving “${archived.title.trim()}”`,
    undo: async () => {
      await restoreProjectItem(input);
    },
  });
}

async function restoreProjectItem(input: Readonly<{ itemId: string; projectId: string }>) {
  await content.restore(input.itemId);
  await loadProjectContent(input.projectId);
}

function setProjectItemTitle(input: Readonly<{ itemId: string; title: string }>) {
  const listing = projectContent$.peek();

  if (listing === null) {
    return;
  }

  projectContent$.set({
    ...listing,
    items: listing.items.map((item) =>
      item.id === input.itemId ? { ...item, title: input.title } : item,
    ),
  });
}

function setProjectItemRevision(itemId: string, revision: number) {
  const listing = projectContent$.peek();

  if (listing === null) {
    return;
  }

  projectContent$.set({
    ...listing,
    items: listing.items.map((item) => (item.id === itemId ? { ...item, revision } : item)),
  });
}

function setProjectItemContent(itemId: string, content: object) {
  const listing = projectContent$.peek();

  if (listing === null) {
    return;
  }

  projectContent$.set({
    ...listing,
    items: listing.items.map((item) => (item.id === itemId ? { ...item, content } : item)),
  });
}

export {
  archiveProjectItem,
  getProjectContent,
  getProjectContentOfKind,
  loadProjectContent,
  projectContent$,
  restoreProjectItem,
  setProjectItemContent,
  setProjectItemRevision,
  setProjectItemTitle,
};
export type { ProjectContent };
