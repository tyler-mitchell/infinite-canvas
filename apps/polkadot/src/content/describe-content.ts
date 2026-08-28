import type { InfiniteCanvasState } from "@hyphened/infinite-canvas";
import { type } from "arktype";

import { getContentWindowItemId, type WindowKind } from "../canvas/window-registry";
import { COLLECTION_KIND, CollectionContent } from "../collections/collection-gateway";
import type { ContentRelation } from "../database/database.client";
import { getProjectContent, type ProjectContent } from "./project-content";

/** What `getProjectContent` hands back once it has an answer. */
type ProjectContentItems = NonNullable<ReturnType<typeof getProjectContent>>;

/**
 * What this project holds, and which of it is not on the canvas.
 *
 * `describeCanvas` answers "what am I looking at". This answers the question that follows and is
 * the one a caller cannot get any other way: what exists that I am *not* looking at. Closing a
 * window does not delete the record — the note is a record and the window was a view of it — so
 * without this, everything not currently open is invisible to anything that cannot open the
 * library rail and read it.
 *
 * `null` is reported as "not loaded yet" rather than as an empty project, because those are
 * different facts and `project-content` is careful to keep them apart: "nobody has asked yet is
 * not there are none". Collapsing them here would throw that away at the last step and tell a
 * caller the project is empty while the first query is still in flight.
 */

/**
 * Which records have a window, by the one field every content window carries.
 *
 * Deliberately simpler than the connector layer's version of this question, which also excludes
 * minimized windows, windows hidden behind a tab, and windows on another desktop. Those exclusions
 * exist because a connector has to be *drawn* somewhere; "is this record open at all" is a
 * different question, and a minimized note is open.
 */
const getOpenItemIds = (state: InfiniteCanvasState<WindowKind>) =>
  new Set(
    state.windows
      .map((window) => getContentWindowItemId(window))
      .filter((itemId) => itemId !== null),
  );

/**
 * What the connections say, in the same terms the listing above uses.
 *
 * A caller that cannot see the screen was told what this project holds and nothing about how any of
 * it is joined — which on a canvas whose whole point is relating things is most of the content. The
 * lines are drawn, they carry a word, and none of it was readable except by looking.
 *
 * Reported here rather than with the canvas, because `relates_to` is `IN content_item OUT
 * content_item`: an edge joins two *records* and goes on existing when neither is open. Putting it
 * in the canvas report would have described a thing by its drawing, and said nothing at all about
 * the connections between two items that are merely closed.
 *
 * The stored order is kept. `findRelation` is undirected so the same pair cannot be joined twice in
 * reverse, but the kinds are not symmetric — "supports" and "refines" read source to target — so
 * reversing the pair here would silently reverse the claim.
 *
 * The default kind is named rather than hidden. `getRelationLabel` drops "relates" because an
 * unlabelled line already says it on screen; a reader with no line has nothing to infer it from.
 */
const describeRelations = (
  relations: readonly ContentRelation[],
  items: ProjectContentItems,
): string => {
  if (relations.length === 0) {
    return "No connections.";
  }

  const titleOf = (itemId: string) => {
    const item = items.find((candidate) => candidate.id === itemId);

    // An endpoint the listing does not hold is still reported. An edge with one end missing is a
    // fact worth surfacing, and dropping it would under-report the project rather than simplify it.
    return item === undefined ? `[${itemId}]` : `"${item.title}" [${item.id}]`;
  };

  const described = relations.map(
    (relation) =>
      `${titleOf(relation.source)} ${relation.label?.trim() || relation.kind} ${titleOf(relation.target)}`,
  );

  return `${relations.length} connection(s): ${described.join("; ")}.`;
};

/**
 * What a collection is a collection *of*, which the listing could not say.
 *
 * Every other kind carries its subject in its title — a note called "Quarterly notes" is about
 * quarterly notes. A collection's title is a name and its *question* is the content, so
 * `collection "Reading list" [id]` told a caller nothing about what is in it. Renaming one makes it
 * worse: the default names coincide with the kind they list, so the gap is invisible until somebody
 * calls one something else, which is exactly when a caller most needs telling.
 *
 * Read through `CollectionContent` rather than reaching into `content`, and non-throwing: this is a
 * report, and the two callers of the report have no sensible response to an exception. A record
 * this cannot parse is described without a subject rather than not described at all.
 *
 * The connected-to branch names its subject by title, resolved against the same listing the rest of
 * the report uses, so a caller reads one vocabulary throughout.
 */
const describeCollectionSubject = (
  item: ProjectContentItems[number],
  items: ProjectContentItems,
): string | null => {
  if (item.kind !== COLLECTION_KIND) {
    return null;
  }

  const question = CollectionContent(item.content);

  if (question instanceof type.errors) {
    return null;
  }

  if ("connectedTo" in question) {
    const subject = items.find((candidate) => candidate.id === question.connectedTo);

    return `lists what ${subject === undefined ? `[${question.connectedTo}]` : `"${subject.title}"`} connects to`;
  }

  return `lists every ${question.listsKind} in this project`;
};

function describeProjectContent(
  input: Readonly<{
    listing: ProjectContent | null;
    projectId: string;
    relations: readonly ContentRelation[];
    state: InfiniteCanvasState<WindowKind>;
  }>,
): string {
  const items = getProjectContent(input.listing, input.projectId);

  if (items === null) {
    return "The project's content has not loaded yet.";
  }

  if (items.length === 0) {
    return "This project holds nothing yet.";
  }

  const open = getOpenItemIds(input.state);
  /*
   * The id is reported because it is the handle `content.open` takes, and it has to be: a project
   * holds five "Untitled" notes without complaint. A listing whose entries could not be named back
   * would be a catalogue with no way to order from it.
   *
   * This used to add "the way they distinguish open windows", and that clause was false. Two
   * windows on one canvas were both titled "Links", `describeCanvas` reported them identically, and
   * `window.reveal` took a title and revealed whichever came first. The rule is not about stored
   * items at all — a title is a name, not an identity, wherever it appears — and the window half of
   * the vocabulary now reports and takes an id for exactly this reason.
   */
  const described = items.map((item) => {
    // Open-state first, because it is true of every kind; the subject only of one.
    const notes = [
      open.has(item.id) ? "open" : null,
      describeCollectionSubject(item, items),
    ].filter((note) => note !== null);

    return `${item.kind} "${item.title}" [${item.id}]${notes.length === 0 ? "" : ` (${notes.join(", ")})`}`;
  });
  const closedCount = items.filter((item) => !open.has(item.id)).length;

  return [
    `${items.length} item(s), ${closedCount} not open: ${described.join("; ")}.`,
    describeRelations(input.relations, items),
  ].join(" ");
}

export { describeProjectContent };
