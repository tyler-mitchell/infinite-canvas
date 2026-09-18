import { type InfiniteCanvasState } from "@hyphened/infinite-canvas";
import { type } from "arktype";

import { getContentWindowItemId, type WindowKind } from "../canvas/window-registry";
import { COLLECTION_KIND, CollectionContent } from "../collections/collection-gateway";
import { IMAGE_KIND, ImageContent } from "../images/image-gateway";
import { LINK_KIND, LinkContent } from "../links/link-gateway";
import type { ContentRelation } from "../database/database.client";
import { getProjectContent, type ProjectContent } from "./project-content";

type ProjectContentItems = NonNullable<ReturnType<typeof getProjectContent>>;

// Minimized windows still count as open.
const getOpenItemIds = (state: InfiniteCanvasState<WindowKind>) =>
  new Set(
    state.windows
      .map((window) => getContentWindowItemId(window))
      .filter((itemId) => itemId !== null),
  );

// Keep the stored order because relation meaning can be directional.
const describeRelations = (
  relations: readonly ContentRelation[] | null,
  items: ProjectContentItems,
  selected: ReadonlySet<string>,
): string => {
  if (relations === null) {
    return "The project's connections have not loaded yet.";
  }

  if (relations.length === 0) {
    return "No connections.";
  }

  const titleOf = (itemId: string) => {
    const item = items.find((candidate) => candidate.id === itemId);

    // Keep unresolved endpoints in the report.
    return item === undefined ? `[${itemId}]` : `"${item.title}" [${item.id}]`;
  };

  const described = relations.map(
    (relation) =>
      `${titleOf(relation.source)} ${relation.label?.trim() || relation.kind} ${titleOf(relation.target)}${selected.has(relation.id) ? " (selected)" : ""}`,
  );

  return `${relations.length} connection(s): ${described.join("; ")}.`;
};

// Readers return null when stored content is invalid.
const SUBJECT_READERS: Readonly<
  Record<string, (item: ProjectContentItems[number], items: ProjectContentItems) => string | null>
> = {
  [COLLECTION_KIND]: (item, items) => {
    const question = CollectionContent(item.content);

    if (question instanceof type.errors) {
      return null;
    }

    if ("connectedTo" in question) {
      const subject = items.find((candidate) => candidate.id === question.connectedTo);

      return `lists what ${subject === undefined ? `[${question.connectedTo}]` : `"${subject.title}"`} connects to`;
    }

    return `lists every ${question.listsKind} in this project`;
  },
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
    /** null means that the query has not returned. */
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
  const described = items.map((item) => {
    const notes = [open.has(item.id) ? "open" : null, describeSubject(item, items)].filter(
      (note) => note !== null,
    );

    return `${item.kind} "${item.title}" [${item.id}]${notes.length === 0 ? "" : ` (${notes.join(", ")})`}`;
  });
  const closedCount = items.filter((item) => !open.has(item.id)).length;

  const selectedRelationIds = new Set(
    input.state.selection.targets
      .filter((target) => target.type === "edge")
      .map((target) => target.id),
  );

  return [
    `${items.length} item(s), ${closedCount} not open: ${described.join("; ")}.`,
    describeRelations(input.relations, items, selectedRelationIds),
  ].join(" ");
}

export { describeProjectContent };
