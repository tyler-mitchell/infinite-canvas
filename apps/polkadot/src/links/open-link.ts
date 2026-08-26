import type { InfiniteCanvasPoint } from "@hyphened/infinite-canvas";

import { openContentWindow, type WindowPlacement } from "../canvas/open-window";
import { getLinkHost, linkGateway } from "./link-gateway";

/**
 * Put a link on the canvas.
 *
 * Where the window lands is `openContentWindow`'s. What is a link's own is naming it, because
 * unlike every other kind here nothing arrives with a name: a note is titled by its first line, a
 * picture by its filename, a collection by the user. A dropped address is a string.
 */

/**
 * Wide and short, but not as short as it wants to be.
 *
 * A card holding a host, a name and an address needs about 130px, and 200 is what it gets — because
 * a kind that declares a summary must clear `fullAbovePx` on its short axis or it is demoted by the
 * first zoom-out and never returns, rendering as a summary at 100% zoom for the rest of the
 * session. `detail-level.ts` documents that threshold and this is the shape that found it.
 *
 * So the extra 70px is the framework's constraint made visible rather than a design preference, and
 * the card spends it on air instead of pretending to have more to say.
 */
const LINK_SIZE = { height: 200, width: 380 } as const;
/** Same floor, same reason: a resize must not drop the card back under the return threshold. */
const LINK_MINIMUM_SIZE = { height: 200, width: 260 } as const;

/** How long a derived name is allowed to get before it stops being a name. */
const TITLE_LIMIT = 64;

/**
 * A readable name for an address.
 *
 * The host alone is not enough — four links to the same documentation site would all be called
 * "tanstack.com" and the canvas would be four identical cards. The full URL is not a name either;
 * it is an address, and a card titled with a query string is a card nobody can scan.
 *
 * Host plus path, with the protocol and `www.` dropped because neither distinguishes anything, and
 * the query dropped because it is machinery. What is left is the part a person would say out loud.
 */
function getLinkName(url: string): string {
  const host = getLinkHost(url);

  if (host === "") {
    // Nothing parsed, so the string is all there is. Trimmed to a name-sized piece of itself.
    return url.slice(0, TITLE_LIMIT);
  }

  const parsed = new URL(url.includes("://") ? url : `https://${url}`);
  const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");

  return `${host.replace(/^www\./, "")}${path}`.slice(0, TITLE_LIMIT);
}

/**
 * The name a drag brought with it, if it brought one.
 *
 * `text/uri-list` is line-oriented and permits `#` comments, and a browser dragging a tab has a
 * page title to put somewhere. When one is there it is a far better name than anything derivable
 * from the address; when it is not, this returns null and the address is all there is.
 *
 * Taken from the payload's raw `text` rather than its `uris`, because the framework has already
 * stripped comment lines out of `uris` — which is right for a list of addresses and is exactly why
 * the raw form is still carried.
 */
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
}

function openLinkWindow(
  input: WindowPlacement &
    Readonly<{
      linkId: string;
      rect?: { height: number; width: number; x: number; y: number };
      title: string;
    }>,
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
