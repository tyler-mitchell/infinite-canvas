import { type } from "arktype";

import type { ContentItemRecord } from "../database/database.client";
import { content } from "../database/operations";

const IMAGE_KIND = "image";

// source stores a data URL. description stores alt text.
const ImageContent = type({
  description: "string",
  source: "string",
}).onUndeclaredKey("delete");

type ImageRecord = Readonly<{
  content: typeof ImageContent.infer;
  id: string;
  revision: number;
  title: string;
}>;

function toImage(record: ContentItemRecord): ImageRecord {
  return {
    content: ImageContent.assert(record.content),
    id: record.id,
    revision: record.revision,
    title: record.title,
  };
}

export const imageGateway = {
  create: async (input: Readonly<{ description: string; projectId: string; source: string }>) =>
    toImage(
      await content.create({
        content: { description: input.description, source: input.source },
        kind: IMAGE_KIND,
        projectId: input.projectId,
        searchText: input.description,
        title: input.description,
      }),
    ),
  list: async (projectId: string) =>
    (await content.list({ kind: IMAGE_KIND, projectId })).map(toImage),
  read: async (imageId: string) => {
    const record = await content.read(imageId);

    return record === null ? null : toImage(record);
  },
  // Rename preserves the content and includes the description in search text.
  rename: async (input: Readonly<{ item: ContentItemRecord; title: string }>) => {
    const image = toImage(input.item);

    return toImage(
      await content.save({
        content: image.content,
        itemId: image.id,
        revision: image.revision,
        searchText: `${input.title} ${image.content.description}`,
        title: input.title,
      }),
    );
  },
};

export { IMAGE_KIND, ImageContent };
export type { ImageRecord };
