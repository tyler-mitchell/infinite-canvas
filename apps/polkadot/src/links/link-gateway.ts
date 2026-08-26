import { type } from "arktype";

import type { ContentItemRecord } from "../database/database.client";
import { content } from "../database/operations";

/**
 * A link, as a content item.
 *
 * No preview, favicon or snippet: all of those are network reads of a third-party address, and this
 * workbench is local-first. The card draws what the drop carried.
 */

const LINK_KIND = "link";

/** `host` is derived once at creation — it is what the summary shows, and parsing per frame is not. */
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
 * The host, or `""` when the string is not an address.
 *
 * `new URL` throws on a bare `example.com` — no scheme, so it is a relative reference. Retrying
 * with `https://` is what an address bar does.
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
        // The address is searchable too: half of finding a link is remembering where it went.
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
