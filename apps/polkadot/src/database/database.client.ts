import { createWasmWorkerEngines } from "@surrealdb/wasm";
import WorkerAgent from "@surrealdb/wasm/worker?worker";
import { type } from "arktype";
import { StringRecordId, Surreal } from "surrealdb";

import manifest from "../../surql/manifest.json";

const namespace = "polkadot";
const database = "polkadot";
const endpoint = "indxdb://polkadot";
const modules = import.meta.glob("../../surql/**/*.surql", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Readonly<Record<string, string>>;

const lifecycle: { promise?: Promise<Surreal> } = {};

/**
 * An open canvas, with its project flattened alongside it.
 *
 * The route names a canvas and a canvas belongs to exactly one project, so the project is
 * derivable — reading it here rather than putting it in the URL is what keeps the address from
 * carrying identity that could contradict the record.
 */
const CanvasRecord = type({
  id: "string",
  layout: "object",
  projectId: "string",
  projectTitle: "string > 0",
  revision: "number.integer >= 0",
  title: "string > 0",
}).onUndeclaredKey("delete");

type CanvasRecord = typeof CanvasRecord.infer;

/**
 * Just enough to navigate to a canvas.
 *
 * Creating, duplicating, and bootstrapping all end in "open this" and nothing else, so they
 * validate an id rather than a whole record — none of them project the flattened shape above and
 * requiring it would only force those queries to fetch what no caller reads.
 */
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

function createClient() {
  return new Surreal({
    engines: {
      ...createWasmWorkerEngines({ createWorker: () => new WorkerAgent() }),
    },
  });
}

async function connectAndInstall() {
  const client = createClient();

  try {
    try {
      await client.connect(endpoint);
    } catch (error) {
      throw new Error(`Failed to open ${endpoint}: ${getErrorMessage(error)}`, { cause: error });
    }

    try {
      await client.use({ database, namespace });
    } catch (error) {
      throw new Error(`Failed to select ${namespace}/${database}: ${getErrorMessage(error)}`, {
        cause: error,
      });
    }

    for (const stage of manifest.stages) {
      for (const file of stage.files) {
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
  } catch (error) {
    await client.close();
    throw error;
  }
}

function openLocalDatabase() {
  lifecycle.promise ??= connectAndInstall().catch((error) => {
    lifecycle.promise = undefined;
    throw error;
  });

  return lifecycle.promise;
}

async function openDefaultCanvas(initialLayout: object): Promise<CanvasRef> {
  const client = await openLocalDatabase();
  // One statement, one result. `LET $x = …; RETURN $x;` is two statements, and SurrealDB answers
  // with one result per statement — so destructuring `[record]` read the `LET`, which is NONE.
  const [record] = await client
    .query<[unknown]>("RETURN fn::open_default_canvas($layout);", { layout: initialLayout })
    .json();

  return CanvasRef.assert(record);
}

/**
 * The canvas a bare `/` should open, or `null` when the database has never been written to.
 *
 * Empty is a normal state rather than a failure — it is what a first run looks like — so the
 * caller decides between bootstrapping and reporting, and this stays a read.
 */
async function readMostRecentCanvas(): Promise<CanvasRef | null> {
  const client = await openLocalDatabase();
  const [records] = await client.query<[unknown]>("RETURN fn::most_recent_canvas();").json();
  const [record] = CanvasRef.array().assert(records);

  return record ?? null;
}

/**
 * `null` means the route named a canvas that is not there — a stale bookmark or a deleted
 * document — which is a different outcome from the database itself failing, and the route
 * distinguishes them.
 */
async function openCanvas(canvasId: string): Promise<CanvasRecord | null> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::open_canvas($canvas);", {
      canvas: new StringRecordId(canvasId),
    })
    .json();

  return record === null || record === undefined ? null : CanvasRecord.assert(record);
}

/**
 * A canvas without its layout.
 *
 * The switcher needs names, not arrangements — projecting `layout` would put every window of
 * every canvas into a menu that renders a list of titles.
 */
const CanvasSummary = type({
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

/**
 * A rename touches `title` and nothing else, so it never collides with the layout autosave — the
 * two write disjoint fields and `revision` guards only the layout.
 */
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
  id: "string",
  title: "string > 0",
}).onUndeclaredKey("delete");

