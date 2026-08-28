import type { InfiniteCanvasPoint, InfiniteCanvasRect } from "@hyphened/infinite-canvas";

import { openContentWindow, type WindowPlacement } from "../canvas/open-window";
import { loadProjectContent } from "../content/project-content";
import { getLinkHost, linkGateway } from "./link-gateway";

/**
 * Put a link on the canvas. Naming it is the part that is a link's own — every other kind arrives
 * named, and a dropped address is a string.
 */

/** A window holding a live page, not a bookmark. The floor clears the LOD restore threshold. */
const LINK_SIZE = { height: 460, width: 620 } as const;
const LINK_MINIMUM_SIZE = { height: 240, width: 320 } as const;

const TITLE_LIMIT = 64;

/** Host plus path. The host alone names four links to one site identically; the full URL is not a name. */
function getLinkName(url: string): string {
  const host = getLinkHost(url);

  if (host === "") {
    return url.slice(0, TITLE_LIMIT);
  }

  const parsed = new URL(url.includes("://") ? url : `https://${url}`);
  const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");

  return `${host.replace(/^www\./, "")}${path}`.slice(0, TITLE_LIMIT);
}

/** A `text/uri-list` comment line, which is where a browser puts a dragged tab's title. */
function getDraggedLinkName(text: string): string | null {
  const comment = text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("#"));
  const name = comment?.slice(1).trim() ?? "";

  return name === "" ? null : name.slice(0, TITLE_LIMIT);
}

async function openNewLink(
  input: WindowPlacement &
    Readonly<{ at?: InfiniteCanvasPoint; name?: string | null; projectId: string; url: string }>,
) {
  const created = await linkGateway.create({
    projectId: input.projectId,
    title: input.name ?? getLinkName(input.url),
    url: input.url,
  });

  openLinkWindow({
    actions: input.actions,
    linkId: created.id,
    rect: input.at === undefined ? undefined : { ...LINK_SIZE, x: input.at.x, y: input.at.y },
    state: input.state,
    title: created.title,
  });
  // The listing, re-asked, for the reason `open-note.ts` gives. Three of the four creation paths
  // had omitted it; a dragged link was on the canvas and missing from the library until a reload.
  await loadProjectContent(input.projectId);
}

function openLinkWindow(
  input: WindowPlacement & Readonly<{ linkId: string; rect?: InfiniteCanvasRect; title: string }>,
) {
  openContentWindow({
    actions: input.actions,
    data: { itemId: input.linkId },
    kind: "link",
    minSize: LINK_MINIMUM_SIZE,
    rect: input.rect,
    size: LINK_SIZE,
    state: input.state,
    title: input.title,
  });
}

export {
  getDraggedLinkName,
  getLinkName,
  LINK_MINIMUM_SIZE,
  LINK_SIZE,
  openLinkWindow,
  openNewLink,
};
