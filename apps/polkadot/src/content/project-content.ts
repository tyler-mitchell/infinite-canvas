import { batch, observable, proxy } from "@legendapp/state";
import PQueue from "p-queue";

import type { ContentItemRecord } from "../database/database.client";
import { content } from "../database/operations";
import { NOTE_KIND } from "../notes/note-gateway";
import { notes$ } from "../notes/note-store";
import { rememberUndoableAction } from "./undoable-action";

type ProjectContent = Readonly<{
  items: readonly ContentItemRecord[];
  projectId: string;
}>;

const projectListings$ = observable<Record<string, ProjectContent | null>>({});
const archivedProjectListings$ = observable<Record<string, ProjectContent | null>>({});

function resolveProjectContent(listing: ProjectContent | null | undefined) {
  if (listing == null) return null;
  return {
    ...listing,
    items: listing.items.map((item) => {
      if (item.kind !== NOTE_KIND) return { ...item };
      const note = notes$[item.id].get();
      return { ...item, ...note };
    }),
  };
}

const projectContent$ = proxy<ProjectContent | null>((projectId) =>
  resolveProjectContent(projectListings$[projectId].get()),
);
const archivedProjectContent$ = proxy<ProjectContent | null>((projectId) =>
  resolveProjectContent(archivedProjectListings$[projectId].get()),
);
const queue = new PQueue({ concurrency: 1 });

// Return null when the listing belongs to another project.
function getProjectContent(listing: ProjectContent | null | undefined, projectId: string) {
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

function loadProjectContent(projectId: string) {
  if (projectListings$[projectId].peek() === undefined) projectListings$[projectId].set(null);
  return queue.add(async () => {
    projectListings$[projectId].set({ items: await content.list({ projectId }), projectId });
  });
}

function loadArchivedProjectContent(projectId: string) {
  if (archivedProjectListings$[projectId].peek() === undefined)
    archivedProjectListings$[projectId].set(null);
  return queue.add(async () => {
    archivedProjectListings$[projectId].set({
      projectId,
      items: await content.listArchived({ projectId }),
    });
  });
}

function createProjectItem<Item extends Omit<ContentItemRecord, "kind">>(
  input: Readonly<{ create: () => Promise<Item>; kind: string; projectId: string }>,
) {
  return queue.add(async () => {
    const items =
      projectListings$[input.projectId].peek()?.items ??
      (await content.list({ projectId: input.projectId }));
    const item = await input.create();
    projectListings$[input.projectId].set({
      projectId: input.projectId,
      items: [{ ...item, kind: input.kind }, ...items],
    });
    return item;
  });
}

function archiveProjectItem(input: Readonly<{ itemId: string; projectId: string }>) {
  return queue.add(async () => {
    const current = getProjectContent(
      projectContent$[input.projectId].peek(),
      input.projectId,
    )?.find((item) => item.id === input.itemId);
    const archived = await content.archive(input.itemId);
    if (archived === null) return false;
    const { project, ...item } = archived;
    batch(() => {
      rememberUndoableAction({
        describe: `Undo archiving “${(current?.title ?? item.title).trim()}”`,
        undo: async () => {
          await restoreProjectItem({ projectId: project, itemId: item.id });
        },
      });
      const items = projectListings$[project].peek()?.items;
      if (items !== undefined)
        projectListings$[project].items.set(items.filter((current) => current.id !== item.id));
      const archivedItems = archivedProjectListings$[project].peek()?.items;
      if (archivedItems !== undefined) {
        archivedProjectListings$[project].items.set([
          item,
          ...archivedItems.filter((current) => current.id !== item.id),
        ]);
      }
    });
    return true;
  });
}

function restoreProjectItem(input: Readonly<{ itemId: string; projectId: string }>) {
  return queue.add(async () => {
    const currentItems =
      projectListings$[input.projectId].peek()?.items ??
      (await content.list({ projectId: input.projectId }));
    const restored = await content.restore(input.itemId);
    if (restored === null) return;
    const { project, ...item } = restored;
    const items =
      project === input.projectId ? currentItems : projectListings$[project].peek()?.items;
    batch(() => {
      if (items !== undefined) {
        projectListings$[project].set({
          projectId: project,
          items: [item, ...items.filter((current) => current.id !== item.id)],
        });
      }
      const archivedItems = archivedProjectListings$[project].peek()?.items;
      if (archivedItems !== undefined)
        archivedProjectListings$[project].items.set(
          archivedItems.filter((current) => current.id !== item.id),
        );
    });
  });
}

function updateProjectItem(item: Pick<ContentItemRecord, "id"> & Partial<ContentItemRecord>) {
  for (const listings$ of [projectListings$, archivedProjectListings$]) {
    for (const projectId of Object.keys(listings$.peek())) {
      const index =
        listings$[projectId].items.peek()?.findIndex((current) => current.id === item.id) ?? -1;
      if (index >= 0) listings$[projectId].items[index].assign(item);
    }
  }
}

export {
  archiveProjectItem,
  archivedProjectContent$,
  archivedProjectListings$,
  createProjectItem,
  getProjectContent,
  getProjectContentOfKind,
  loadArchivedProjectContent,
  loadProjectContent,
  projectContent$,
  projectListings$,
  restoreProjectItem,
  updateProjectItem,
};
export type { ProjectContent };
