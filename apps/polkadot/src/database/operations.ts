import type { createCanvas, createProject, unrelateContentItems } from "./database.client";

// This lazy import keeps the 11 MB WASM engine off the first-frame path.
const client = () => import("./database.client");

export const canvases = {
  titles: async (projectId: string) => (await client()).listCanvasTitles(projectId),
  archive: async (canvasId: string) => (await client()).archiveCanvas(canvasId),
  create: async (input: Parameters<typeof createCanvas>[0]) => (await client()).createCanvas(input),
  duplicate: async (input: Readonly<{ canvasId: string; title: string }>) =>
    (await client()).duplicateCanvas(input),
  list: async (projectId: string) => (await client()).listCanvases(projectId),
  listArchived: async (projectId: string) => (await client()).listArchivedCanvases(projectId),
  remove: async (canvasId: string) => (await client()).deleteCanvas(canvasId),
  removalSummary: async (canvasId: string) => (await client()).readCanvasRemovalSummary(canvasId),
  rename: async (input: Readonly<{ canvasId: string; title: string }>) =>
    (await client()).renameCanvas(input),
  restore: async (canvasId: string) => (await client()).restoreCanvas(canvasId),
};

export const projects = {
  titles: async () => (await client()).listProjectTitles(),
  archive: async (projectId: string) => (await client()).archiveProject(projectId),
  create: async (input: Parameters<typeof createProject>[0]) =>
    (await client()).createProject(input),
  list: async () => (await client()).listProjects(),
  listArchived: async () => (await client()).listArchivedProjects(),
  remove: async (projectId: string) => (await client()).deleteProject(projectId),
  removalSummary: async (projectId: string) =>
    (await client()).readProjectRemovalSummary(projectId),
  rename: async (input: Readonly<{ projectId: string; title: string }>) =>
    (await client()).renameProject(input),
  restore: async (projectId: string) => (await client()).restoreProject(projectId),
};

export const relations = {
  connect: async (input: Readonly<{ kind: string; source: string; target: string }>) =>
    (await client()).relateContentItems(input),
  disconnect: async (input: Parameters<typeof unrelateContentItems>[0]) =>
    (await client()).unrelateContentItems(input),
  list: async (projectId: string) => (await client()).listRelations(projectId),
  setKind: async (input: Readonly<{ kind: string; relationId: string }>) =>
    (await client()).setRelationKind(input),
  setLabel: async (input: Readonly<{ label: string | null; relationId: string }>) =>
    (await client()).setRelationLabel(input),
};

export const savedViews = {
  create: async (
    input: Readonly<{
      canvasId: string;
      rect: Readonly<{ height: number; width: number; x: number; y: number }>;
      title: string;
    }>,
  ) => (await client()).createSavedView(input),
  list: async (canvasId: string) => (await client()).listSavedViews(canvasId),
  reframe: async (
    input: Readonly<{
      rect: Readonly<{ height: number; width: number; x: number; y: number }>;
      viewId: string;
    }>,
  ) => (await client()).reframeSavedView(input),
  remove: async (viewId: string) => (await client()).deleteSavedView(viewId),
  rename: async (input: Readonly<{ title: string; viewId: string }>) =>
    (await client()).renameSavedView(input),
};

// Each content kind owns its stored shape.
export const content = {
  titles: async (input: Readonly<{ kind?: string; projectId: string }>) =>
    (await client()).listContentTitles(input),
  archive: async (itemId: string) => (await client()).archiveContentItem(itemId),
  create: async (
    input: Readonly<{
      content: object;
      kind: string;
      projectId: string;
      searchText: string;
      title: string;
    }>,
  ) => (await client()).createContentItem(input),
  /** An omitted kind lists all content types. */
  list: async (input: Readonly<{ kind?: string; projectId: string }>) =>
    (await client()).listContentItems(input),
  listArchived: async (input: Readonly<{ kind?: string; projectId: string }>) =>
    (await client()).listArchivedContentItems(input),
  read: async (itemId: string) => (await client()).readContentItem(itemId),
  restore: async (itemId: string) => (await client()).restoreContentItem(itemId),
  save: async (
    input: Readonly<{
      content: object;
      itemId: string;
      revision: number;
      searchText: string;
      title: string;
    }>,
  ) => (await client()).saveContentItem(input),
};
