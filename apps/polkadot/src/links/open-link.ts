import type { InfiniteCanvasPoint, InfiniteCanvasRect } from "@hyphened/infinite-canvas/legacy";

import { openContentWindow, type WindowPlacement } from "../canvas/open-window";
import { createProjectItem } from "../content/project-content";
import { LINK_KIND, parseLinkUrl, linkGateway } from "./link-gateway";

const LINK_SIZE = { height: 460, width: 620 } as const;
// The minimum size stays above the LOD restore threshold.
const LINK_MINIMUM_SIZE = { height: 240, width: 320 } as const;

const TITLE_LIMIT = 64;
const titleSegments = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function shortenTitle(title: string) {
  const segments = titleSegments.segment(title)[Symbol.iterator]();
  return Array.from({ length: TITLE_LIMIT }, () => segments.next().value?.segment ?? "").join("");
}

// The host and path form the title. Query strings are omitted.
function getLinkName(url: string): string {
  const parsed = parseLinkUrl(url);

  if (parsed === null || parsed.host === "") {
    return shortenTitle(url);
  }

  const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");

  return shortenTitle(`${parsed.host.replace(/^www\./, "")}${path}`);
}

// A text/uri-list comment contains a dragged tab title.
function getDraggedLinkName(text: string): string | null {
  const comment = text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("#") && line.slice(1).trim().length > 0);
  const name = comment?.slice(1).trim() ?? "";

  return name === "" ? null : shortenTitle(name);
}

async function openNewLink(
  input: WindowPlacement &
    Readonly<{ at?: InfiniteCanvasPoint; name?: string | null; projectId: string; url: string }>,
) {
  const created = await createProjectItem({
    projectId: input.projectId,
    kind: LINK_KIND,
    create: () =>
      linkGateway.create({
        projectId: input.projectId,
        title: input.name?.trim() || getLinkName(input.url),
        url: input.url,
      }),
  });

  openLinkWindow({
    dispatch: input.dispatch,
    linkId: created.id,
    rect: input.at === undefined ? undefined : { ...LINK_SIZE, x: input.at.x, y: input.at.y },
    state: input.state,
    title: created.title,
  });
}

function openLinkWindow(
  input: WindowPlacement & Readonly<{ linkId: string; rect?: InfiniteCanvasRect; title: string }>,
) {
  openContentWindow({
    dispatch: input.dispatch,
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
