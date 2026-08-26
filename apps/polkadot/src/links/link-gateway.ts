import { type } from "arktype";

import type { ContentItemRecord } from "../database/database.client";
import { content } from "../database/operations";

/**
 * A link, as a content item.
 *
 * The fourth kind, and like the second it needed nothing from the schema: `content_item` carries a
 * `kind` and an opaque `content`, and `relates_to` joins any item to any other — so a link is
 * connected to the note that cites it on the day it exists.
 *
 * What is genuinely a link's own is small, and that is the finding rather than a disappointment.
 * A bookmark is an address and a name for it. Everything a link app adds on top of that — a
 * favicon, a snippet, a preview image — is fetched from the network, and this workbench is
 * local-first: a canvas that needs a connection to draw its own contents is a canvas that is blank
 * on a plane, which is the same reason images keep their bytes in the record.
 */

const LINK_KIND = "link";

/**
 * `url` is stored exactly as it was dropped, and `host` is derived once at creation.
 *
 * Storing the host looks like a duplicate of a fact the URL already carries, and would be, except
 * that it is the one part of a link readable at any zoom — it is what the summary shows and what
 * the card leads with. Deriving it per render means parsing a URL on every frame of a camera move;
 * deriving it once means a link that was dropped as a malformed string has already failed by the
 * time anything tries to draw it.
 *
 * Empty for an address that will not parse. That is a real case rather than a defensive one:
 * dragging selected text that merely looks like a link produces a string no `URL` will take, and
 * the honest outcome is a card that shows the text and cannot be opened, not a thrown error where
 * a window should be.
 */
const LinkContent = type({
  host: "string",
  url: "string",
}).onUndeclaredKey("delete");

type LinkRecord = Readonly<{
  content: typeof LinkContent.infer;
  id: string;
  revision: number;
  title: string;
}>;

function toLink(record: ContentItemRecord): LinkRecord {
  return {
    content: LinkContent.assert(record.content),
    id: record.id,
    revision: record.revision,
    title: record.title,
  };
}

/**
 * The host, or `""` when there is not one.
 *
 * `URL` throws rather than returning null, and a bare `example.com` throws too — no scheme, so it
 * is a relative reference. Trying `https://` in front of it is what a browser's address bar does
 * and is the difference between a dropped `example.com` being a link and being a sentence.
 */
function getLinkHost(url: string): string {
  for (const candidate of [url, `https://${url}`]) {
    try {
      return new URL(candidate).host;
    } catch {
      continue;
    }
  }

  return "";
}

export const linkGateway = {
  create: async (input: Readonly<{ projectId: string; title: string; url: string }>) =>
    toLink(
      await content.create({
        content: { host: getLinkHost(input.url), url: input.url },
        kind: LINK_KIND,
        projectId: input.projectId,
        /*
         * The address is searchable alongside the name, which is not true of any other kind here.
         * A note is found by its words and a picture by its description, but half of remembering a
         * link is remembering where it went — "the thing on stripe.com" is how people actually look
         * for one, and a title alone cannot answer it.
         */
        searchText: `${input.title} ${input.url}`,
        title: input.title,
      }),
    ),
  list: async (projectId: string) =>
    (await content.list({ kind: LINK_KIND, projectId })).map(toLink),
  read: async (linkId: string) => {
    const record = await content.read(linkId);

    return record === null ? null : toLink(record);
  },
};

export { getLinkHost, LINK_KIND, LinkContent };
export type { LinkRecord };
