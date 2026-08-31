import { type } from "arktype";

import type { ContentItemRecord } from "../database/database.client";
import { content } from "../database/operations";

const LINK_KIND = "link";

// host is stored once for summaries.
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

// Bare domains retry with an https scheme.
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
  // Rename preserves the address and keeps it in search text.
  rename: async (input: Readonly<{ item: ContentItemRecord; title: string }>) => {
    const link = toLink(input.item);

    return toLink(
      await content.save({
        content: link.content,
        itemId: link.id,
        revision: link.revision,
        searchText: `${input.title} ${link.content.url}`,
        title: input.title,
      }),
    );
  },
};

export { getLinkHost, LINK_KIND, LinkContent };
export type { LinkRecord };
