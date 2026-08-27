import { getInfiniteCanvasWindowData, type InfiniteCanvasState } from "@hyphened/infinite-canvas";

import { ContentWindowData, type WindowKind } from "../canvas/window-registry";
import { getProjectContent, type ProjectContent } from "./project-content";

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
      .map((window) => getInfiniteCanvasWindowData(window, ContentWindowData.allows)?.itemId)
      .filter((itemId) => itemId !== undefined),
  );

function describeProjectContent(
  input: Readonly<{
    listing: ProjectContent | null;
    projectId: string;
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
  const described = items.map(
    (item) => `${item.kind} "${item.title}"${open.has(item.id) ? " (open)" : ""}`,
  );
  const closedCount = items.filter((item) => !open.has(item.id)).length;

  return `${items.length} item(s), ${closedCount} not open: ${described.join("; ")}.`;
}

export { describeProjectContent };
