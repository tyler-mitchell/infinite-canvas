import { createWasmWorkerEngines } from "@surrealdb/wasm";
import WorkerAgent from "@surrealdb/wasm/worker?worker";
import { type } from "arktype";
import { StringRecordId, Surreal } from "surrealdb";
import pTimeout from "p-timeout";

import { database, endpoint, manifest, modules, namespace } from "./local-database";

const lifecycle: { promise?: Promise<Surreal> } = {};

// The route identifies a canvas. The record supplies its project.
const CanvasRecord = type({
  id: "string",
  layout: "object",
  projectId: "string",
  projectTitle: "string > 0",
  revision: "number.integer >= 0",
  title: "string > 0",
}).onUndeclaredKey("delete");

type CanvasRecord = typeof CanvasRecord.infer;

const CanvasRef = type({ id: "string" }).onUndeclaredKey("delete");

type CanvasRef = typeof CanvasRef.infer;

const CanvasRevision = type({
  id: "string",
  revision: "number.integer >= 0",
}).onUndeclaredKey("delete");

type CanvasRevision = typeof CanvasRevision.infer;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

class CanvasRevisionConflictError extends Error {
  override readonly name = "CanvasRevisionConflictError";
  readonly canvasId: string;
  readonly expectedRevision: number;

  constructor(input: Readonly<{ canvasId: string; expectedRevision: number }>) {
    super(`Canvas ${input.canvasId} changed after revision ${input.expectedRevision}`);
    this.canvasId = input.canvasId;
    this.expectedRevision = input.expectedRevision;
  }
}

