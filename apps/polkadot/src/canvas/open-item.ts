import { openCollectionWindow } from "../collections/open-collection";
import type { ContentItemRecord } from "../database/database.client";
import { imageGateway } from "../images/image-gateway";
import { getImageSize, openImageWindow } from "../images/open-image";
import { openLinkWindow } from "../links/open-link";
import { openNoteWindow } from "../notes/open-note";
import type { WindowPlacement } from "./open-window";

/**
 * Put a content item on the canvas, whatever kind it is. Beside `window-registry` because both
 * compose across every kind — that one answers how a kind draws, this one how it is placed.
 *
 * An unknown kind is skipped rather than opened as something else.
 */

type ItemOpener = (
  input: WindowPlacement & Readonly<{ item: ContentItemRecord }>,
) => void | Promise<void>;

const OPENERS: Readonly<Record<string, ItemOpener>> = {
  collection: ({ actions, item, state }) => {
    openCollectionWindow({ actions, collectionId: item.id, state, title: item.title });
  },
  // Decoded rather than opened at a default size, since a picture's window is the picture's shape.
  image: async ({ actions, item, state }) => {
    const image = await imageGateway.read(item.id);

    if (image === null) {
      return;
    }

    openImageWindow({
      actions,
      imageId: image.id,
      size: await getImageSize(image.content.source),
      state,
      title: image.title,
    });
  },
  link: ({ actions, item, state }) => {
    openLinkWindow({ actions, linkId: item.id, state, title: item.title });
  },
  note: ({ actions, item, state }) => {
    openNoteWindow({ actions, noteId: item.id, state, title: item.title });
  },
};

function openItemWindow(input: WindowPlacement & Readonly<{ item: ContentItemRecord }>) {
  void OPENERS[input.item.kind]?.(input);
}

/** So a listing can say a kind has no window rather than discovering it by a click that goes nowhere. */
function isOpenableItemKind(kind: string) {
  return kind in OPENERS;
}

export { isOpenableItemKind, openItemWindow };
