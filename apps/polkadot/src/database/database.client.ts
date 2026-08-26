import { createWasmWorkerEngines } from "@surrealdb/wasm";
import WorkerAgent from "@surrealdb/wasm/worker?worker";
import { type } from "arktype";
import { StringRecordId, Surreal } from "surrealdb";

import { database, endpoint, manifest, modules, namespace } from "./local-database";

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

/**
 * Long enough for a cold WASM worker and a full schema install on a slow machine; short enough
 * that nobody sits through it wondering.
 */
const LOCAL_DATABASE_OPEN_TIMEOUT_MS = 10_000;

class LocalDatabaseUnavailableError extends Error {
  override readonly name = "LocalDatabaseUnavailableError";
}

/**
 * A rejection scheduled for later, and a way to call it off.
 *
 * The timer is cleared whichever way the race ends, so a successful open does not leave one armed
 * for ten seconds. `Promise.race` attaches to this, so the rejection is never unhandled.
 */
function rejectAfter(ms: number, message: string) {
  const canceller = new AbortController();

  return {
    cancel: () => {
      canceller.abort();
    },
    promise: new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new LocalDatabaseUnavailableError(message));
      }, ms);

      canceller.signal.addEventListener("abort", () => {
        clearTimeout(timer);
      });
    }),
  };
}

/**
 * Opening the database, bounded in time.
 *
 * Every way this can *fail* is already named above with the step that produced it. The way it can
 * do neither was not. An open that never settles rejects nothing, so nothing is caught, and the
 * route's pending component spins forever with no error, no explanation, and no way out — a worse
 * outcome than a crash, because a crash at least tells you to stop waiting.
 *
 * Written after watching exactly that: the app sat on "Opening your workspace" indefinitely. The
 * cause turned out to be stale dev-server modules rather than anything in this file, and I could
 * not reproduce a hang from concurrent tabs — two open this database happily. So this is not a fix
 * for a diagnosed defect. It is the observation that an unbounded open has no way to *report*,
 * which is true regardless of what causes one.
 *
 * The driver offers no connect timeout — `ConnectOptions` carries retry, reconnect, and version
 * checking, and nothing that bounds the initial open — so the bound is composed here. It wraps the
 * whole open rather than just `connect`, since a half-alive connection can stall the schema import
 * too, and one deadline over the whole thing is both simpler and stricter.
 */
function openLocalDatabase() {
  lifecycle.promise ??= (async () => {
    /*
     * No terminal punctuation, and no guess at the cause.
     *
     * `RootFailure` renders this as `${message}.` followed by its own sentence, so a message that
     * punctuates itself reads with a doubled period. And the obvious-sounding cause — "another tab
     * has it open" — is one I checked and disproved: two tabs open this database concurrently
     * without complaint. Naming it would have sent whoever hit this to close tabs that were never
     * the problem, which is worse than saying only what is known.
     */
    const deadline = rejectAfter(
      LOCAL_DATABASE_OPEN_TIMEOUT_MS,
      `The local workspace did not respond within ${String(LOCAL_DATABASE_OPEN_TIMEOUT_MS / 1000)} seconds`,
    );

    try {
      return await Promise.race([connectAndInstall(), deadline.promise]);
    } finally {
      deadline.cancel();
    }
  })().catch((error: unknown) => {
    lifecycle.promise = undefined;
    throw error;
  });

  return lifecycle.promise;
}

/**
 * The canvas `/` opens when nothing is open yet: the first usable project and canvas, creating
 * only what is missing. Archived documents are not usable, so archiving everything gives a fresh
 * workspace rather than handing the archived one back.
 */
