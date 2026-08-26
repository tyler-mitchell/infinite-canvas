import type { ContentItemRecord } from "../database/database.client";
import { imageGateway } from "../images/image-gateway";
import { getImageSize, openImageWindow } from "../images/open-image";
import { openLinkWindow } from "../links/open-link";
import { openNoteWindow } from "../notes/open-note";
import { openCollectionWindow } from "../collections/open-collection";
import type { WindowPlacement } from "./open-window";

/**
 * Put a content item on the canvas, whatever kind it is.
 *
 * Something has to turn "this record" into "this window", and each kind opens differently enough
 * that one call cannot serve them: a note has a size the app chose, an image has one only its own
 * pixels know, and a collection is taller than it is wide because a list is read down.
 *
 * A lookup keyed by kind rather than a switch. It sits beside `window-registry` rather than inside
 * it because the registry answers *how a kind draws* and this answers *how one is placed* — the
 * registry is loaded to render every window on every canvas and should not also be the thing that
 * reaches for an image decoder. Both compose across every kind, which is why `canvas/` is where
 * they belong; this lived in `collections/` until 2026-08-26 because a collection's rows were its
 * first caller, and first caller is not ownership.
 *
 * An item whose kind has no opener is skipped rather than opened as something else. A row that
 * quietly opened the wrong sort of window would be worse than one that does nothing.
 */

type ItemOpener = (
  input: WindowPlacement & Readonly<{ item: ContentItemRecord }>,
) => void | Promise<void>;

const OPENERS: Readonly<Record<string, ItemOpener>> = {
  collection: ({ actions, item, state }) => {
    openCollectionWindow({ actions, collectionId: item.id, state, title: item.title });
  },
  image: async ({ actions, item, state }) => {
    /*
     * Read and decode, because a picture's window is the shape of the picture.
     *
     * The alternative is opening every image at one default size and letterboxing until the user
     * drags it right, which is the thing `getImageSize` exists to avoid — and the bytes have to be
     * fetched for the body to draw anyway, so this costs the round trip nothing that was not
     * already owed.
     */
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
  /*
   * A link needs no read at all, unlike an image.
   *
   * Its window is a fixed card whose size is the app's choice, and the record it binds to is
   * fetched by the body when it draws. Reading here would be a round trip whose only result is a
   * title this listing already has.
   */
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

/** The kinds a listing can actually offer, so a surface can say so rather than discovering it. */
function isOpenableItemKind(kind: string) {
  return kind in OPENERS;
}

export { isOpenableItemKind, openItemWindow };
