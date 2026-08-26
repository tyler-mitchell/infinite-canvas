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
    (await client()).relateNotes(input),
  disconnect: async (input: Readonly<{ source: string; target: string }>) =>
    (await client()).unrelateNotes(input),
  list: async (projectId: string) => (await client()).listRelations(projectId),
  setKind: async (input: Readonly<{ kind: string; relationId: string }>) =>
    (await client()).setRelationKind(input),
};

export const notes = {
  archive: async (noteId: string) => (await client()).archiveNote(noteId),
  create: async (input: Readonly<{ projectId: string; text: string; title: string }>) =>
    (await client()).createNote(input),
  list: async (projectId: string) => (await client()).listNotes(projectId),
  listArchived: async (projectId: string) => (await client()).listArchivedNotes(projectId),
  read: async (noteId: string) => (await client()).readNote(noteId),
  restore: async (noteId: string) => (await client()).restoreNote(noteId),
  save: async (
    input: Readonly<{ noteId: string; revision: number; text: string; title: string }>,
  ) => (await client()).saveNote(input),
};
