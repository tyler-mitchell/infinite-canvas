import {
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  findInfiniteCanvasGroup,
  findInfiniteCanvasWorkspace,
  getInfiniteCanvasGroupableWindowIds,
  getWindowBounds,
  isInfiniteCanvasGroupContainer,
  type InfiniteCanvasCommandId,
  type InfiniteCanvasCommands,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { type, type Type } from "arktype";

import { GROUP_LAYOUT_MODES } from "./canvas/group-layout-modes";
import { openItemWindow } from "./canvas/open-item";
import { getContentWindowItemId, type WindowKind } from "./canvas/window-registry";
import { LISTABLE_KINDS } from "./collections/listable-kinds";
import {
  archiveProjectItem,
  getProjectContent,
  projectContent$,
  restoreProjectItem,
  setProjectItemContent,
} from "./content/project-content";
import { openNewCollection } from "./collections/open-collection";
import { RENAMEABLE_KINDS, renameProjectItem } from "./content/rename-item";
import type { ContentItemRecord } from "./database/database.client";
import * as database from "./database/operations";
import { NOTE_KIND, noteGateway, toNote } from "./notes/note-gateway";
import { writeNote } from "./notes/note-store";
import { getNoteText, toSerializedNote } from "./notes/note-text";
import { openNewNote } from "./notes/open-note";
import { getProjectEntryCanvas } from "./projects/enter-project";
import { createCanvas } from "./workspace/create-canvas";
import { createDesktop } from "./workspace/create-desktop";
import { createProject } from "./workspace/create-project";
import { duplicateCanvas } from "./workspace/duplicate-canvas";
import {
  connectItems,
  DEFAULT_RELATION_KIND,
  disconnectItems,
  findRelation,
  relations$,
  RELATION_KINDS,
  setRelationKind,
  setRelationLabel,
} from "./relations/relation-store";

/**
 * What this app can do, as a vocabulary rather than a set of click handlers.
 *
 * The framework publishes its own through `getContextualCommands` — label, description and live
 * enablement per command — and everything Polkadot adds on top used to live inside an `onClick`.
 * That is a capability only a pointer can reach: it cannot be listed, described, enabled, or
 * invoked by anything else, which fails the WebMCP requirement in `AGENTS.md`.
 *
 * One entry per argument value rather than one entry taking an argument — `collection.create.link`
 * instead of a create-collection action with a kind. That is the framework's own shape
 * (`view.pan.right`, `group.setLayout.tabs`), and it is right wherever the values can be listed.
 *
 * `input` is for the arguments that cannot: a title, an id, anything drawn from the document rather
 * than from a fixed set. One ArkType declaration serves both halves — `toJsonSchema()` is what a
 * tool caller is offered, and the same type validates what comes back — so the shape a caller is
 * promised and the shape the verb accepts cannot drift apart. An entry with `input` is deliberately
 * not a palette row: a row has no way to supply an argument.
 */

type AppActionContext = Readonly<{
  actions: InfiniteCanvasCommands<WindowKind>;
  /**
   * The canvas the verb is standing in, and what it is called.
   *
   * Read from the route's own loader data by whoever builds the context, never copied into state of
   * its own. `/canvas/$canvasId` means the router already holds this — a module observable beside it
   * would be a second answer to a question the URL settles, free to go stale against it. That is the
   * one thing `openProject$` cannot be, since no route names a project.
   */
  canvasId: string;
  canvasTitle: string;
  /**
   * Go to a canvas by id — the one act no verb can reach through `actions`.
   *
   * Changing canvas is a route change, not a canvas command: a different canvas is a different
   * store, keyed by the route. So this is supplied by whoever builds the context, all four of whom
   * are components holding a router.
   *
   * It is not a general navigator on purpose. A verb needs exactly one destination, and handing the
   * vocabulary a router would let any verb go anywhere in an app whose other routes are a failure
   * screen and a redirect.
   */
  goToCanvas: (input: Readonly<{ canvasId: string }>) => void;
  projectId: string;
  /**
   * Re-read what the route loaded, for the verbs that change it.
   *
   * The route's loader holds the open canvas's title and its project's, so a rename that only
   * writes leaves the switchers showing the old name — the same write-without-re-read that left
   * three creation paths absent from the library. Supplied rather than reached for, like
   * `goToCanvas`: `router.invalidate` needs a router, and the vocabulary is not given one.
   */
  refreshRoute: () => void;
  state: InfiniteCanvasState<WindowKind>;
}>;

type AppAction = Readonly<{
  description: string;
  id: string;
  /** Absent means the verb takes no argument, which is most of them. */
  input?: Type<object>;
  /** Absent means always available. Read against live state, like the framework's own. */
  isEnabled?: (context: AppActionContext) => boolean;
  label: string;
  /**
   * `input` arrives unvalidated and the verb narrows it with its own `input` type.
   *
   * One validation site rather than two: a caller that checked first and handed over a trusted
   * object would need a cast here, and a cast is where the schema and the code start disagreeing
   * silently. Verbs with no `input` ignore the parameter.
   *
   * **Returns what the caller needs told, or nothing when "done" covers it.** Usually that is why it
   * refused. It is not only that: `relation.disconnect` runs successfully and still has something to
   * say, because it destroyed a kind and a label that nothing can bring back. A verb knows when the
   * default report is a lie by omission; this is how it says so.
   *
   * The refusal half was `void`, and the cost was measured
   * rather than reasoned about: driven through WebMCP, `content.open` with an id naming nothing and
   * `window.reveal` with an id naming nothing both answered "done." The verb knew — it is the thing
   * that computed `parsed instanceof type.errors` and `item === undefined` — and threw that away at
   * the `return`, leaving the caller to report success for a no-op.
   *
   * That is worse than an unhelpful message. A caller that cannot see the screen has no second
   * source; told the item opened, it goes on to act against a window that is not there, and the
   * first real symptom is several steps from the cause. A refusal string is the only way it finds
   * out. Enablement stays separate and stays where it is: `isEnabled` answers without an argument,
   * because palette rows need it before one exists, and this answers about the argument.
   *
   * **A verb that writes returns its promise**, so "done" means written rather than started. A
   * pointer can ignore it — the store updates reactively and a person is watching — but a caller
   * reading back immediately would otherwise get a listing that disagrees with what it was told.
   */
  run: (
    context: AppActionContext,
    input?: unknown,
  ) => Promise<string | undefined> | string | undefined;
}>;

/**
 * The refusal every verb with an `input` shares, so they cannot word it eleven different ways.
 *
 * Named for the caller's question rather than for ArkType: what reaches a verb is whatever the
 * caller sent, and `summary` is the part that says which field was wrong.
 */
const describeInvalidInput = (errors: type.errors) => `Refused: ${errors.summary}`;

/** Enablement and the shell rect both need this set, and must not disagree about it. */
const getGroupableWindowIds = (state: InfiniteCanvasState<WindowKind>): readonly string[] =>
  getInfiniteCanvasGroupableWindowIds(state, state.selection.windowIds);

/**
 * Quote the framework's sentence for a verb re-declared here to take an argument, and add only
 * what the argument needs. Restating it instead is how the two drifted apart.
 */
const describeWrappedCommand = (
  input: Readonly<{ argument: string; id: InfiniteCanvasCommandId }>,
): string => {
  const descriptor = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.find(
    (candidate) => candidate.id === input.id,
  );

  if (descriptor === undefined) {
    throw new Error(`No framework command is called "${input.id}".`);
  }

  return `${descriptor.description} ${input.argument}`;
};

/**
 * The refusals that are about the world rather than the shape, each naming where a good value comes
 * from.
 *
 * Saying only "not found" tells a caller it was wrong and not what to do instead, which for
 * something that cannot see the screen is most of the answer missing. Every id this app accepts is
 * published by one of the two reporting verbs, so the refusal names which one.
 */
const NO_SUCH_DESKTOP = "Refused: no desktop has that id. `canvas.describe` lists the desktops.";
const NO_SUCH_GROUP = "Refused: no group has that id. `canvas.describe` lists the groups.";
const NO_SUCH_ITEM = "Refused: no item has that id. `content.list` lists this project's items.";
const NO_SUCH_WINDOW = "Refused: no window has that id. `canvas.describe` lists the open windows.";
const NO_ACTIVE_WINDOW = "Refused: no window is active, so there is nothing to move.";
/** Distinct from `NO_SUCH_ITEM`: both ends exist, the edge between them does not. */
const NOT_CONNECTED =
  "Refused: those two items are not connected. `relation.connect` joins them first.";
/**
 * A group of one is a leaf, and arranging a single pane is not a thing.
 *
 * The framework already reports every layout verb as unavailable there, so refusing here keeps this
 * verb's answer the same as the framework's rather than inventing a second rule.
 */
const GROUP_HAS_NO_PANES = "Refused: that group holds one window, so it has no arrangement to set.";
/**
 * The same rule `renameProjectItem` states for an item, said once for the two documents.
 *
 * A blank name is refused rather than stored: a canvas answers by name in the switcher, so one
 * called "" is a row you cannot point at. Trimmed first, because " " is blank and looks like a name
 * in a JSON payload.
 */
const BLANK_TITLE = "Refused: a name cannot be blank.";

/**
 * A record id names its own table, so an id of the wrong kind is refusable before anything acts.
 *
 * Every id this vocabulary takes is a SurrealDB record id — `canvas_document:xyz`, `project:abc`,
 * `content_item:def` — and the schema leans on that: `record<project>` and `record<canvas_document>`
 * are declared field types. The kinds are structurally distinct and nothing was checking.
 *
 * What that cost a caller is a misleading answer rather than a missing one. Handing `content.open` a
 * canvas id got "no item has that id", which is true and points at the wrong mistake; handing
 * `canvas.open` a project id navigated, failed the route's own lookup, and rendered "That canvas is
 * not here" about a canvas that exists. A caller with no screen reads both as "the record is gone"
 * and goes looking for it.
 *
 * Checked in the verb rather than in the ArkType input, which is the split this file already makes:
 * the schema says what shape arrives, the verb says what is true of the world. It also keeps
 * `toJsonSchema()` honest — a narrow is not expressible in JSON Schema, so putting it there would
 * either be dropped from what a caller is offered or break the publishing that reads it.
 *
 * Window and group ids are deliberately absent: those are framework UUIDs, not records, and have no
 * table to name.
 */
const RECORD_KINDS = {
  canvas: { reporter: "canvas.list", table: "canvas_document" },
  item: { reporter: "content.list", table: "content_item" },
  project: { reporter: "project.list", table: "project" },
} as const;

const describeWrongRecordId = (kind: keyof typeof RECORD_KINDS, id: string) => {
  const spec = RECORD_KINDS[kind];

  // No article before the kind: "a item" is the same trap `renameProjectItem` records for "a image".
  return id.startsWith(`${spec.table}:`)
    ? null
    : `Refused: "${id}" is the wrong kind of id here — this takes ${kind} ids, which \`${spec.reporter}\` reports.`;
};

/**
 * A window is addressed by its id, for the same reason a stored item is.
 *
 * This took a title, arguing that ids were "a key nothing has" because `describeCanvas` reported
 * only titles. The premise was true and the conclusion was backwards: the fix is to report the id,
 * not to address by something that does not identify. Titles do not identify a window — measured,
 * two on one canvas both titled "Links" — so first-match revealed an arbitrary one of them, and a
 * caller reading the description had no way to say which it meant.
 *
 * `describeCanvas` now reports `[id]` per window, exactly as `content.list` does, so the handle is
 * one a caller holds by the time it can want it.
 */
const REVEAL_INPUT = type({ windowId: "string" });

/**
 * A stored item is addressed by id, and the difference from `window.reveal` is the point.
 *
 * A caller revealing a window is pointing at something it can see, and titles are what it sees. A
 * caller opening a stored record is pointing into a listing where titles are not distinguishing —
 * a project holds five "Untitled" notes without complaint, and first-match would open an arbitrary
 * one. `content.list` reports the id for exactly this reason.
 */
const OPEN_INPUT = type({ itemId: "string" });

/**
 * The question the one-entry-per-value shape could not ask.
 *
 * `collection.create.note` enumerates a kind, and there are four kinds. "Connected to *this* item"
 * enumerates nothing — the subject is whatever the caller is looking at — so this capability lived
 * only inside a palette row's `onClick`, reachable by a pointer and by nothing else. It is the case
 * `input` was added for.
 */
const CONNECTED_INPUT = type({ itemId: "string" });

/**
 * Taking something out of the library, and putting it back.
 *
 * The vocabulary was lopsided and the tool list proved it: ninety-seven registered tools, and an
 * agent could make a note, a collection and a connection while being unable to remove any of them.
 * Archiving existed only behind the rail's button and a palette row — a capability a pointer can
 * reach and nothing else, which `AGENTS.md` names as the shape to avoid.
 *
 * Archive takes an id from `content.list`; restore takes one from `content.listArchived`, which
 * exists for exactly that reason. The two lists stay separate rather than one list with a flag,
 * following the rail: it holds them apart so a set of items can never be read under the other's
 * heading, and a report that mixed them would hand a caller ids it cannot act on with either verb.
 */
const ARCHIVE_INPUT = type({ itemId: "string" });

/**
 * Giving something a name, which is the verb an agent needs most and had least.
 *
 * Everything this vocabulary creates is called "Untitled 7" — `note.create` takes no title, because
 * the next number is a fact about the project rather than something a caller should have to compute.
 * So an agent could fill a library and never make one entry of it findable, while the capability sat
 * in two click handlers.
 */
const RENAME_INPUT = type({ itemId: "string", title: "string" });

/**
 * Joining two items, and the one place the entry-per-value rule is deliberately not applied.
 *
 * That rule — `collection.create.link` rather than a create verb taking a kind — exists to remove an
 * argument, so it pays wherever the values are the *only* argument. Here they are not: the endpoints
 * cannot be enumerated, so this verb takes input whichever way `kind` is expressed, and splitting it
 * five ways would publish five tools differing by one word while still requiring input. The enum
 * carries the same information in one place, and `toJsonSchema()` puts the five values in front of a
 * caller exactly as five entries would.
 *
 * Both ends are item ids, not window ids: an edge joins records, and the pair need not be open.
 */
const CONNECT_INPUT = type({
  "kind?": type.enumerated(...RELATION_KINDS),
  sourceItemId: "string",
  targetItemId: "string",
});

/** No kind, because disconnecting does not need to know what the edge claimed. */
const DISCONNECT_INPUT = type({ sourceItemId: "string", targetItemId: "string" });

/**
 * Changing what an existing edge says, named by its ends rather than by its id.
 *
 * `setRelationKind` takes a relation id because a person clicked a specific connector — "there is
 * nothing to resolve", as its own comment puts it. A caller that cannot see the canvas has clicked
 * nothing; it holds the item ids `content.list` gave it, and `findRelation` already turns a pair
 * into the edge between them. Addressing by pair also keeps the report honest: publishing a relation
 * id would be adding a handle purely so a verb could take it, when the handles already published
 * answer the question.
 *
 * `kind` is required here, unlike on `relation.connect`. Connecting without saying what it means is
 * a real intent — that is what the drag does — but re-typing an edge to nothing is not.
 */
const SET_KIND_INPUT = type({
  kind: type.enumerated(...RELATION_KINDS),
  sourceItemId: "string",
  targetItemId: "string",
});

/** Empty clears the label rather than storing `""`, which is the store's own rule, not a new one. */
const SET_LABEL_INPUT = type({
  label: "string",
  sourceItemId: "string",
  targetItemId: "string",
});

/**
 * The edge between two items, or `null` when they are not joined.
 *
 * Refusing rather than creating one is the whole distinction from `relation.connect`: a caller
 * asking what a connection means has asserted that it exists, and quietly inventing it would turn a
 * mistaken belief into a stored fact.
 */
const resolveRelation = (
  projectId: string,
  ends: Readonly<{ sourceItemId: string; targetItemId: string }>,
) => {
  const resolved = resolveEndpoints(projectId, ends);

  // The endpoints' own refusal passes through: "no such item" and "not connected" are different
  // corrections, and flattening them would send a caller to fix the wrong one.
  if (typeof resolved === "string") {
    return resolved;
  }

  return findRelation(relations$.peek(), resolved.source, resolved.target) ?? NOT_CONNECTED;
};

/**
 * One stored item by the id a caller was given, or the refusal saying why not.
 *
 * Four verbs resolve an item — open, archive, rename, and the connected-to collection — and each
 * had written this out: read the listing, `find` by id, refuse if absent. Four copies of a lookup is
 * how the rename capability came to have two implementations that disagreed, so the fourth appearing
 * is the point to stop rather than the point to add a fifth.
 *
 * Resolved against the cache `content.list` reads rather than re-queried. That is not a saving — it
 * is what makes the pair coherent: what a caller can list and what it can act on are one set, and an
 * id that listed a moment ago cannot fail here for having come from a different read.
 *
 * Returns the refusal rather than `null`, matching `resolveEndpoints` beside it and `AppAction.run`
 * above, so a verb passes the reason through instead of inventing its own words for it.
 */
const resolveItem = (projectId: string, itemId: string): ContentItemRecord | string =>
  // The kind first: "that is a canvas id" is a different correction from "no item has that id", and
  // one lookup answering both would send a caller to fix the wrong thing.
  describeWrongRecordId("item", itemId) ??
  getProjectContent(projectContent$.peek(), projectId)?.find((item) => item.id === itemId) ??
  NO_SUCH_ITEM;

/**
 * Both ends resolved against the same cache `content.list` reads, so what a caller can list is what
 * it can join — the coherence `content.open` already keeps.
 *
 * An item joined to itself is refused rather than stored. The gesture cannot express it, because a
 * drag starts on one window and ends on another, so it has never been reachable; a verb that can
 * express it should not be the way a self-edge first enters the database.
 *
 * **Returns the refusal rather than `null`, because the three ways to fail are not one fact.** A
 * missing source, a missing target and a self-edge collapsed into a single `null`, so every caller
 * of this could only say "no such item" — which is a lie for the self-edge, and half an answer when
 * one of two ids is wrong and the caller is not told which.
 */
const resolveEndpoints = (
  projectId: string,
  ends: Readonly<{ sourceItemId: string; targetItemId: string }>,
): Readonly<{ source: string; target: string }> | string => {
  const items = getProjectContent(projectContent$.peek(), projectId);
  const source = items?.find((candidate) => candidate.id === ends.sourceItemId);
  const target = items?.find((candidate) => candidate.id === ends.targetItemId);

  if (source === undefined || target === undefined) {
    // Which end, by name. A caller holding two ids and told only "not found" has to guess.
    const missing = [
      source === undefined ? `source ${ends.sourceItemId}` : null,
      target === undefined ? `target ${ends.targetItemId}` : null,
    ].filter((part) => part !== null);

    return `Refused: no item has ${missing.join(" or ")}. \`content.list\` lists this project's items.`;
  }

  return source.id === target.id
    ? "Refused: an item cannot be connected to itself."
    : { source: source.id, target: target.id };
};

/**
 * What a cut edge said, or nothing when it said nothing worth reporting.
 *
 * Separate from the verb because the verb answers only once its write lands, and no test in this
 * app can resolve a write — `in-memory-engine.test.ts` records why. This rule is the half worth
 * pinning and it depends on nothing but the edge that was read before the cut.
 *
 * A default `relates` edge carrying no label says nothing beyond existing, so losing it costs
 * nothing to report — the same rule the connector draws by.
 */
const describeCutRelation = (removed: ReturnType<typeof findRelation>) => {
  const lost = [
    removed?.kind === undefined || removed.kind === DEFAULT_RELATION_KIND ? null : removed.kind,
    removed?.label?.trim() ? `'${removed.label.trim()}'` : null,
  ].filter((part) => part !== null);

  return lost.length === 0
    ? undefined
    : `Disconnected, taking ${lost.join(" ")} with it. Reversible: relation.connect rebuilds the edge and relation.setLabel restores what it said.`;
};

/**
 * Naming a container, which the framework supports and its contextual commands do not expose.
 *
 * `group.setLayout.tabs` and its siblings act on *the active window's container* — the right shape
 * for a keyboard, where "the group" means the one you are in. A caller that cannot see the screen is
 * not in one, and had to reveal a member window first and hope it landed in the container it meant.
 *
 * The framework's own facade takes explicit ids — `setGroupLayoutMode({ containerId, groupId,
 * layout })`, `setGroupTitle`, `closeGroup` — so nothing here is a gap it needed to fill. What the
 * app adds is only the resolution: a caller holds the group id the canvas description publishes, and
 * the container id is a fact about that group's tree rather than something a caller should carry.
 */
const GROUP_LAYOUT_INPUT = type({
  groupId: "string",
  layout: type.enumerated(...GROUP_LAYOUT_MODES),
});

const GROUP_RENAME_INPUT = type({ groupId: "string", title: "string" });

const GROUP_INPUT = type({ groupId: "string" });

/**
 * The container a layout verb acts on, or `null` when the group has no shape to set.
 *
 * A group holding one window is a leaf rather than a container, and arranging one pane is not a
 * thing — the framework already reports every layout verb as unavailable there, measured on a live
 * canvas. Refusing here rather than reaching for `tree.id` regardless keeps the verb's answer the
 * same as the framework's.
 */
const resolveGroupContainer = (state: InfiniteCanvasState<WindowKind>, groupId: string) => {
  const group = findInfiniteCanvasGroup(state, groupId);

  return group === null || !isInfiniteCanvasGroupContainer(group.tree)
    ? null
    : { containerId: group.tree.id, groupId: group.id };
};

/**
 * Desktops, which the framework can do and publishes only as templates.
 *
 * `workspace.create`, `workspace.enter`, `workspace.close` and `workspace.moveActiveWindow` all
 * carry `workspaceId: ""` in their descriptors — a shape waiting for an argument, which is why
 * `published-commands.ts` holds them back rather than offering a verb that acts on a workspace
 * called `""`. These are the `AppAction`s that supply the argument, the same relationship
 * `window.reveal` already has with the framework command of that name, and they take the id the
 * canvas description publishes.
 */
const DESKTOP_INPUT = type({ workspaceId: "string" });

/** A name is optional: absent means number it after the desktops that exist. */
const DESKTOP_CREATE_INPUT = type({ "title?": "string" });

/** Refusing an id no desktop answers to, rather than switching to nothing and reporting success. */
const hasWorkspace = (state: InfiniteCanvasState<WindowKind>, workspaceId: string) =>
  findInfiniteCanvasWorkspace(state, workspaceId) !== null;

/**
 * The document level, which the vocabulary could not name at all.
 *
 * Twenty verbs and not one `canvas.*` or `project.*`: nothing made a canvas, copied one, went to
 * one, or reported that any existed but the open one. An agent could make a *desktop* — a filter
 * over the windows inside a canvas — while the canvas the filter is over was unreachable, and
 * `/canvas/$canvasId` is what this app is addressed by.
 *
 * It was pointer-only rather than merely unbuilt: the switchers and the palette hold these
 * capabilities in click handlers, and no framework command makes a canvas, because a canvas is a
 * database record rather than anything the framework models.
 *
 * The ids come from the two reporters `model-context` registers beside these. Neither open verb
 * checks its id against a cache first, for the reason `content.restore` gives: nothing caches the
 * canvas or project lists, and inventing a cache so a verb could refuse locally would be machinery
 * bought to improve one error message. A bad id lands on the route's own "that canvas is not here".
 */
const CANVAS_OPEN_INPUT = type({ canvasId: "string" });

const PROJECT_OPEN_INPUT = type({ projectId: "string" });

/** Optional throughout, matching `workspace.create`: absent means number it after what exists. */
const DOCUMENT_CREATE_INPUT = type({ "title?": "string" });

/**
 * Renaming, which was the one thing at this level a pointer could do and a caller could not.
 *
 * The creating verbs take an optional title, so a caller could name what it made and never rename
 * it afterwards — and a canvas is the thing you name *after* the work tells you what it is. Both
 * switchers already do this through `useInlineRename`; the capability existed and only a pointer
 * could reach it, which `AGENTS.md` names as the shape to avoid.
 *
 * By id rather than "the one I am in", unlike `canvas.duplicate`: the reporters publish every id, a
 * caller tidying up names is usually not standing in the canvas it is renaming, and the switcher
 * offers the same reach.
 */
/**
 * What a note says, which the vocabulary could create and never fill in.
 *
 * `note.create` makes an empty one and `content.rename` names it, so a caller could build a library
 * of titled blank pages in a workbench whose whole subject is prose. Measured: 110 registered tools
 * and not one of them wrote a word.
 *
 * Plain text in, plain text out. The stored form is a serialized editor state — `note-text.ts`
 * already read it without an engine and now writes it the same way — and a caller should no more
 * compose that JSON than a person should type it.
 *
 * The pair is deliberate. A write with no read is the write-blind shape `AppAction.run` returns
 * refusals to prevent: a caller replaces a note's contents, is told "done", and has no way to learn
 * what it destroyed or whether the words arrived.
 */
const NOTE_WRITE_INPUT = type({ itemId: "string", text: "string" });

const NOTE_READ_INPUT = type({ itemId: "string" });

const CANVAS_RENAME_INPUT = type({ canvasId: "string", title: "string" });

const PROJECT_RENAME_INPUT = type({ projectId: "string", title: "string" });

const APP_ACTIONS: readonly AppAction[] = [
  {
    description:
      "Make a new canvas in this project and go to it. Without a title it is numbered after the canvases that exist.",
    id: "canvas.create",
    input: DOCUMENT_CREATE_INPUT,
    label: "New canvas",
    run: ({ goToCanvas, projectId }, input) => {
      const parsed = DOCUMENT_CREATE_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      return createCanvas({ projectId, title: parsed.title }).then((created) => {
        goToCanvas({ canvasId: created.id });

        return undefined;
      });
    },
  },
  {
    description:
      "Copy the open canvas, with everything on it, and go to the copy. It is named after the original.",
    id: "canvas.duplicate",
    label: "Duplicate this canvas",
    // No argument: "the canvas I am in" is the route's answer, and a caller that carried it could
    // name a canvas it is not looking at — which is a different verb.
    run: ({ canvasId, canvasTitle, goToCanvas, projectId }) => {
      return duplicateCanvas({ canvasId, canvasTitle, projectId }).then((created) => {
        goToCanvas({ canvasId: created.id });

        return undefined;
      });
    },
  },
  {
    description: "Go to a canvas in this project. The id comes from canvas.list.",
    id: "canvas.open",
    input: CANVAS_OPEN_INPUT,
    label: "Go to a canvas",
    run: ({ goToCanvas }, input) => {
      const parsed = CANVAS_OPEN_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      const wrongKind = describeWrongRecordId("canvas", parsed.canvasId);

      if (wrongKind !== null) {
        return wrongKind;
      }

      goToCanvas({ canvasId: parsed.canvasId });

      return undefined;
    },
  },
  {
    description: "Rename a canvas in this project. The id comes from canvas.list.",
    id: "canvas.rename",
    input: CANVAS_RENAME_INPUT,
    label: "Rename a canvas",
    run: ({ refreshRoute }, input) => {
      const parsed = CANVAS_RENAME_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      const wrongKind = describeWrongRecordId("canvas", parsed.canvasId);

      if (wrongKind !== null) {
        return wrongKind;
      }

      const title = parsed.title.trim();

      if (title === "") {
        return BLANK_TITLE;
      }

      /*
       * Re-read after the write, because the route holds the title the switcher draws.
       *
       * Renaming without it is the shape that had three creation paths missing from the library:
       * the record changes and the surface showing it never asks again. Refreshed whichever canvas
       * was renamed rather than only the open one — `invalidate` re-runs one loader, and deciding
       * "was that the one I am looking at" here would be a second copy of a fact the route owns.
       */
      return database.canvases.rename({ canvasId: parsed.canvasId, title }).then(() => {
        refreshRoute();

        return undefined;
      });
    },
  },
  {
    description:
      "Make a new project and go to it. Without a title it is numbered after the projects that exist.",
    id: "project.create",
    input: DOCUMENT_CREATE_INPUT,
    label: "New project",
    run: ({ goToCanvas }, input) => {
      const parsed = DOCUMENT_CREATE_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      // A project is reached through a canvas, so creating one and landing on it is a single act —
      // `createProject` returns the first canvas for exactly this reason.
      return createProject({ title: parsed.title }).then((created) => {
        goToCanvas({ canvasId: created.id });

        return undefined;
      });
    },
  },
  {
    description:
      "Go to another project, entering it through its most recent canvas. The id comes from project.list.",
    id: "project.open",
    input: PROJECT_OPEN_INPUT,
    label: "Go to a project",
    run: ({ goToCanvas, projectId }, input) => {
      const parsed = PROJECT_OPEN_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      const wrongKind = describeWrongRecordId("project", parsed.projectId);

      if (wrongKind !== null) {
        return wrongKind;
      }

      /*
       * The same rule the switcher and the palette ask, including whether it is a move: going to
       * the project you are already in resolves to nothing rather than walking you to whichever of
       * its canvases was last written.
       */
      return getProjectEntryCanvas({
        openProjectId: projectId,
        projectId: parsed.projectId,
      }).then((canvasId) => {
        if (canvasId !== null) {
          goToCanvas({ canvasId });
        }

        return undefined;
      });
    },
  },
  {
    description: "Rename a project. The id comes from project.list.",
    id: "project.rename",
    input: PROJECT_RENAME_INPUT,
    label: "Rename a project",
    run: ({ refreshRoute }, input) => {
      const parsed = PROJECT_RENAME_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      const wrongKind = describeWrongRecordId("project", parsed.projectId);

      if (wrongKind !== null) {
        return wrongKind;
      }

      const title = parsed.title.trim();

      if (title === "") {
        return BLANK_TITLE;
      }

      // The route carries `projectTitle` beside the canvas's own, so the same re-read covers both.
      return database.projects.rename({ projectId: parsed.projectId, title }).then(() => {
        refreshRoute();

        return undefined;
      });
    },
  },
  {
    description: describeWrappedCommand({
      argument: "Without a title it is numbered after the desktops that exist.",
      id: "workspace.create",
    }),
    id: "workspace.create",
    input: DESKTOP_CREATE_INPUT,
    label: "New desktop",
    run: ({ actions, state }, input) => {
      const parsed = DESKTOP_CREATE_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      createDesktop({
        actions,
        existingTitles: state.workspaces.map((workspace) => workspace.title),
        title: parsed.title,
      });

      return undefined;
    },
  },
  {
    description: describeWrappedCommand({
      argument:
        "It shows that desktop's windows and hides the rest. The id comes from `canvas.describe`.",
      id: "workspace.enter",
    }),
    id: "workspace.enter",
    input: DESKTOP_INPUT,
    label: "Go to a desktop",
    run: ({ actions, state }, input) => {
      const parsed = DESKTOP_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      if (!hasWorkspace(state, parsed.workspaceId)) {
        return NO_SUCH_DESKTOP;
      }

      actions.executeCommand({ type: "workspace.enter", workspaceId: parsed.workspaceId });

      return undefined;
    },
  },
  {
    description: describeWrappedCommand({
      argument:
        "A desktop is a filter over windows, not a container. The id comes from `canvas.describe`.",
      id: "workspace.close",
    }),
    id: "workspace.close",
    input: DESKTOP_INPUT,
    label: "Close a desktop",
    run: ({ actions, state }, input) => {
      const parsed = DESKTOP_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      if (!hasWorkspace(state, parsed.workspaceId)) {
        return NO_SUCH_DESKTOP;
      }

      actions.executeCommand({ type: "workspace.close", workspaceId: parsed.workspaceId });

      return undefined;
    },
  },
  {
    description: describeWrappedCommand({
      argument: "The id comes from `canvas.describe`.",
      id: "workspace.moveActiveWindow",
    }),
    id: "workspace.moveActiveWindow",
    input: DESKTOP_INPUT,
    label: "Move the window to a desktop",
    run: ({ actions, state }, input) => {
      const parsed = DESKTOP_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      /*
       * Both facts are checked, and separately, because either alone makes this a no-op — and a
       * caller told only "refused" would not know which of the two to fix.
       */
      if (!hasWorkspace(state, parsed.workspaceId)) {
        return NO_SUCH_DESKTOP;
      }

      if (state.activeWindowId === null) {
        return NO_ACTIVE_WINDOW;
      }

      actions.executeCommand({
        type: "workspace.moveActiveWindow",
        workspaceId: parsed.workspaceId,
      });

      return undefined;
    },
  },
  {
    description:
      "Arrange a group's panes side by side, folded, or as tabs. The group id comes from the canvas description.",
    id: "group.setLayout",
    input: GROUP_LAYOUT_INPUT,
    label: "Arrange a group",
    run: ({ actions, state }, input) => {
      const parsed = GROUP_LAYOUT_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      if (findInfiniteCanvasGroup(state, parsed.groupId) === null) {
        return NO_SUCH_GROUP;
      }

      const target = resolveGroupContainer(state, parsed.groupId);

      // The group is there but holds one window, which is a different answer from "no such group".
      if (target === null) {
        return GROUP_HAS_NO_PANES;
      }

      actions.setGroupLayoutMode({ ...target, layout: parsed.layout });

      return undefined;
    },
  },
  {
    description: "Rename a group. An empty title returns it to being named after what it holds.",
    id: "group.rename",
    input: GROUP_RENAME_INPUT,
    label: "Rename a group",
    run: ({ actions, state }, input) => {
      const parsed = GROUP_RENAME_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      /*
       * Checked against state rather than dispatched blind, so an id naming no group says so
       * instead of writing a title into a record that is not there.
       */
      if (findInfiniteCanvasGroup(state, parsed.groupId) === null) {
        return NO_SUCH_GROUP;
      }

      actions.setGroupTitle({ groupId: parsed.groupId, title: parsed.title });

      return undefined;
    },
  },
  {
    // Not `describeWrappedCommand`: the framework's `group.dissolve` acts on the active window's
    // group and takes no id, so quoting it here contradicts itself.
    description:
      "Ungroup a container. A split's panes stay exactly where they were; tabbed or folded ones share one rect, so they are placed clear of each other. The id comes from `canvas.describe`.",
    id: "group.dissolve",
    input: GROUP_INPUT,
    label: "Ungroup",
    run: ({ actions, state }, input) => {
      const parsed = GROUP_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      if (findInfiniteCanvasGroup(state, parsed.groupId) === null) {
        return NO_SUCH_GROUP;
      }

      actions.closeGroup(parsed.groupId);

      return undefined;
    },
  },
  {
    description:
      "Connect two items, optionally saying what the connection means. Ids come from content.list.",
    id: "relation.connect",
    input: CONNECT_INPUT,
    label: "Connect two items",
    run: ({ projectId }, input) => {
      const parsed = CONNECT_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      const ends = resolveEndpoints(projectId, parsed);

      if (typeof ends === "string") {
        return ends;
      }

      return connectItems({ kind: parsed.kind, projectId, ...ends }).then(() => undefined);
    },
  },
  {
    description:
      "Say what an existing connection between two items means. Refuses if they are not connected.",
    id: "relation.setKind",
    input: SET_KIND_INPUT,
    label: "Set what a connection means",
    run: ({ projectId }, input) => {
      const parsed = SET_KIND_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      const relation = resolveRelation(projectId, parsed);

      if (typeof relation === "string") {
        return relation;
      }

      return setRelationKind({ kind: parsed.kind, projectId, relationId: relation.id }).then(
        () => undefined,
      );
    },
  },
  {
    description:
      "Write a label on an existing connection between two items. An empty label clears it.",
    id: "relation.setLabel",
    input: SET_LABEL_INPUT,
    label: "Label a connection",
    run: ({ projectId }, input) => {
      const parsed = SET_LABEL_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      const relation = resolveRelation(projectId, parsed);

      if (typeof relation === "string") {
        return relation;
      }

      return setRelationLabel({ label: parsed.label, projectId, relationId: relation.id }).then(
        () => undefined,
      );
    },
  },
  {
    description: "Remove the connection between two items, if they are connected.",
    id: "relation.disconnect",
    input: DISCONNECT_INPUT,
    label: "Disconnect two items",
    run: ({ projectId }, input) => {
      const parsed = DISCONNECT_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      const ends = resolveEndpoints(projectId, parsed);

      /*
       * Undirected, matching `findRelation`: a caller naming the pair in the other order means the
       * same edge. `database.relations.disconnect` removes the pair however it was stored, so the
       * order a caller happens to say is not a way to fail.
       *
       * Removing an edge that is not there is not refused. Unlike `relation.setKind`, this verb's
       * intent is a state rather than an act — "these two are not connected" — and that state
       * already holds, so reporting failure would be reporting the opposite of the truth.
       */
      if (typeof ends === "string") {
        return ends;
      }

      // Read before the write, because afterwards there is nothing left to read.
      const removed = findRelation(relations$.peek(), ends.source, ends.target);

      const cut = disconnectItems({ projectId, ...ends });

      /*
       * Say what went, because this is the one removal in the app that destroys something.
       *
       * `fn::unrelate_content_items` deletes the row and the canvas's `history.undo` does not reach
       * the database, so for a while this string was the only trace a cut edge left. It is no longer
       * the only one — `disconnectItems` remembers its own inverse — but it is still the only trace
       * a *caller* gets, since the undo it registers is a palette row for a person.
       *
       * A default `relates` edge carrying no label says nothing beyond existing, so losing it costs
       * nothing to report — the same rule the connector draws by, and the reason `getRelationLabel`
       * renders that case as nothing at all.
       *
       * **This said "cannot be undone" and that is no longer true.** `disconnectItems` now remembers
       * its own inverse, so the cut is reversible from the palette's undo row for a person and by
       * reconnecting for a caller. The sentence is kept because what went is still worth naming —
       * an agent that reads "supports 'load-bearing evidence'" learns what it removed, which is the
       * half of this that was always about legibility rather than recovery.
       */
      return cut.then(() => describeCutRelation(removed));
    },
  },
  {
    description:
      "Open a window listing everything connected to the item with this id, as listed by content.list.",
    id: "collection.create.connectedTo",
    input: CONNECTED_INPUT,
    label: "Collection of what an item connects to",
    run: ({ actions, projectId, state }, input) => {
      const parsed = CONNECTED_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      const item = resolveItem(projectId, parsed.itemId);

      if (typeof item === "string") {
        return item;
      }

      // The title comes from the record, not from the caller. A collection named for a subject the
      // caller merely asserted could disagree with the subject it actually lists.
      return openNewCollection({
        actions,
        projectId,
        question: { connectedTo: item.id },
        state,
        title: `Connected to ${item.title}`,
      }).then(() => undefined);
    },
  },
  {
    description:
      "Open a stored item on the canvas by its id, as listed by content.list. Reveals it if a window already shows it.",
    id: "content.open",
    input: OPEN_INPUT,
    label: "Open an item by id",
    run: ({ actions, projectId, state }, input) => {
      const parsed = OPEN_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      const item = resolveItem(projectId, parsed.itemId);

      if (typeof item === "string") {
        return item;
      }

      // Already handles the record being open: `openContentWindow` reveals the existing window
      // rather than binding a second one to it, which is the rule the library rail learned first.
      openItemWindow({ actions, item, state });

      return undefined;
    },
  },
  {
    description: describeWrappedCommand({
      argument: "The id comes from `canvas.describe`.",
      id: "window.reveal",
    }),
    id: "window.reveal",
    input: REVEAL_INPUT,
    label: "Reveal a window by id",
    run: ({ actions, state }, input) => {
      const parsed = REVEAL_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      /*
       * Resolved against the state the description was built from, so what a caller can read and
       * what it can reveal are one set — the same coherence `content.open` keeps with `content.list`.
       * An id naming no window says so, rather than revealing something else.
       */
      const target = state.windows.find((window) => window.id === parsed.windowId);

      if (target === undefined) {
        return NO_SUCH_WINDOW;
      }

      // `window.reveal` rather than `focusWindow`: the framework's verb already handles a window
      // that is minimized, behind a tab, or on another desktop. Focusing alone reaches none of those.
      actions.executeCommand({ type: "window.reveal", windowId: target.id });

      return undefined;
    },
  },
  {
    /*
     * The kinds are read from the writer map rather than written out here.
     *
     * This said "only notes can be renamed this way; other kinds are renamed from their window",
     * which was true when it was written and false by the time `rename-item.ts` gave collections,
     * images and links a writer each. A description is the only thing a caller has to decide
     * whether to try, so an out-of-date one hides a capability as effectively as not having it —
     * an agent holding an image reads that sentence and does not ask.
     *
     * `RENAMEABLE_KINDS` is derived from the map that does the saving, so the sentence cannot
     * outlive the fact again. Same reason the `input` types are the schema: one declaration, both
     * halves.
     */
    description: `Rename an item, by the id content.list gives. Kinds that can be renamed: ${RENAMEABLE_KINDS.join(", ")}.`,
    id: "content.rename",
    input: RENAME_INPUT,
    label: "Rename an item",
    run: ({ actions, projectId, state }, input) => {
      const parsed = RENAME_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      const item = resolveItem(projectId, parsed.itemId);

      if (typeof item === "string") {
        return item;
      }

      // The refusal is the module function's, passed through rather than restated: blank, unchanged
      // and wrong-kind are its rules, and the controls that call it enforce exactly the same ones.
      return renameProjectItem({ actions, item, state, title: parsed.title });
    },
  },
  {
    description:
      "Archive an item, taking it out of the library. Reversible with content.restore. The id comes from content.list.",
    id: "content.archive",
    input: ARCHIVE_INPUT,
    label: "Archive an item",
    run: ({ actions, projectId, state }, input) => {
      const parsed = ARCHIVE_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      const item = resolveItem(projectId, parsed.itemId);

      if (typeof item === "string") {
        return item;
      }

      /*
       * The window closes with it, which is the rail's rule rather than a new one: an item no
       * longer offered anywhere but still sitting open on the canvas is the state where "archived"
       * stops meaning anything.
       */
      const openWindow = state.windows.find(
        (window) => getContentWindowItemId(window) === parsed.itemId,
      );

      if (openWindow !== undefined) {
        actions.closeWindow(openWindow.id);
      }

      return archiveProjectItem({ itemId: parsed.itemId, projectId }).then(() => undefined);
    },
  },
  {
    description:
      "Put an archived item back in the library. The id comes from content.listArchived.",
    id: "content.restore",
    input: ARCHIVE_INPUT,
    label: "Restore an archived item",
    run: ({ projectId }, input) => {
      const parsed = ARCHIVE_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      /*
       * Not resolved against a cached listing, unlike every other id-taking verb here.
       *
       * Archived items are deliberately absent from `projectContent$` — that observable is what the
       * library shows — so there is nothing local to check an id against. `content.restore` on an id
       * naming nothing is a no-op in the database rather than a corruption, and inventing a second
       * cache of archived items so this verb could refuse locally would be machinery bought to
       * improve one error message.
       *
       * The *kind* is still checkable without one, and is: an id names its table whether or not
       * anything holds the record, so a canvas id here is refusable where a wrong archived id is not.
       */
      const wrongKind = describeWrongRecordId("item", parsed.itemId);

      if (wrongKind !== null) {
        return wrongKind;
      }

      return restoreProjectItem({ itemId: parsed.itemId, projectId }).then(() => undefined);
    },
  },
  {
    description:
      "Replace what a note says, as plain text. One line per paragraph. The id comes from content.list.",
    id: "note.write",
    input: NOTE_WRITE_INPUT,
    label: "Write a note",
    run: ({ projectId }, input) => {
      const parsed = NOTE_WRITE_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      const item = resolveItem(projectId, parsed.itemId);

      if (typeof item === "string") {
        return item;
      }

      if (item.kind !== NOTE_KIND) {
        return `Refused: "${item.title}" is a ${item.kind}, and only a note holds prose.`;
      }

      const stored = toSerializedNote(parsed.text);

      /*
       * Through the note store, not the gateway: it is the single writer, and the revision guard is
       * only a guard if everything goes through it. `toNote` is safe here because the kind is
       * checked.
       *
       * The one write in this vocabulary that answers before the database has it. Every other verb
       * returns its promise so "done" means stored; this one cannot, because the gateway debounces.
       * It is honest anyway: the store and the listing below are both updated first, so the very
       * next `note.read` sees the new text. What a caller can observe is already true.
       */
      writeNote(toNote(item), stored, noteGateway);
      // And into the listing `note.read` resolves against, the same fold a rename does. Without it
      // a caller checking its own write reads the prose it just replaced.
      setProjectItemContent(item.id, { text: stored });

      return undefined;
    },
  },
  {
    description:
      "Read what a note says, as plain text. The id comes from content.list. Titles are in the listing already.",
    id: "note.read",
    input: NOTE_READ_INPUT,
    label: "Read a note",
    run: ({ projectId }, input) => {
      const parsed = NOTE_READ_INPUT(input);

      if (parsed instanceof type.errors) {
        return describeInvalidInput(parsed);
      }

      const item = resolveItem(projectId, parsed.itemId);

      if (typeof item === "string") {
        return item;
      }

      if (item.kind !== NOTE_KIND) {
        return `Refused: "${item.title}" is a ${item.kind}, and only a note holds prose.`;
      }

      /*
       * The answer, returned rather than reported as "done" — which `AppAction.run` allows for
       * exactly this: "what the caller needs told, or nothing when done covers it".
       *
       * Read from the listing rather than the note store, because the store holds only notes some
       * window has opened. A caller reading a note it has never opened is the ordinary case.
       */
      const text = getNoteText(toNote(item).content.text);

      return text === "" ? `"${item.title}" is empty.` : text;
    },
  },
  {
    description: "Put a new, empty note on the canvas.",
    id: "note.create",
    label: "New note",
    run: ({ actions, projectId, state }) =>
      openNewNote({ actions, projectId, state }).then(() => undefined),
  },
  ...LISTABLE_KINDS.map((kind) => ({
    description: `Open a window listing every ${kind.label.toLowerCase().replace(/s$/, "")} in this project.`,
    id: `collection.create.${kind.kind}`,
    label: `Collection of ${kind.label.toLowerCase()}`,
    run: ({ actions, projectId, state }: AppActionContext) =>
      openNewCollection({
        actions,
        projectId,
        question: { listsKind: kind.kind },
        state,
        title: kind.label,
      }).then(() => undefined),
  })),
  {
    description:
      "Dock the selected windows together into one group. Windows already in a group, and minimized ones, are left where they are.",
    id: "group.createFromSelection",
    // Against what the framework will take, not the raw selection: two panes of one shell are both
    // dropped. Two is this verb's floor; the framework itself refuses only zero.
    isEnabled: ({ state }) => getGroupableWindowIds(state).length >= 2,
    label: "Group selected",
    run: ({ actions, state }) => {
      const windowIds = getGroupableWindowIds(state);

      if (windowIds.length < 2) {
        return "Refused: grouping needs two selected windows that are not already grouped or minimized.";
      }

      // Bounds of what is being grouped, not of the selection — dropped members are not in it.
      const rect = getWindowBounds(state, windowIds);

      if (rect === null) {
        return "Refused: the selection no longer holds two windows to group.";
      }

      actions.createGroup({
        groupId: globalThis.crypto.randomUUID(),
        rect,
        windowIds,
      });
      /*
       * Then look at it. Grouping does not move the windows — where they are is the whole point of
       * choosing them — so the shell is the union of wherever they happened to be, which can be
       * most of a screen away from the middle. Watched: two selected windows produced a shell whose
       * bottom edge sat at screen y=1021 in a 900-tall viewport, 289px below anything visible and
       * the rest of it behind the HUD. The verb had worked and looked like it had not.
       *
       * `fit` rather than `center`, because a shell is usually larger than either member and
       * centring one that does not fit shows you its middle.
       */
      actions.navigateToRect({ behavior: { paddingPx: 64, type: "fit" }, rect });

      return undefined;
    },
  },
];

const getAppAction = (id: string) => APP_ACTIONS.find((action) => action.id === id);

/** Enablement resolved against live state, so a caller never has to know an action's rule. */
const isAppActionEnabled = (action: AppAction, context: AppActionContext) =>
  action.isEnabled?.(context) ?? true;

export { APP_ACTIONS, describeCutRelation, getAppAction, isAppActionEnabled };
export type { AppAction, AppActionContext };
