import type { initialLayout } from "../canvas/canvas-document";

/**
 * The database, reached lazily.
 *
 * `database.client` pulls an 11 MB WebAssembly engine, so it must not be on the critical path of
 * the first frame. Every surface that needs it was writing its own `await import(...)` wrapper;
 * this is that boundary in one place.
 */

const client = () => import("./database.client");

type Layout = typeof initialLayout;

export const canvases = {
  archive: async (canvasId: string) => (await client()).archiveCanvas(canvasId),
  create: async (input: Readonly<{ layout: Layout; projectId: string; title: string }>) =>
    (await client()).createCanvas(input),
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
  archive: async (projectId: string) => (await client()).archiveProject(projectId),
  create: async (input: Readonly<{ layout: Layout; title: string }>) =>
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
  disconnect: async (input: Readonly<{ source: string; target: string }>) =>
    (await client()).unrelateContentItems(input),
  list: async (projectId: string) => (await client()).listRelations(projectId),
  setKind: async (input: Readonly<{ kind: string; relationId: string }>) =>
    (await client()).setRelationKind(input),
  setLabel: async (input: Readonly<{ label: string | null; relationId: string }>) =>
    (await client()).setRelationLabel(input),
};

/**
 * Saved views — named framings of one canvas.
 *
 * Keyed by canvas rather than by project, because the rect is in that canvas's world coordinates.
 * The rect is spelled out here rather than imported so this module keeps costing nothing to load;
 * every other group does the same.
 */
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

/**
 * Content items, of any kind.
 *
 * Deliberately says nothing about what a note or an image is: this module's whole job is deferring
 * the WebAssembly import, and a `create` that knew to put text in `content.text` would be a second
 * place the note's shape is written down. Each kind builds its own operations on these — see
 * `notes/note-gateway`.
 */
export const content = {
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
  list: async (input: Readonly<{ kind: string; projectId: string }>) =>
    (await client()).listContentItems(input),
  listArchived: async (input: Readonly<{ kind: string; projectId: string }>) =>
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