type ProjectSummary = typeof ProjectSummary.infer;

async function listProjects(): Promise<readonly ProjectSummary[]> {
  const client = await openLocalDatabase();
  const [records] = await client.query<[unknown]>("RETURN fn::list_projects();").json();

  return ProjectSummary.array().assert(records);
}

/**
 * Returns the project's first canvas, not the project. A project with no canvas would be
 * unreachable — the app addresses canvases — so creating one and landing on it is the same act.
 */
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

/**
 * The most destructive act in the application.
 *
 * A canvas is an arrangement whose notes outlive it. A project owns its content outright, so this
 * cascade genuinely destroys writing — which is why the surface that calls it asks for the
 * project's name to be typed rather than for a click.
 */
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

/**
 * Permanent. The notes the canvas showed are `content_item` records and are untouched — this
 * removes an arrangement, not the work.
 */
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

/**
 * A note is a `content_item`; a window only carries its id.
 *
 * The split is deliberate and it is the reason the canvas layout stays a layout: moving, docking,
 * grouping, or closing a window never touches what was written. It also means the same note can
 * appear on more than one canvas later without the text being copied.
 */
const NoteRecord = type({
  content: { text: "string" },
  id: "string",
  revision: "number.integer >= 0",
  title: "string",
}).onUndeclaredKey("delete");

type NoteRecord = typeof NoteRecord.infer;

async function createNote(
  input: Readonly<{ projectId: string; text: string; title: string }>,
): Promise<NoteRecord> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::create_note($project, $title, $text);", {
      project: new StringRecordId(input.projectId),
      text: input.text,
      title: input.title,
    })
    .json();

  return NoteRecord.assert(record);
}

async function readNote(noteId: string): Promise<NoteRecord | null> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::read_note($note);", { note: new StringRecordId(noteId) })
    .json();

  return record === null || record === undefined ? null : NoteRecord.assert(record);
}

async function saveNote(
  input: Readonly<{ noteId: string; revision: number; text: string; title: string }>,
): Promise<NoteRecord> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::save_note($note, $revision, $title, $text);", {
      note: new StringRecordId(input.noteId),
      revision: input.revision,
      text: input.text,
      title: input.title,
    })
    .json();

  if (record === null || record === undefined) {
    throw new NoteRevisionConflictError({ expectedRevision: input.revision, noteId: input.noteId });
  }

  return NoteRecord.assert(record);
}

async function listNotes(projectId: string): Promise<readonly NoteRecord[]> {
  const client = await openLocalDatabase();
  const [records] = await client
    .query<[unknown]>("RETURN fn::list_notes($project);", {
      project: new StringRecordId(projectId),
    })
    .json();

  return NoteRecord.array().assert(records);
}

class NoteRevisionConflictError extends Error {
  override readonly name = "NoteRevisionConflictError";
  readonly expectedRevision: number;
  readonly noteId: string;

  constructor(input: Readonly<{ expectedRevision: number; noteId: string }>) {
    super(`Note ${input.noteId} changed after revision ${input.expectedRevision}`);
    this.expectedRevision = input.expectedRevision;
    this.noteId = input.noteId;
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
  archiveProject,
  CanvasRevisionConflictError,
  closeLocalDatabase,
  createCanvas,
  createNote,
  createProject,
  deleteCanvas,
  deleteProject,
  duplicateCanvas,
  listArchivedCanvases,
  listArchivedProjects,
  listCanvases,
  listNotes,
  listProjects,
  readProjectRemovalSummary,
  renameProject,
  restoreProject,
  readCanvasRemovalSummary,
  restoreCanvas,
  NoteRevisionConflictError,
  openCanvas,
  openDefaultCanvas,
  openLocalDatabase,
  readMostRecentCanvas,
  readNote,
  renameCanvas,
  saveCanvas,
  saveNote,
};
export type {
  CanvasRecord,
  CanvasRef,
  CanvasRemovalSummary,
  CanvasRevision,
  CanvasSummary,
  NoteRecord,
  ProjectRemovalSummary,
  ProjectSummary,
};