async function connectAndInstall({
  client,
  signal,
}: Readonly<{ client: Surreal; signal: AbortSignal }>) {
  try {
    await client.connect(endpoint);
  } catch (error) {
    throw new Error(`Failed to open ${endpoint}: ${getErrorMessage(error)}`, { cause: error });
  }

  signal.throwIfAborted();
  try {
    await client.use({ database, namespace });
  } catch (error) {
    throw new Error(`Failed to select ${namespace}/${database}: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }

  for (const stage of manifest.stages) {
    for (const file of stage.files) {
      signal.throwIfAborted();
      const source = modules[`../../surql/${file}`];

      if (source === undefined) {
        throw new Error(`Missing SurQL manifest entry: ${file}`);
      }

      try {
        await client.import(source);
      } catch (error) {
        throw new Error(`Failed to install ${file}: ${getErrorMessage(error)}`, { cause: error });
      }
    }
  }

  return client;
}

// This timeout covers worker startup and schema installation.
const LOCAL_DATABASE_OPEN_TIMEOUT_MS = 10_000;

class LocalDatabaseUnavailableError extends Error {
  override readonly name = "LocalDatabaseUnavailableError";
}

function openLocalDatabase() {
  lifecycle.promise ??= (async () => {
    const client = new Surreal({
      engines: createWasmWorkerEngines({ createWorker: () => new WorkerAgent() }),
    });
    const controller = new AbortController();

    try {
      return await pTimeout(connectAndInstall({ client, signal: controller.signal }), {
        milliseconds: LOCAL_DATABASE_OPEN_TIMEOUT_MS,
        message: new LocalDatabaseUnavailableError(
          `The local workspace did not respond within ${String(LOCAL_DATABASE_OPEN_TIMEOUT_MS / 1000)} seconds`,
        ),
      });
    } catch (error) {
      controller.abort(error);
      await client.close().catch((closeError) => {
        console.warn("Failed to close the database after startup failed", { error: closeError });
      });
      throw error;
    }
  })().catch((error: unknown) => {
    lifecycle.promise = undefined;
    throw error;
  });

  return lifecycle.promise;
}

// A new database gets one project and one canvas.
async function bootstrapCanvas(initialLayout: object): Promise<CanvasRef> {
  const client = await openLocalDatabase();
  // SurrealDB returns one result per statement, so this query uses one statement.
  const [record] = await client
    .query<[unknown]>("RETURN fn::bootstrap_canvas($layout);", { layout: initialLayout })
    .json();

  return CanvasRef.assert(record);
}

// null means that the database has no canvas.
async function readMostRecentCanvas(): Promise<CanvasRef | null> {
  const client = await openLocalDatabase();
  const [records] = await client.query<[unknown]>("RETURN fn::most_recent_canvas();").json();
  const [record] = CanvasRef.array().assert(records);

  return record ?? null;
}

// null means that the canvas does not exist.
async function openCanvas(canvasId: string): Promise<CanvasRecord | null> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::open_canvas($canvas);", {
      canvas: new StringRecordId(canvasId),
    })
    .json();

  return record === null || record === undefined ? null : CanvasRecord.assert(record);
}

const CanvasSummary = type({
  // Archived listings include this field.
  "archived_at?": "string.date.iso",
  id: "string",
  revision: "number.integer >= 0",
  title: "string > 0",
}).onUndeclaredKey("delete");

type CanvasSummary = typeof CanvasSummary.infer;

async function listCanvases(projectId: string): Promise<readonly CanvasSummary[]> {
  const client = await openLocalDatabase();
  const [records] = await client
    .query<[unknown]>("RETURN fn::list_canvases($project);", {
      project: new StringRecordId(projectId),
    })
    .json();

  return CanvasSummary.array().assert(records);
}

async function createCanvas(
  input: Readonly<{ layout: object; projectId: string; title: string }>,
): Promise<CanvasRef> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::create_canvas($project, $title, $layout);", {
      layout: input.layout,
      project: new StringRecordId(input.projectId),
      title: input.title,
    })
    .json();

  return CanvasRef.assert(record);
}

// Canvas title changes do not change the layout revision.
async function renameCanvas(
  input: Readonly<{ canvasId: string; title: string }>,
): Promise<CanvasSummary> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::rename_canvas($canvas, $title);", {
      canvas: new StringRecordId(input.canvasId),
      title: input.title,
    })
    .json();

  return CanvasSummary.assert(record);
}

const CanvasRemovalSummary = type({
  title: "string",
  windows: "number.integer >= 0",
}).onUndeclaredKey("delete");

type CanvasRemovalSummary = typeof CanvasRemovalSummary.infer;

async function archiveCanvas(canvasId: string): Promise<CanvasSummary> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::archive_canvas($canvas);", {
      canvas: new StringRecordId(canvasId),
    })
    .json();

  return CanvasSummary.assert(record);
}

async function restoreCanvas(canvasId: string): Promise<CanvasSummary> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::restore_canvas($canvas);", {
      canvas: new StringRecordId(canvasId),
    })
    .json();

  return CanvasSummary.assert(record);
}

async function listArchivedCanvases(projectId: string): Promise<readonly CanvasSummary[]> {
  const client = await openLocalDatabase();
  const [records] = await client
    .query<[unknown]>("RETURN fn::list_archived_canvases($project);", {
      project: new StringRecordId(projectId),
    })
    .json();

  return CanvasSummary.array().assert(records);
}

async function duplicateCanvas(
  input: Readonly<{ canvasId: string; title: string }>,
): Promise<CanvasRef> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::duplicate_canvas($canvas, $title);", {
      canvas: new StringRecordId(input.canvasId),
      title: input.title,
    })
    .json();

  return CanvasRef.assert(record);
}

const ProjectSummary = type({
  // Archived listings include this field.
  "archived_at?": "string.date.iso",
  id: "string",
  title: "string > 0",
}).onUndeclaredKey("delete");

type ProjectSummary = typeof ProjectSummary.infer;

async function listProjects(): Promise<readonly ProjectSummary[]> {
  const client = await openLocalDatabase();
  const [records] = await client.query<[unknown]>("RETURN fn::list_projects();").json();

  return ProjectSummary.array().assert(records);
}

// A new project returns its first canvas.
async function createProject(
  input: Readonly<{ layout: object; title: string }>,
): Promise<CanvasRef> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::create_project($title, $layout);", input)
    .json();

  return CanvasRef.assert(record);
}

const ProjectRemovalSummary = type({
  canvases: "number.integer >= 0",
  notes: "number.integer >= 0",
  title: "string",
}).onUndeclaredKey("delete");

type ProjectRemovalSummary = typeof ProjectRemovalSummary.infer;

async function listArchivedProjects(): Promise<readonly ProjectSummary[]> {
  const client = await openLocalDatabase();
  const [records] = await client.query<[unknown]>("RETURN fn::list_archived_projects();").json();

  return ProjectSummary.array().assert(records);
}

async function archiveProject(projectId: string): Promise<ProjectSummary> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::archive_project($project);", {
      project: new StringRecordId(projectId),
    })
    .json();

  return ProjectSummary.assert(record);
}

async function restoreProject(projectId: string): Promise<ProjectSummary> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::restore_project($project);", {
      project: new StringRecordId(projectId),
    })
    .json();

  return ProjectSummary.assert(record);
}

async function readProjectRemovalSummary(projectId: string): Promise<ProjectRemovalSummary> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::project_removal_summary($project);", {
      project: new StringRecordId(projectId),
    })
    .json();

  return ProjectRemovalSummary.assert(record);
}

// Deleting a project also deletes its content and canvases.
async function deleteProject(projectId: string): Promise<void> {
  const client = await openLocalDatabase();
  await client
    .query<[unknown]>("RETURN fn::delete_project($project);", {
      project: new StringRecordId(projectId),
    })
    .json();
}

async function renameProject(
  input: Readonly<{ projectId: string; title: string }>,
): Promise<ProjectSummary> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::rename_project($project, $title);", {
      project: new StringRecordId(input.projectId),
      title: input.title,
    })
    .json();

  return ProjectSummary.assert(record);
}

async function readCanvasRemovalSummary(canvasId: string): Promise<CanvasRemovalSummary> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::canvas_removal_summary($canvas);", {
      canvas: new StringRecordId(canvasId),
    })
    .json();

  return CanvasRemovalSummary.assert(record);
}

// Deleting a canvas preserves its content items.
async function deleteCanvas(canvasId: string): Promise<void> {
  const client = await openLocalDatabase();
  await client
    .query<[unknown]>("RETURN fn::delete_canvas($canvas);", {
      canvas: new StringRecordId(canvasId),
    })
    .json();
}

async function saveCanvas(
  input: Readonly<{
    canvasId: string;
    layout: object;
    revision: number;
  }>,
): Promise<CanvasRevision> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::save_canvas($canvas, $revision, $layout);", {
      canvas: new StringRecordId(input.canvasId),
      layout: input.layout,
      revision: input.revision,
    })
    .json();

  if (record === null || record === undefined) {
    throw new CanvasRevisionConflictError({
      canvasId: input.canvasId,
      expectedRevision: input.revision,
    });
  }

  return CanvasRevision.assert(record);
}

// Each content kind validates its own content object.
const ContentItemRecord = type({
  // Archived listings include this field.
  "archived_at?": "string.date.iso",
  content: "object",
  id: "string",
  kind: "string",
  revision: "number.integer >= 0",
  title: "string",
}).onUndeclaredKey("delete");

type ContentItemRecord = typeof ContentItemRecord.infer;

async function createContentItem(
  input: Readonly<{
    content: object;
    kind: string;
    projectId: string;
    searchText: string;
    title: string;
  }>,
): Promise<ContentItemRecord> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>(
      "RETURN fn::create_content_item($project, $kind, $title, $content, $search_text);",
      {
        content: input.content,
        kind: input.kind,
        project: new StringRecordId(input.projectId),
        search_text: input.searchText,
        title: input.title,
      },
    )
    .json();

  return ContentItemRecord.assert(record);
}

async function readContentItem(itemId: string): Promise<ContentItemRecord | null> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::read_content_item($item);", {
      item: new StringRecordId(itemId),
    })
    .json();

  return record === null || record === undefined ? null : ContentItemRecord.assert(record);
}

async function saveContentItem(
  input: Readonly<{
    content: object;
    itemId: string;
    revision: number;
    searchText: string;
    title: string;
  }>,
): Promise<ContentItemRecord> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>(
      "RETURN fn::save_content_item($item, $revision, $title, $content, $search_text);",
      {
        content: input.content,
        item: new StringRecordId(input.itemId),
        revision: input.revision,
        search_text: input.searchText,
        title: input.title,
      },
    )
    .json();

  if (record === null || record === undefined) {
    throw new ContentRevisionConflictError({
      expectedRevision: input.revision,
      itemId: input.itemId,
    });
  }

  return ContentItemRecord.assert(record);
}

// An omitted kind lists all content types.
async function listContentTitles(
  input: Readonly<{ kind?: string; projectId: string }>,
): Promise<readonly string[]> {
  const client = await openLocalDatabase();
  const [titles] = await client
    .query<[unknown]>("RETURN fn::list_content_titles($project, $kind);", {
      project: new StringRecordId(input.projectId),
      kind: input.kind,
    })
    .json();
  return type("string[]").assert(titles);
}

async function listCanvasTitles(projectId: string): Promise<readonly string[]> {
  const client = await openLocalDatabase();
  const [titles] = await client
    .query<[unknown]>("RETURN fn::list_canvas_titles($project);", {
      project: new StringRecordId(projectId),
    })
    .json();
  return type("string[]").assert(titles);
}

async function listProjectTitles(): Promise<readonly string[]> {
  const client = await openLocalDatabase();
  const [titles] = await client.query<[unknown]>("RETURN fn::list_project_titles();").json();
  return type("string[]").assert(titles);
}

async function listContentItems(
  input: Readonly<{ kind?: string; projectId: string }>,
): Promise<readonly ContentItemRecord[]> {
  const client = await openLocalDatabase();
  const [records] = await client
    .query<[unknown]>("RETURN fn::list_content_items($project, $kind);", {
      kind: input.kind,
      project: new StringRecordId(input.projectId),
    })
    .json();

  return ContentItemRecord.array().assert(records);
}

const ContentItemMutationRecord = ContentItemRecord.merge({ project: "string" });

async function archiveContentItem(
  itemId: string,
): Promise<typeof ContentItemMutationRecord.infer | null> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::archive_content_item($item);", {
      item: new StringRecordId(itemId),
    })
    .json();
  return record == null ? null : ContentItemMutationRecord.assert(record);
}

async function restoreContentItem(
  itemId: string,
): Promise<typeof ContentItemMutationRecord.infer | null> {
  const client = await openLocalDatabase();

  const [record] = await client
    .query<[unknown]>("RETURN fn::restore_content_item($item);", {
      item: new StringRecordId(itemId),
    })
    .json();
  return record == null ? null : ContentItemMutationRecord.assert(record);
}

async function listArchivedContentItems(
  input: Readonly<{ kind?: string; projectId: string }>,
): Promise<readonly ContentItemRecord[]> {
  const client = await openLocalDatabase();
  const [records] = await client
    .query<[unknown]>("RETURN fn::list_archived_content_items($project, $kind);", {
      kind: input.kind,
      project: new StringRecordId(input.projectId),
    })
    .json();

  return ContentItemRecord.array().assert(records);
}

const ContentRelation = type({
  id: "string",
  kind: "string",
  /** Old relations omit label. A cleared label is null. */
  "label?": "string | null",
  source: "string",
  target: "string",
}).onUndeclaredKey("delete");

type ContentRelation = typeof ContentRelation.infer;

async function listRelations(projectId: string): Promise<readonly ContentRelation[]> {
  const client = await openLocalDatabase();
  const [records] = await client
    .query<[unknown]>("RETURN fn::list_relations($project);", {
      project: new StringRecordId(projectId),
    })
    .json();

  return ContentRelation.array().assert(records);
}

async function relateContentItems(
  input: Readonly<{ kind: string; source: string; target: string }>,
): Promise<string> {
  const client = await openLocalDatabase();
  const [relation] = await client
    .query<[unknown]>("RETURN fn::relate_content_items($source, $target, $kind);", {
      kind: input.kind,
      source: new StringRecordId(input.source),
      target: new StringRecordId(input.target),
    })
    .json();
  return type({ id: "string" }).assert(relation).id;
}

async function setRelationKind(
  input: Readonly<{ kind: string; relationId: string }>,
): Promise<void> {
  const client = await openLocalDatabase();
  await client
    .query<[unknown]>("RETURN fn::set_relation_kind($relation, $kind);", {
      kind: input.kind,
      relation: new StringRecordId(input.relationId),
    })
    .json();
}

// The driver maps undefined to SurrealDB NONE. null maps to rejected NULL.
async function setRelationLabel(
  input: Readonly<{ label: string | null; relationId: string }>,
): Promise<void> {
  const client = await openLocalDatabase();
  await client
    .query<[unknown]>("RETURN fn::set_relation_label($relation, $label);", {
      label: input.label ?? undefined,
      relation: new StringRecordId(input.relationId),
    })
    .json();
}

async function unrelateContentItems(
  input: readonly Readonly<{ source: string; target: string }>[],
): Promise<void> {
  const client = await openLocalDatabase();
  await client
    .query<[unknown]>("RETURN fn::unrelate_content_items($pairs);", {
      pairs: input.map(({ source, target }) => [
        new StringRecordId(source),
        new StringRecordId(target),
      ]),
    })
    .json();
}

// A rect keeps its framing when the viewport size changes.
const SavedView = type({
  id: "string",
  rect: {
    height: "number",
    width: "number",
    x: "number",
    y: "number",
  },
  title: "string",
}).onUndeclaredKey("delete");

type SavedView = typeof SavedView.infer;

type SavedViewRect = SavedView["rect"];

async function listSavedViews(canvasId: string): Promise<readonly SavedView[]> {
  const client = await openLocalDatabase();
  const [records] = await client
    .query<[unknown]>("RETURN fn::list_saved_views($canvas);", {
      canvas: new StringRecordId(canvasId),
    })
    .json();

  return SavedView.array().assert(records);
}

async function createSavedView(
  input: Readonly<{ canvasId: string; rect: SavedViewRect; title: string }>,
): Promise<SavedView> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::create_saved_view($canvas, $title, $rect);", {
      canvas: new StringRecordId(input.canvasId),
      rect: input.rect,
      title: input.title,
    })
    .json();

  return SavedView.assert(record);
}

async function renameSavedView(input: Readonly<{ title: string; viewId: string }>): Promise<void> {
  const client = await openLocalDatabase();
  await client
    .query<[unknown]>("RETURN fn::rename_saved_view($view, $title);", {
      title: input.title,
      view: new StringRecordId(input.viewId),
    })
    .json();
}

async function reframeSavedView(
  input: Readonly<{ rect: SavedViewRect; viewId: string }>,
): Promise<void> {
  const client = await openLocalDatabase();
  await client
    .query<[unknown]>("RETURN fn::reframe_saved_view($view, $rect);", {
      rect: input.rect,
      view: new StringRecordId(input.viewId),
    })
    .json();
}

async function deleteSavedView(viewId: string): Promise<void> {
  const client = await openLocalDatabase();
  await client
    .query<[unknown]>("RETURN fn::delete_saved_view($view);", {
      view: new StringRecordId(viewId),
    })
    .json();
}

class ContentRevisionConflictError extends Error {
  override readonly name = "ContentRevisionConflictError";
  readonly expectedRevision: number;
  readonly itemId: string;

  constructor(input: Readonly<{ expectedRevision: number; itemId: string }>) {
    super(`Content item ${input.itemId} changed after revision ${input.expectedRevision}`);
    this.expectedRevision = input.expectedRevision;
    this.itemId = input.itemId;
  }
}

async function closeLocalDatabase() {
  const pending = lifecycle.promise;
  lifecycle.promise = undefined;

  if (pending === undefined) {
    return;
  }

  const client = await pending.catch(() => null);
  await client?.close();
}

export {
  archiveCanvas,
  archiveContentItem,
  archiveProject,
  bootstrapCanvas,
  CanvasRevisionConflictError,
  closeLocalDatabase,
  ContentRevisionConflictError,
  createCanvas,
  createContentItem,
  createProject,
  createSavedView,
  deleteCanvas,
  deleteProject,
  deleteSavedView,
  duplicateCanvas,
  listArchivedCanvases,
  listArchivedContentItems,
  listArchivedProjects,
  listCanvases,
  listCanvasTitles,
  listContentItems,
  listContentTitles,
  listProjects,
  listProjectTitles,
  listRelations,
  listSavedViews,
  readProjectRemovalSummary,
  reframeSavedView,
  relateContentItems,
  renameProject,
  renameSavedView,
  restoreContentItem,
  restoreProject,
  setRelationKind,
  setRelationLabel,
  unrelateContentItems,
  readCanvasRemovalSummary,
  restoreCanvas,
  openCanvas,
  openLocalDatabase,
  readContentItem,
  readMostRecentCanvas,
  renameCanvas,
  saveCanvas,
  saveContentItem,
};
export type {
  CanvasRecord,
  CanvasRef,
  CanvasRemovalSummary,
  CanvasRevision,
  CanvasSummary,
  ContentItemRecord,
  ContentRelation,
  ProjectRemovalSummary,
  ProjectSummary,
  SavedView,
  SavedViewRect,
};
