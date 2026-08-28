import { getSelectionTargets, type InfiniteCanvasState } from "@hyphened/infinite-canvas";
import { type } from "arktype";

import { getContentWindowItemId, type WindowKind } from "../canvas/window-registry";
import { COLLECTION_KIND, CollectionContent } from "../collections/collection-gateway";
import { IMAGE_KIND, ImageContent } from "../images/image-gateway";
import { LINK_KIND, LinkContent } from "../links/link-gateway";
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
  relations: readonly ContentRelation[] | null,
  items: ProjectContentItems,
  selected: ReadonlySet<string>,
): string => {
  /*
   * "Not answered yet" is not "there are none", which is the distinction this file already draws
   * for the listing and had collapsed for the edges.
   *
   * `relations$` holds `[]` before its first query lands as well as when a project has none, and
   * that is the right answer for a reader that draws — the next frame corrects it. A sentence has
   * no next frame. `loadRelations` runs from an effect and nothing awaits it, so a caller asking
   * straight after opening a project was inside that window and was told the project had no
   * connections while it had several.
   */
  if (relations === null) {
    return "The project's connections have not loaded yet.";
  }

  if (relations.length === 0) {
    return "No connections.";
  }

  const titleOf = (itemId: string) => {
    const item = items.find((candidate) => candidate.id === itemId);

    // An endpoint the listing does not hold is still reported. An edge with one end missing is a
    // fact worth surfacing, and dropping it would under-report the project rather than simplify it.
    return item === undefined ? `[${itemId}]` : `"${item.title}" [${item.id}]`;
  };

  /*
   * Which one is selected, because `canvas.describe` says one is and cannot say which.
   *
   * A connector fills `selection.targets` and leaves `windowIds` empty, so the canvas report counts
   * them and stops there — an edge joins two records and outlives both windows, which is the reason
   * this file owns connections at all. The pair that names it is here, so the mark belongs here too.
   *
   * Said only when something is selected. Marking every other line "not selected" would be the same
   * fact spelled longer, on the report that is already the longer of the two.
   */
  const described = relations.map(
    (relation) =>
      `${titleOf(relation.source)} ${relation.label?.trim() || relation.kind} ${titleOf(relation.target)}${selected.has(relation.id) ? " (selected)" : ""}`,
  );

  return `${relations.length} connection(s): ${described.join("; ")}.`;
};

/**
 * What a kind carries that its title does not say, or absent when the title is the whole of it.
 *
 * A map keyed by kind rather than a chain of conditions, which is the shape `TITLE_WRITERS` in
 * `rename-item.ts` already uses for the same reason: the entries *are* the rule, and a kind that
 * grows a subject gets reported by adding a line rather than by finding the condition to widen.
 *
 * Three kinds have one, and the fourth is deliberately absent. A collection's title is a name and
 * its *question* is the content. A link's title is often not the address at all —
 * `getDraggedLinkName` takes a dragged tab's own title. An image's `description` is its alt text,
 * kept apart from the title on purpose, and the only words a picture has.
 *
 * A note has no entry because its content is prose of any length: `note.read` returns it whole, and
 * folding an opening line in here would duplicate the summary card and grow a listing without
 * bound. The distinction is length, not importance.
 *
 * **Both gaps hide behind default naming**, which is why neither surfaced until something was
 * renamed. A collection of links is called "Links" and a typed link is called "example.com/path",
 * so in the ordinary case the subject repeats the title and reads as redundant. It stops repeating
 * exactly when somebody renames one, and that is when a caller has no other way to know.
 *
 * Read through each kind's own schema rather than reaching into `content`, and non-throwing: this
 * is a report, and its callers are tool output with no response to an exception except rendering
 * nothing, which would lose the whole project over one field. A record whose content will not parse
 * is described without a subject rather than not described at all.
 */
const SUBJECT_READERS: Readonly<
  Record<string, (item: ProjectContentItems[number], items: ProjectContentItems) => string | null>
> = {
  [COLLECTION_KIND]: (item, items) => {
    const question = CollectionContent(item.content);

    if (question instanceof type.errors) {
      return null;
    }

    if ("connectedTo" in question) {
      // By title, against the same listing the rest of the report uses, so a caller reads one
      // vocabulary throughout — falling back to the id the way a half-resolved edge does.
      const subject = items.find((candidate) => candidate.id === question.connectedTo);

      return `lists what ${subject === undefined ? `[${question.connectedTo}]` : `"${subject.title}"`} connects to`;
    }

    return `lists every ${question.listsKind} in this project`;
  },
  /*
   * An image's words, which are the only words it has.
   *
   * `description` is the alt text and `image-gateway` keeps it apart from the title deliberately —
   * "renaming the window to Reference should not claim the picture depicts the word Reference" — so
   * the two diverge the moment either is edited, and only one of them was reportable. The dimensions
   * would be the other obvious thing to report and are not stored at all: `open-image` decodes them
   * from the bytes each time rather than keeping a second copy of what the picture already carries.
   */
  [IMAGE_KIND]: (item) => {
    const image = ImageContent(item.content);

    return image instanceof type.errors ? null : `described as "${image.description}"`;
  },
  [LINK_KIND]: (item) => {
    const link = LinkContent(item.content);

    return link instanceof type.errors ? null : `points at ${link.url}`;
  },
};

const describeSubject = (item: ProjectContentItems[number], items: ProjectContentItems) =>
  SUBJECT_READERS[item.kind]?.(item, items) ?? null;

function describeProjectContent(
  input: Readonly<{
    listing: ProjectContent | null;
    projectId: string;
    /** `null` until a query has answered for this project — not the same as none. */
    relations: readonly ContentRelation[] | null;
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
    const notes = [open.has(item.id) ? "open" : null, describeSubject(item, items)].filter(
      (note) => note !== null,
    );

    return `${item.kind} "${item.title}" [${item.id}]${notes.length === 0 ? "" : ` (${notes.join(", ")})`}`;
  });
  const closedCount = items.filter((item) => !open.has(item.id)).length;

  // The framework's own model for a selected thing that is not a window; the connector rail and the
  // Backspace action read the same set, so the report and the verbs cannot disagree about it.
  const selectedRelationIds = new Set(
    getSelectionTargets(input.state.selection)
      .filter((target) => target.type === "edge")
      .map((target) => target.id),
  );

  return [
    `${items.length} item(s), ${closedCount} not open: ${described.join("; ")}.`,
    describeRelations(input.relations, items, selectedRelationIds),
  ].join(" ");
}

export { describeProjectContent };