async function bootstrapCanvas(initialLayout: object): Promise<CanvasRef> {
  const client = await openLocalDatabase();
  // One statement, one result. `LET $x = …; RETURN $x;` is two statements, and SurrealDB answers
  // with one result per statement — so destructuring `[record]` read the `LET`, which is NONE.
  const [record] = await client
    .query<[unknown]>("RETURN fn::bootstrap_canvas($layout);", { layout: initialLayout })
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
 * Everything a window can be bound to; a window only carries its id.
 *
 * The split is deliberate and it is the reason the canvas layout stays a layout: moving, docking,
 * grouping, or closing a window never touches what it shows. It also means the same item can appear
 * on more than one canvas without its content being copied.
 *
 * `content` is `object` and stays that way here. This layer knows an item has content and cannot
 * know its shape — a note's is `{ text }`, an image's is not — so the kind that wrote it is the
 * layer that validates it on the way back out.
 */
const ContentItemRecord = type({
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

/** No `kind` means every kind, which is what a library asks for and a collection does not. */
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

async function listRelatedContentItems(itemId: string): Promise<readonly ContentItemRecord[]> {
  const client = await openLocalDatabase();
  const [records] = await client
    .query<[unknown]>("RETURN fn::list_related_content_items($item);", {
      item: new StringRecordId(itemId),
    })
    .json();

  return ContentItemRecord.array().assert(records);
}

/**
 * Archive and restore, together.
 *
 * Never one without the other: an archive that cannot be undone is a delete wearing a gentler word,
 * and this is the same pairing canvases and projects already ship.
 */
async function archiveContentItem(itemId: string): Promise<void> {
  const client = await openLocalDatabase();

  await client.query("RETURN fn::archive_content_item($item);", {
    item: new StringRecordId(itemId),
  });
}

async function restoreContentItem(itemId: string): Promise<void> {
  const client = await openLocalDatabase();

  await client.query("RETURN fn::restore_content_item($item);", {
    item: new StringRecordId(itemId),
  });
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
  /** Absent for every edge written before labels existed, and `null` once one is cleared. */
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
): Promise<void> {
  const client = await openLocalDatabase();
  await client
    .query<[unknown]>("RETURN fn::relate_content_items($source, $target, $kind);", {
      kind: input.kind,
      source: new StringRecordId(input.source),
      target: new StringRecordId(input.target),
    })
    .json();
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

/**
 * `null` clears it: an edge goes back to saying only what its kind says.
 *
 * Sent to SurrealDB as `undefined`, not `null`, and the difference is the whole function working.
 * `fn::set_relation_label` declares `$label: option<string>`, and SurrealQL's `option` means
 * "a string or NONE" — `NULL` is a *third*, distinct value it does not accept. The driver maps
 * JS `undefined` to NONE and JS `null` to NULL, so passing the `null` this signature advertises
 * made every clear throw:
 *
 *     Failed to coerce argument `$label`: Expected `none | string` but found `NULL`
 *
 * `null` stays the app-facing spelling because it is what "deliberately absent" looks like in the
 * rest of this codebase, and the caller should not have to know a storage engine's opinion about
 * two kinds of nothing. Converting here is the one place that knows about both.
 *
 * Found by clearing a label while verifying something else. Setting one was exercised repeatedly
 * today and always worked; clearing had never once been run.
 */
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
  input: Readonly<{ source: string; target: string }>,
): Promise<void> {
  const client = await openLocalDatabase();
  await client
    .query<[unknown]>("RETURN fn::unrelate_content_items($source, $target);", {
      source: new StringRecordId(input.source),
      target: new StringRecordId(input.target),
    })
    .json();
}

/**
 * A saved view is a world rect with a name on it.
 *
 * A rect rather than a camera, because a stored centre and zoom is only correct on the pane it was
 * taken from — restore it at another size and the framing is wrong by the ratio between the two.
 * Every framework entry point on this path takes a rect for the same reason.
 */
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

/**
 * Returns the record it wrote, so the surface that asked for it can show the view without a second
 * query — and without inventing the id itself, which is the database's to hand back.
 */
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

/** Re-aim an existing view at where the camera is now, keeping the name it was remembered by. */
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

/**
 * Deleted rather than archived, and the schema says why: a view is referenced by nothing, so
 * removing one strands nothing and restoring one is retyping a name.
 */
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
  listContentItems,
  listProjects,
  listRelatedContentItems,
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
