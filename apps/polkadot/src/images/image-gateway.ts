import { type } from "arktype";

import type { ContentItemRecord } from "../database/database.client";
import { content } from "../database/operations";

/**
 * An image, as a content item.
 *
 * The second kind, and the one that proves the first was not special. Nothing in the schema, the
 * SurrealQL functions, or the relation graph changed to admit it — `content_item` already carried a
 * `kind` and an opaque `content`, and `relates_to` already joined any item to any other, so an
 * image can be connected to a note the day it exists.
 *
 * What is here is exactly what a note's gateway has and no more: the kind string, the shape of
 * `content`, and the words that make one findable.
 */

const IMAGE_KIND = "image";

/**
 * `source` holds a data URL, and that is a real decision rather than an interim one.
 *
 * A workbench that keeps its notes in the browser cannot keep its pictures somewhere else: a remote
 * URL rots, needs a network, and turns a local-first canvas into one that is blank on a plane. The
 * bytes ride along in the record, so an image survives a reload, a reopen, and an export for the
 * same reason a note's text does.
 *
 * The cost is honest and worth naming: base64 is about a third larger than the file, and a very
 * large photo makes a very large record. `content` is FLEXIBLE, so moving to a bytes field later
 * changes this line and nothing above it.
 *
 * `description` rather than a filename echo. It starts as the file's name because that is the only
 * thing known at the moment of the drop, but it is separate state from the window title on purpose:
 * renaming the window to "Reference" should not claim the picture depicts the word Reference. It is
 * the `alt` text, and it is what makes an image findable, since there are no words in a picture.
 */
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
        // The title is the description at creation; the two diverge the moment either is edited.
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
  /**
   * A new name, and nothing else.
   *
   * This gateway had `create`, `list` and `read`, so an image's title could not be changed anywhere
   * in the app: the library rail refused it, and `content.rename` told a caller to use the image's
   * own window — which has no title control, and no controls at all. The message named a route that
   * did not exist.
   *
   * Narrower than `save` on purpose. `content.save` replaces the whole record, and the only other
   * thing an image holds is its `description` — the `alt` text, which is separate from the title
   * deliberately, since renaming a window to "Reference" should not claim the picture depicts the
   * word Reference. A `save` here would invite passing one without the other; taking only a title
   * cannot.
   *
   * The description stays in the search text. It is what makes an image findable at all — there are
   * no words in a picture — so dropping it to index the new title alone would trade one name for
   * another rather than adding one.
   */
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
