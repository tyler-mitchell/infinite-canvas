import { type } from "arktype";

import type { ContentItemRecord } from "../database/database.client";
import { content } from "../database/operations";

const LINK_KIND = "link";

// host is stored once for summaries.
const LinkContent = type({
  host: "string",
  url: "string",
});

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
function parseLinkUrl(url: string): URL | null {
  const trimmedUrl = url.trim();
  const candidates = /^[a-z][a-z\d+.-]*:/i.test(trimmedUrl)
    ? [trimmedUrl]
    : [trimmedUrl, `https://${trimmedUrl}`];
  for (const candidate of candidates) {
    try {
      return new URL(candidate);
    } catch {
      continue;
    }
  }

  return null;
}

export const linkGateway = {
  create: async (input: Readonly<{ projectId: string; title: string; url: string }>) => {
    const parsed = parseLinkUrl(input.url);
    const url = parsed?.href ?? input.url;
    return toLink(
      await content.create({
        content: { host: parsed?.host ?? "", url },
        kind: LINK_KIND,
        projectId: input.projectId,
        searchText: `${input.title} ${url}`,
        title: input.title,
      }),
    );
  },
  read: async (linkId: string) => {
    const record = await content.read(linkId);

    return record?.kind === LINK_KIND ? toLink(record) : null;
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

export { parseLinkUrl, LINK_KIND, LinkContent };
export type { LinkRecord };
